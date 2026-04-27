import { workspaceSnapshotSchema } from '../../schemas/workspace';
import { selectSemanticGraphCatalogDiagnostics, validateGraphComposition } from '../../features/workspace-persistence/graph-catalog';
import type { PersistedDatasetFileHandle } from '../../services/persistence';
import { IMPORT_BOOTSTRAP_DATASET_ID, IMPORT_BOOTSTRAP_GRAPH_ID } from './bootstrap';
import { synchronizeDatasetSourceFileMetadata } from './dataset-file-handle-metadata';
import { createDefaultMutationMeta, createLedgerEntry, initializeWorkspaceVersion, validateLedgerOrdering } from './events';
import type {
  ApplyWorkerEnvelopeResult,
  ConfirmImportInput,
  KernelMutationMeta,
  PromoteReferenceGraphInput,
  QueueWorkerRequestInput,
  ReplaceSnapshotInput,
  RollbackConfirmedImportInput,
  UpdateColumnSemanticsInput,
  UpdateDatasetContextInput,
  WorkerEnvelopeContext,
  WorkspaceKernelData,
  WorkspaceSnapshotPatch,
} from './types';
import type { IssueRecord, WorkspaceSnapshot } from '../../schemas/workspace';
import type { WorkerMessageEnvelope } from '../../schemas/worker';

type Dataset = WorkspaceSnapshot['datasets'][number];
type DatasetColumn = Dataset['columns'][number];
type ColumnSemanticLedgerPayload = Partial<Pick<DatasetColumn,
  'label' | 'dataType' | 'semanticRole' | 'unit' | 'measurementContext' | 'description'
>>;

const semanticIssueKinds = {
  columnMissingRole: 'semantics.column.missing-role',
  columnMissingContext: 'semantics.column.missing-context',
  datasetMissingContext: 'semantics.dataset.missing-context',
  graphCompositionInvalid: 'semantics.graph.composition-invalid',
} as const;

function semanticIssueId(...parts: string[]) {
  const sanitizedParts = parts.map((part) => part.trim().replace(/[^A-Za-z0-9._:-]+/g, '_')).filter(Boolean);
  const [namespace, ...entityParts] = sanitizedParts;

  return [
    namespace,
    ...entityParts.map((part) => `p${part.length}:${part}`),
  ].filter(Boolean).join('.');
}

function isSemanticIssueForDataset(issue: IssueRecord, datasetId: string) {
  if (!issue.kind.startsWith('semantics.')) {
    return false;
  }

  const diagnostics = issue.diagnostics as { datasetId?: unknown };

  return diagnostics.datasetId === datasetId || issue.source.entityId === datasetId;
}

function isSemanticGraphIssueForDataset(issue: IssueRecord, datasetId: string) {
  const diagnostics = issue.diagnostics as { datasetId?: unknown };

  return issue.kind === semanticIssueKinds.graphCompositionInvalid && diagnostics.datasetId === datasetId;
}

function isColumnSemanticIssueForDatasetColumn(issue: IssueRecord, datasetId: string, columnId: string) {
  if (issue.kind !== semanticIssueKinds.columnMissingRole && issue.kind !== semanticIssueKinds.columnMissingContext) {
    return false;
  }

  const diagnostics = issue.diagnostics as { datasetId?: unknown; columnId?: unknown };

  return diagnostics.datasetId === datasetId && diagnostics.columnId === columnId;
}

function isDatasetContextSemanticIssue(issue: IssueRecord, datasetId: string) {
  if (issue.kind !== semanticIssueKinds.datasetMissingContext) {
    return false;
  }

  const diagnostics = issue.diagnostics as { datasetId?: unknown };

  return diagnostics.datasetId === datasetId || issue.source.entityId === datasetId;
}

function hasMeaningfulContext(context: Record<string, string | undefined> | null | undefined) {
  return Boolean(context && Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0));
}

function assertDatasetAcceptsSemanticEdits(dataset: Dataset) {
  if (dataset.sourceKind === 'import-preview' || dataset.sourceKind === 'recovery') {
    throw new Error('Semantic edits require a confirmed dataset. Placeholder datasets cannot be edited through semantic commands.');
  }
}

function restoreGraphStatusAfterSemanticClear(input: {
  snapshot: WorkspaceSnapshot;
  graph: WorkspaceSnapshot['graphDefinitions'][number];
  priorIssueIds: string[];
}) {
  const hadSemanticIssue = input.graph.issueIds.some((issueId) => issueId.startsWith('semantics.'));

  if (input.graph.status !== 'stale' || input.priorIssueIds.length > 0 || !hadSemanticIssue) {
    return input.graph.status;
  }

  return input.snapshot.referenceGraphId === input.graph.graphId ? 'reference' : 'candidate';
}

function preserveUnresolvedIssueState(generatedIssue: IssueRecord, existingIssuesById: Map<string, IssueRecord>) {
  const existingIssue = existingIssuesById.get(generatedIssue.issueId);

  if (!existingIssue || existingIssue.status === 'resolved') {
    return generatedIssue;
  }

  if (generatedIssue.kind === semanticIssueKinds.graphCompositionInvalid) {
    const existingDiagnostics = existingIssue.diagnostics as { affectedColumnIds?: unknown; blockedReasons?: unknown };
    const generatedDiagnostics = generatedIssue.diagnostics as { affectedColumnIds?: unknown; blockedReasons?: unknown };
    const existingBlockedReasons = Array.isArray(existingDiagnostics.blockedReasons)
      ? existingDiagnostics.blockedReasons.filter((reason): reason is string => typeof reason === 'string')
      : [];
    const generatedBlockedReasons = Array.isArray(generatedDiagnostics.blockedReasons)
      ? generatedDiagnostics.blockedReasons.filter((reason): reason is string => typeof reason === 'string')
      : [];
    const existingAffectedColumnIds = Array.isArray(existingDiagnostics.affectedColumnIds)
      ? existingDiagnostics.affectedColumnIds.filter((columnId): columnId is string => typeof columnId === 'string')
      : [];
    const generatedAffectedColumnIds = Array.isArray(generatedDiagnostics.affectedColumnIds)
      ? generatedDiagnostics.affectedColumnIds.filter((columnId): columnId is string => typeof columnId === 'string')
      : [];
    const blockingReasonsChanged = existingBlockedReasons.length !== generatedBlockedReasons.length
      || existingBlockedReasons.some((reason, index) => reason !== generatedBlockedReasons[index]);
    const affectedColumnIdsChanged = existingAffectedColumnIds.length !== generatedAffectedColumnIds.length
      || existingAffectedColumnIds.some((columnId, index) => columnId !== generatedAffectedColumnIds[index]);

    if (blockingReasonsChanged || affectedColumnIdsChanged) {
      return generatedIssue;
    }
  }

  return {
    ...generatedIssue,
    status: existingIssue.status,
    detectedAt: existingIssue.detectedAt,
  } satisfies IssueRecord;
}

function createSemanticRepairActions(input: {
  issueId: string;
  workspaceId: string;
  datasetId: string;
  columnId?: string | undefined;
}) {
  return [
    {
      actionId: 'repair.focusSemanticField',
      label: input.columnId ? 'Edit column semantics' : 'Edit dataset context',
      command: 'repair.focusSemanticField',
      args: {
        issueId: input.issueId,
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        ...(input.columnId ? { columnId: input.columnId } : {}),
      },
    },
  ] satisfies IssueRecord['repairActions'];
}

function createGraphRepairAction(graphId: string) {
  return {
    actionId: 'repair.focusGraph',
    label: 'Inspect graph',
    command: 'repair.focusGraph',
    args: {
      graphId,
    },
  } satisfies IssueRecord['repairActions'][number];
}

function createColumnSemanticIssues(input: {
  snapshot: WorkspaceSnapshot;
  dataset: Dataset;
  column: DatasetColumn;
  occurredAt: string;
}) {
  const issues: IssueRecord[] = [];

  if (input.column.semanticRole === 'unassigned') {
    const issueId = semanticIssueId('semantics', input.dataset.datasetId, input.column.columnId, 'missing-role');

    issues.push({
      issueId,
      kind: semanticIssueKinds.columnMissingRole,
      severity: 'warning',
      status: 'open',
      detectedAt: input.occurredAt,
      source: {
        module: 'workspace-kernel',
        entityType: 'dataset-column',
        entityId: input.column.columnId,
      },
      title: 'Column semantic role is not assigned',
      detail: `Column "${input.column.label}" in dataset "${input.dataset.displayName}" is not assigned to an analytical role.`,
      userMessage: `Assign an analytical role for "${input.column.label}" before graphing begins.`,
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: input.snapshot.workspaceId,
        panel: 'semantics',
      },
      repairActions: createSemanticRepairActions({
        issueId,
        workspaceId: input.snapshot.workspaceId,
        datasetId: input.dataset.datasetId,
        columnId: input.column.columnId,
      }),
      diagnostics: {
        datasetId: input.dataset.datasetId,
        columnId: input.column.columnId,
        field: 'semanticRole',
      },
    });
  }

  if (!hasMeaningfulContext(input.column.measurementContext)) {
    const issueId = semanticIssueId('semantics', input.dataset.datasetId, input.column.columnId, 'missing-context');

    issues.push({
      issueId,
      kind: semanticIssueKinds.columnMissingContext,
      severity: 'warning',
      status: 'open',
      detectedAt: input.occurredAt,
      source: {
        module: 'workspace-kernel',
        entityType: 'dataset-column',
        entityId: input.column.columnId,
      },
      title: 'Column measurement context is missing',
      detail: `Column "${input.column.label}" does not yet describe how its measurement should be interpreted.`,
      userMessage: `Add measurement context for "${input.column.label}" when this meaning should be defensible.`,
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: input.snapshot.workspaceId,
        panel: 'semantics',
      },
      repairActions: createSemanticRepairActions({
        issueId,
        workspaceId: input.snapshot.workspaceId,
        datasetId: input.dataset.datasetId,
        columnId: input.column.columnId,
      }),
      diagnostics: {
        datasetId: input.dataset.datasetId,
        columnId: input.column.columnId,
        field: 'measurementContext',
      },
    });
  }

  return issues;
}

function createDatasetContextIssues(input: {
  snapshot: WorkspaceSnapshot;
  dataset: Dataset;
  occurredAt: string;
}) {
  if (hasMeaningfulContext(input.dataset.datasetContext)) {
    return [] satisfies IssueRecord[];
  }

  const issueId = semanticIssueId('semantics', input.dataset.datasetId, 'missing-dataset-context');

  return [
    {
      issueId,
      kind: semanticIssueKinds.datasetMissingContext,
      severity: 'warning',
      status: 'open',
      detectedAt: input.occurredAt,
      source: {
        module: 'workspace-kernel',
        entityType: 'dataset-context',
        entityId: input.dataset.datasetId,
      },
      title: 'Dataset context is missing',
      detail: `Dataset "${input.dataset.displayName}" does not yet have graph-ready context notes.`,
      userMessage: `Add dataset context for "${input.dataset.displayName}" when graph readers need source or measurement notes.`,
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: input.snapshot.workspaceId,
        panel: 'semantics',
      },
      repairActions: createSemanticRepairActions({
        issueId,
        workspaceId: input.snapshot.workspaceId,
        datasetId: input.dataset.datasetId,
      }),
      diagnostics: {
        datasetId: input.dataset.datasetId,
        field: 'datasetContext',
      },
    },
  ] satisfies IssueRecord[];
}

function collectGraphSemanticBlockedReasons(graph: WorkspaceSnapshot['graphDefinitions'][number], dataset: Dataset) {
  const columnById = new Map(dataset.columns.map((column) => [column.columnId, column]));
  const assignedRolesByColumnId = new Map<string, string[]>();
  const blockedReasons: string[] = [];
  const affectedColumnIds = new Set<string>();

  Object.entries(graph.roleAssignments).forEach(([role, columnIds]) => {
    columnIds.forEach((columnId) => {
      assignedRolesByColumnId.set(columnId, [...(assignedRolesByColumnId.get(columnId) ?? []), role]);
    });
  });

  assignedRolesByColumnId.forEach((assignedRoles, columnId) => {
    const column = columnById.get(columnId);

    if (!column) {
      return;
    }

    if (column.semanticRole === 'unassigned') {
      affectedColumnIds.add(column.columnId);
      blockedReasons.push(
        `Column "${column.label}" is assigned to graph role "${assignedRoles.join(', ')}" but has no active semantic role.`,
      );
      return;
    }

    const conflictingRoles = assignedRoles.filter((role) => role !== column.semanticRole);

    if (conflictingRoles.length > 0) {
      affectedColumnIds.add(column.columnId);
      blockedReasons.push(
        `Column "${column.label}" is assigned to conflicting graph role "${conflictingRoles.join(', ')}" but its active semantic role is "${column.semanticRole}".`,
      );
    }
  });

  return {
    blockedReasons,
    affectedColumnIds: [...affectedColumnIds],
  };
}

function revalidateGraphsForDataset(input: {
  snapshot: WorkspaceSnapshot;
  dataset: Dataset;
  occurredAt: string;
}) {
  const nextGraphIssues: IssueRecord[] = [];
  const graphDefinitions = input.snapshot.graphDefinitions.map((graph) => {
    if (graph.datasetId !== input.dataset.datasetId) {
      return graph;
    }

    const validation = validateGraphComposition({ graph, dataset: input.dataset });
    const semanticCatalogValidation = selectSemanticGraphCatalogDiagnostics(validation);
    const semanticGraphValidation = collectGraphSemanticBlockedReasons(validation.graph, input.dataset);
    const blockedReasons = [
      ...semanticCatalogValidation.blockedReasons,
      ...semanticGraphValidation.blockedReasons,
    ];
    const affectedColumnIds = [...new Set([
      ...semanticCatalogValidation.affectedColumnIds,
      ...semanticGraphValidation.affectedColumnIds,
    ])];
    const priorIssueIds = graph.issueIds.filter((issueId) => !issueId.startsWith('semantics.'));

    if (blockedReasons.length === 0) {
      return {
        ...validation.graph,
        status: restoreGraphStatusAfterSemanticClear({
          snapshot: input.snapshot,
          graph,
          priorIssueIds,
        }),
        issueIds: priorIssueIds,
      } satisfies typeof graph;
    }

    const issueId = semanticIssueId('semantics', input.dataset.datasetId, graph.graphId, 'graph-invalid');

    nextGraphIssues.push({
      issueId,
      kind: semanticIssueKinds.graphCompositionInvalid,
      severity: 'blocking',
      status: 'open',
      detectedAt: input.occurredAt,
      source: {
        module: 'workspace-kernel',
        entityType: 'graph',
        entityId: graph.graphId,
      },
      title: 'Graph composition needs semantic review',
      detail: blockedReasons.join(' '),
      userMessage: 'A graph that uses this dataset no longer matches the active semantic choices.',
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: input.snapshot.workspaceId,
        graphId: graph.graphId,
        panel: 'semantics',
      },
      repairActions: [
        ...(affectedColumnIds.length > 0
          ? affectedColumnIds.flatMap((columnId) => createSemanticRepairActions({
              issueId,
              workspaceId: input.snapshot.workspaceId,
              datasetId: input.dataset.datasetId,
              columnId,
            }))
          : []),
        createGraphRepairAction(graph.graphId),
      ],
      diagnostics: {
        datasetId: input.dataset.datasetId,
        graphId: graph.graphId,
        blockedReasons,
        affectedColumnIds,
      },
    });

    return {
      ...validation.graph,
      status: validation.graph.status === 'reference' ? 'reference' : 'stale',
      issueIds: [...priorIssueIds, issueId],
    } satisfies typeof graph;
  });

  return { graphDefinitions, nextGraphIssues };
}

function reconcileSemanticIssuesForDataset(input: {
  snapshot: WorkspaceSnapshot;
  dataset: Dataset;
  occurredAt: string;
  scope:
    | { kind: 'all' }
    | { kind: 'column'; columnId: string }
    | { kind: 'dataset-context' };
}) {
  const shouldRevalidateGraphs = input.scope.kind === 'all' || input.scope.kind === 'column';
  const { graphDefinitions, nextGraphIssues } = shouldRevalidateGraphs
    ? revalidateGraphsForDataset(input)
    : { graphDefinitions: input.snapshot.graphDefinitions, nextGraphIssues: [] satisfies IssueRecord[] };
  let columnsToReconcile: DatasetColumn[] = [];

  if (input.scope.kind === 'all') {
    columnsToReconcile = input.dataset.columns;
  } else if (input.scope.kind === 'column') {
    const columnId = input.scope.columnId;
    columnsToReconcile = input.dataset.columns.filter((column) => column.columnId === columnId);
  }
  const semanticIssues = [
    ...columnsToReconcile.flatMap((column) =>
      createColumnSemanticIssues({
        snapshot: input.snapshot,
        dataset: input.dataset,
        column,
        occurredAt: input.occurredAt,
      }),
    ),
    ...(input.scope.kind === 'all' || input.scope.kind === 'dataset-context'
      ? createDatasetContextIssues(input)
      : []),
    ...nextGraphIssues,
  ];
  const existingIssuesById = new Map(input.snapshot.issues.map((issue) => [issue.issueId, issue] as const));
  const issuesToReplace = (issue: IssueRecord) => {
    if (!isSemanticIssueForDataset(issue, input.dataset.datasetId)) {
      return false;
    }

    if (input.scope.kind === 'all') {
      return true;
    }

    if (input.scope.kind === 'column') {
      return isColumnSemanticIssueForDatasetColumn(issue, input.dataset.datasetId, input.scope.columnId)
        || isSemanticGraphIssueForDataset(issue, input.dataset.datasetId);
    }

    return isDatasetContextSemanticIssue(issue, input.dataset.datasetId);
  };
  const issues = [
    ...input.snapshot.issues.filter((issue) => !issuesToReplace(issue)),
    ...semanticIssues.map((issue) => preserveUnresolvedIssueState(issue, existingIssuesById)),
  ];

  return {
    graphDefinitions,
    issues,
    readiness: reconcileReadinessState({ ...input.snapshot, graphDefinitions }, issues),
  } satisfies Pick<WorkspaceSnapshot, 'graphDefinitions' | 'issues' | 'readiness'>;
}

function clonePersistedDatasetFileHandle(entry: PersistedDatasetFileHandle): PersistedDatasetFileHandle {
  return {
    ...entry,
  };
}

function commitSnapshotMutation(
  data: WorkspaceKernelData,
  patch: WorkspaceSnapshotPatch,
  options: {
    type: string;
    meta?: KernelMutationMeta;
    entityRefs?: Record<string, string>;
    payload?: Record<string, unknown>;
    includeTrustImpact?: boolean;
  },
) {
  const nextWorkspaceVersion = data.workspaceVersion + 1;
  const meta = options.meta ?? createDefaultMutationMeta(options.type, data.workspaceVersion);
  const nextSnapshot = workspaceSnapshotSchema.parse({
    ...data.snapshot,
    ...patch,
    updatedAt: meta.occurredAt,
  } satisfies WorkspaceSnapshot);
  const ledgerEntryOptions = {
    data,
    nextSnapshot,
    nextWorkspaceVersion,
    type: options.type,
    meta,
    entityRefs: options.entityRefs ?? {
      workspaceId: nextSnapshot.workspaceId,
    },
    payload: options.payload ?? {},
  };

  return {
    snapshot: nextSnapshot,
    workspaceVersion: nextWorkspaceVersion,
    datasetFileHandles: data.datasetFileHandles,
    pendingWorkerRequests: data.pendingWorkerRequests,
    ledger: [
      ...data.ledger,
      createLedgerEntry({
        ...ledgerEntryOptions,
        ...(options.includeTrustImpact !== undefined
          ? {
              includeTrustImpact: options.includeTrustImpact,
            }
          : {}),
      }),
    ],
  } satisfies WorkspaceKernelData;
}

function reconcileReadinessState(snapshot: WorkspaceSnapshot, issues: IssueRecord[]) {
  const { readiness } = snapshot;
  const previousIssueIds = new Set(snapshot.issues.map((issue) => issue.issueId));
  const hasPreviousBlockingIssue = snapshot.issues.some(
    (issue) => issue.status !== 'resolved' && issue.severity === 'blocking',
  );
  const hasPreviousWarningIssue = snapshot.issues.some(
    (issue) => issue.status !== 'resolved' && issue.severity === 'warning',
  );
  const openBlockingIssueIds = new Set(
    issues.filter((issue) => issue.status !== 'resolved' && issue.severity === 'blocking').map((issue) => issue.issueId),
  );
  const openWarningIssueIds = new Set(
    issues.filter((issue) => issue.status !== 'resolved' && issue.severity === 'warning').map((issue) => issue.issueId),
  );
  const blockingIssueIds = [
    ...new Set([
      ...readiness.blockingIssueIds.filter(
        (issueId) => !previousIssueIds.has(issueId) || openBlockingIssueIds.has(issueId),
      ),
      ...openBlockingIssueIds,
    ]),
  ];
  const warningIssueIds = [
    ...new Set([
      ...readiness.warningIssueIds.filter(
        (issueId) => !previousIssueIds.has(issueId) || openWarningIssueIds.has(issueId),
      ),
      ...openWarningIssueIds,
    ]),
  ];
  const hasExplicitBlockingState = readiness.status === 'blocked' && !hasPreviousBlockingIssue;
  const hasExplicitWarningState =
    readiness.status === 'warning' && readiness.provenanceCompleteness === 'complete' && !hasPreviousWarningIssue;

  return {
    ...readiness,
    status:
      blockingIssueIds.length > 0 || hasExplicitBlockingState
        ? 'blocked'
        : warningIssueIds.length > 0 ||
            hasExplicitWarningState ||
            readiness.provenanceCompleteness !== 'complete'
          ? 'warning'
          : 'ready',
    blockingIssueIds,
    warningIssueIds,
  } satisfies WorkspaceSnapshot['readiness'];
}

export function replaceSnapshotReducer(data: WorkspaceKernelData, input: ReplaceSnapshotInput) {
  const nextDatasetFileHandles = (input.datasetFileHandles ?? []).map((entry) => clonePersistedDatasetFileHandle(entry));
  const parsedSnapshot = workspaceSnapshotSchema.parse(input.snapshot);
  const nextSnapshot =
    input.datasetFileHandles !== undefined
      ? synchronizeDatasetSourceFileMetadata(parsedSnapshot, nextDatasetFileHandles)
      : parsedSnapshot;
  const nextLedger = [...input.ledger];

  validateLedgerOrdering(nextLedger);

  return {
    ...data,
    snapshot: nextSnapshot,
    ledger: nextLedger,
    datasetFileHandles: nextDatasetFileHandles,
    workspaceVersion: initializeWorkspaceVersion(nextLedger),
    pendingWorkerRequests: {},
  } satisfies WorkspaceKernelData;
}

export function replaceDatasetFileHandlesReducer(
  data: WorkspaceKernelData,
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  return {
    ...data,
    snapshot: synchronizeDatasetSourceFileMetadata(data.snapshot, datasetFileHandles),
    datasetFileHandles: datasetFileHandles.map((entry) => clonePersistedDatasetFileHandle(entry)),
  } satisfies WorkspaceKernelData;
}

export function promoteReferenceGraphReducer(data: WorkspaceKernelData, input: PromoteReferenceGraphInput) {
  const graphExists = data.snapshot.graphDefinitions.some((graph) => graph.graphId === input.graphId);

  if (!graphExists) {
    throw new Error(`Unknown graph "${input.graphId}" cannot be promoted.`);
  }

  const previousReferenceGraphId = data.snapshot.referenceGraphId;
  const graphDefinitions = data.snapshot.graphDefinitions.map((graph) => {
    if (graph.graphId === input.graphId) {
      return {
        ...graph,
        status: 'reference',
      } satisfies typeof graph;
    }

    if (graph.graphId === previousReferenceGraphId && graph.graphId !== input.graphId && graph.status === 'reference') {
      return {
        ...graph,
        status: 'candidate',
      } satisfies typeof graph;
    }

    return graph;
  });

  return commitSnapshotMutation(
    data,
    {
      graphDefinitions,
      referenceGraphId: input.graphId,
      exportSummary: {
        ...data.snapshot.exportSummary,
        includedReferenceGraphId: input.graphId,
      },
    },
    {
      type: 'graph.promoted',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        graphId: input.graphId,
        previousReferenceGraphId,
      },
      payload: {
        reason: input.reason ?? 'Reference graph promoted.',
      },
      includeTrustImpact: true,
    },
  );
}

export function replaceIssuesReducer(data: WorkspaceKernelData, issues: IssueRecord[], meta?: KernelMutationMeta) {
  return commitSnapshotMutation(
    data,
    {
      issues,
      readiness: reconcileReadinessState(data.snapshot, issues),
    },
    {
      type: 'issues.updated',
      ...(meta ? { meta } : {}),
      payload: {
        total: issues.length,
      },
      includeTrustImpact: true,
    },
  );
}

export function confirmImportReducer(data: WorkspaceKernelData, input: ConfirmImportInput) {
  if (input.issues.some((issue) => issue.status !== 'resolved' && issue.severity === 'blocking')) {
    throw new Error('Cannot confirm an import while blocking issues remain unresolved.');
  }

  const graphId = input.graphId;
  const canonicalIssues = input.issues.map((issue) => {
    const canonicalIssueId = `${issue.issueId}:${input.dataset.datasetId}`;

    return {
      ...issue,
      issueId: canonicalIssueId,
      source: {
        ...issue.source,
        entityType: 'dataset',
        entityId: input.dataset.datasetId,
      },
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: data.snapshot.workspaceId,
        graphId,
        panel: 'readiness',
      },
      repairActions: [],
    } satisfies IssueRecord;
  });
  const graphIssueIds = canonicalIssues.filter((issue) => issue.status !== 'resolved').map((issue) => issue.issueId);
  const nextIssuesById = new Map<string, IssueRecord>(
    data.snapshot.issues.map((issue) => [issue.issueId, issue] as const),
  );

  canonicalIssues.forEach((issue) => {
    nextIssuesById.set(issue.issueId, issue);
  });

  const nextIssues = Array.from(nextIssuesById.values());
  const nextDatasets = [
    ...data.snapshot.datasets.filter(
      (dataset) => dataset.datasetId !== IMPORT_BOOTSTRAP_DATASET_ID && dataset.datasetId !== input.dataset.datasetId,
    ),
    input.dataset,
  ];
  const nextGraphDefinitions = [
    ...data.snapshot.graphDefinitions
      .filter((graph) => graph.graphId !== IMPORT_BOOTSTRAP_GRAPH_ID && graph.graphId !== graphId)
      .map((graph) => {
        if (graph.graphId === data.snapshot.referenceGraphId && graph.status === 'reference') {
          return {
            ...graph,
            status: 'candidate',
          } satisfies typeof graph;
        }

        return graph;
      }),
    {
      graphId,
      title: `Imported ${input.dataset.displayName}`,
      status: 'reference',
      datasetId: input.dataset.datasetId,
      roleAssignments: {
        x: [],
        y: [],
        color: [],
        size: [],
        facetRow: [],
        facetColumn: [],
      },
      marks: ['point'],
      overlays: [],
      presentation: {},
      issueIds: graphIssueIds,
      evidenceIds: [],
    } satisfies WorkspaceSnapshot['graphDefinitions'][number],
  ];
  const nextSnapshot = {
    ...data.snapshot,
    datasets: nextDatasets,
    graphDefinitions: nextGraphDefinitions,
    activeGraphId: graphId,
    referenceGraphId: graphId,
    issues: nextIssues,
    readiness: {
      ...data.snapshot.readiness,
      provenanceCompleteness: 'none' as const,
    },
    exportSummary: {
      ...data.snapshot.exportSummary,
      includedReferenceGraphId: graphId,
    },
  } satisfies WorkspaceSnapshot;
  const semanticReconciliation = reconcileSemanticIssuesForDataset({
    snapshot: nextSnapshot,
    dataset: input.dataset,
    occurredAt: input.occurredAt,
    scope: { kind: 'all' },
  });

  return commitSnapshotMutation(
    data,
    {
      ...nextSnapshot,
      ...semanticReconciliation,
    },
    {
      type: 'import.confirmed',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        datasetId: input.dataset.datasetId,
        graphId,
      },
      payload: {
        datasetId: input.dataset.datasetId,
        previewId: input.previewId,
        source: input.source,
        repairSelections: input.repairSelections,
        rowCount: input.dataset.rowCount,
        columnCount: input.dataset.columnCount,
      },
      includeTrustImpact: true,
    },
  );
}

export function updateColumnSemanticsReducer(data: WorkspaceKernelData, input: UpdateColumnSemanticsInput) {
  const currentDataset = data.snapshot.datasets.find((dataset) => dataset.datasetId === input.datasetId);
  const previousColumn = currentDataset?.columns.find((column) => column.columnId === input.columnId);

  if (!currentDataset || !previousColumn) {
    throw new Error(`Unknown dataset column "${input.datasetId}/${input.columnId}" cannot be updated.`);
  }

  assertDatasetAcceptsSemanticEdits(currentDataset);

  const updatedColumn = {
    ...previousColumn,
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
    ...(input.semanticRole !== undefined ? { semanticRole: input.semanticRole } : {}),
    ...(input.unit !== undefined ? { unit: input.unit?.trim() ? input.unit.trim() : null } : {}),
    ...(input.measurementContext !== undefined ? { measurementContext: input.measurementContext } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() ? input.description.trim() : null } : {}),
  } satisfies DatasetColumn;
  const updatedDataset = {
    ...currentDataset,
    columns: currentDataset.columns.map((column) => (column.columnId === input.columnId ? updatedColumn : column)),
  } satisfies Dataset;
  const datasets = data.snapshot.datasets.map((dataset) => {
    if (dataset.datasetId !== input.datasetId) {
      return dataset;
    }

    return updatedDataset;
  });

  const nextSnapshot = {
    ...data.snapshot,
    datasets,
  } satisfies WorkspaceSnapshot;
  const semanticReconciliation = reconcileSemanticIssuesForDataset({
    snapshot: nextSnapshot,
    dataset: updatedDataset,
    occurredAt: input.occurredAt,
    scope: { kind: 'column', columnId: input.columnId },
  });
  const previousSemanticPayload: ColumnSemanticLedgerPayload = {};
  const nextSemanticPayload: ColumnSemanticLedgerPayload = {};

  if (input.label !== undefined) {
    previousSemanticPayload.label = previousColumn.label;
    nextSemanticPayload.label = updatedColumn.label;
  }

  if (input.dataType !== undefined) {
    previousSemanticPayload.dataType = previousColumn.dataType;
    nextSemanticPayload.dataType = updatedColumn.dataType;
  }

  if (input.semanticRole !== undefined) {
    previousSemanticPayload.semanticRole = previousColumn.semanticRole;
    nextSemanticPayload.semanticRole = updatedColumn.semanticRole;
  }

  if (input.unit !== undefined) {
    previousSemanticPayload.unit = previousColumn.unit;
    nextSemanticPayload.unit = updatedColumn.unit;
  }

  if (input.measurementContext !== undefined) {
    previousSemanticPayload.measurementContext = previousColumn.measurementContext;
    nextSemanticPayload.measurementContext = updatedColumn.measurementContext;
  }

  if (input.description !== undefined) {
    previousSemanticPayload.description = previousColumn.description ?? null;
    nextSemanticPayload.description = updatedColumn.description ?? null;
  }

  return commitSnapshotMutation(
    data,
    {
      datasets,
      ...semanticReconciliation,
    },
    {
      type: 'dataset.column-semantics.updated',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        datasetId: input.datasetId,
        columnId: input.columnId,
      },
      payload: {
        datasetId: input.datasetId,
        columnId: input.columnId,
        previous: previousSemanticPayload,
        next: nextSemanticPayload,
      },
      includeTrustImpact: true,
    },
  );
}

export function updateDatasetContextReducer(data: WorkspaceKernelData, input: UpdateDatasetContextInput) {
  const currentDataset = data.snapshot.datasets.find((dataset) => dataset.datasetId === input.datasetId);

  if (!currentDataset) {
    throw new Error(`Unknown dataset "${input.datasetId}" cannot be updated.`);
  }

  assertDatasetAcceptsSemanticEdits(currentDataset);

  const previousDatasetContext = currentDataset.datasetContext;
  const updatedDataset = {
    ...currentDataset,
    datasetContext: input.datasetContext,
  } satisfies Dataset;
  const datasets = data.snapshot.datasets.map((dataset) => {
    if (dataset.datasetId !== input.datasetId) {
      return dataset;
    }

    return updatedDataset;
  });

  const nextSnapshot = {
    ...data.snapshot,
    datasets,
  } satisfies WorkspaceSnapshot;
  const semanticReconciliation = reconcileSemanticIssuesForDataset({
    snapshot: nextSnapshot,
    dataset: updatedDataset,
    occurredAt: input.occurredAt,
    scope: { kind: 'dataset-context' },
  });

  return commitSnapshotMutation(
    data,
    {
      datasets,
      ...semanticReconciliation,
    },
    {
      type: 'dataset.context.updated',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        datasetId: input.datasetId,
      },
      payload: {
        datasetId: input.datasetId,
        previous: previousDatasetContext,
        next: input.datasetContext,
      },
      includeTrustImpact: true,
    },
  );
}

export function rollbackConfirmedImportReducer(data: WorkspaceKernelData, input: RollbackConfirmedImportInput) {
  const issueIdsToRemove = new Set(input.issueIds);
  let nextDatasets = data.snapshot.datasets.filter((dataset) => dataset.datasetId !== input.datasetId);

  if (nextDatasets.length === 0) {
    nextDatasets = input.fallbackDatasets;
  }

  let nextGraphDefinitions = data.snapshot.graphDefinitions.filter((graph) => graph.graphId !== input.graphId);

  if (nextGraphDefinitions.length === 0) {
    nextGraphDefinitions = input.fallbackGraphDefinitions;
  }

  const referenceGraphStillExists = nextGraphDefinitions.some((graph) => graph.graphId === data.snapshot.referenceGraphId);
  const fallbackReferenceGraphId = nextGraphDefinitions.some((graph) => graph.graphId === input.previousReferenceGraphId)
    ? input.previousReferenceGraphId
    : (nextGraphDefinitions[0]?.graphId ?? input.previousReferenceGraphId);
  const nextReferenceGraphId = referenceGraphStillExists ? data.snapshot.referenceGraphId : fallbackReferenceGraphId;
  nextGraphDefinitions = nextGraphDefinitions.map((graph) => {
    if (graph.graphId === nextReferenceGraphId) {
      return {
        ...graph,
        status: 'reference',
      } satisfies typeof graph;
    }

    if (graph.status === 'reference') {
      return {
        ...graph,
        status: 'candidate',
      } satisfies typeof graph;
    }

    return graph;
  });

  const activeGraphStillExists = nextGraphDefinitions.some((graph) => graph.graphId === data.snapshot.activeGraphId);
  const fallbackActiveGraphId = nextGraphDefinitions.some((graph) => graph.graphId === input.previousActiveGraphId)
    ? input.previousActiveGraphId
    : nextReferenceGraphId;
  const nextActiveGraphId = activeGraphStillExists ? data.snapshot.activeGraphId : fallbackActiveGraphId;
  const nextIssues = data.snapshot.issues.filter(
    (issue) => !issueIdsToRemove.has(issue.issueId) && !isSemanticIssueForDataset(issue, input.datasetId),
  );
  const nextSnapshot = {
    ...data.snapshot,
    datasets: nextDatasets,
    graphDefinitions: nextGraphDefinitions,
    activeGraphId: nextActiveGraphId,
    referenceGraphId: nextReferenceGraphId,
    issues: nextIssues,
    readiness: {
      ...data.snapshot.readiness,
      provenanceCompleteness: 'none' as const,
    },
    exportSummary: {
      ...data.snapshot.exportSummary,
      includedReferenceGraphId: nextReferenceGraphId,
    },
  } satisfies WorkspaceSnapshot;

  return commitSnapshotMutation(
    data,
    {
      ...nextSnapshot,
      readiness: reconcileReadinessState(
        { ...data.snapshot, graphDefinitions: nextGraphDefinitions, readiness: nextSnapshot.readiness },
        nextIssues,
      ),
    },
    {
      type: 'import.confirmation-rolled-back',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        datasetId: input.datasetId,
        graphId: input.graphId,
      },
      payload: {
        datasetId: input.datasetId,
        graphId: input.graphId,
        issueCount: input.issueIds.length,
      },
      includeTrustImpact: true,
    },
  );
}

export function updateTelemetrySnapshotReducer(
  data: WorkspaceKernelData,
  telemetrySnapshot: WorkspaceSnapshot['telemetrySnapshot'],
  meta: KernelMutationMeta,
) {
  return commitSnapshotMutation(
    data,
    {
      telemetrySnapshot,
    },
    {
      type: 'telemetry.snapshot.updated',
      meta,
      payload: {
        status: telemetrySnapshot.status,
        offlineQueueDepth: telemetrySnapshot.offlineQueueDepth,
        lastGraphRenderMs: telemetrySnapshot.lastGraphRenderMs,
      },
    },
  );
}

export function queueWorkerRequestReducer(data: WorkspaceKernelData, input: QueueWorkerRequestInput) {
  return {
    ...data,
    pendingWorkerRequests: {
      ...data.pendingWorkerRequests,
      [input.correlationId]: {
        correlationId: input.correlationId,
        type: input.type,
        workspaceVersion: data.workspaceVersion,
      },
    },
  } satisfies WorkspaceKernelData;
}

export function applyWorkerEnvelopeReducer<TPayload extends Record<string, unknown>>(
  data: WorkspaceKernelData,
  message: WorkerMessageEnvelope & { payload: TPayload },
  apply: (context: WorkerEnvelopeContext<TPayload>) => WorkspaceSnapshotPatch,
) {
  const request = data.pendingWorkerRequests[message.correlationId];

  if (!request) {
    return {
      nextData: data,
      result: {
        applied: false,
        reason: 'unknown-correlation',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  const pendingWorkerRequests = { ...data.pendingWorkerRequests };
  delete pendingWorkerRequests[message.correlationId];

  if (request.type !== message.type) {
    return {
      nextData: {
        ...data,
        pendingWorkerRequests,
      } satisfies WorkspaceKernelData,
      result: {
        applied: false,
        reason: 'type-mismatch',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  if (request.workspaceVersion !== message.workspaceVersion || data.workspaceVersion !== message.workspaceVersion) {
    return {
      nextData: {
        ...data,
        pendingWorkerRequests,
      } satisfies WorkspaceKernelData,
      result: {
        applied: false,
        reason: 'stale-workspace-version',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  const nextData = commitSnapshotMutation(
    {
      ...data,
      pendingWorkerRequests,
    },
    apply({
      message,
      snapshot: data.snapshot,
      workspaceVersion: data.workspaceVersion,
    }),
    {
      type: message.type,
      meta: {
        actorId: 'worker',
        actorKind: 'system',
        correlationId: message.correlationId,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        messageId: message.messageId,
      },
    },
  );

  return {
    nextData,
    result: {
      applied: true,
    } satisfies ApplyWorkerEnvelopeResult,
  };
}
