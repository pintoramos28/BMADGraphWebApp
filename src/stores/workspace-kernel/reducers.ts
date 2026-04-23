import { workspaceSnapshotSchema } from '../../schemas/workspace';
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
  WorkerEnvelopeContext,
  WorkspaceKernelData,
  WorkspaceSnapshotPatch,
} from './types';
import type { IssueRecord, WorkspaceSnapshot } from '../../schemas/workspace';
import type { WorkerMessageEnvelope } from '../../schemas/worker';

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

  return commitSnapshotMutation(
    data,
    {
      ...nextSnapshot,
      readiness: reconcileReadinessState(nextSnapshot, nextIssues),
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
  const nextIssues = data.snapshot.issues.filter((issue) => !issueIdsToRemove.has(issue.issueId));
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
      readiness: reconcileReadinessState(nextSnapshot, nextIssues),
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
