import { z } from 'zod';

import { compareSemver, matchesVersionRange } from '../../lib/semver';
import { selectSemanticGraphCatalogDiagnostics, validateGraphComposition } from './graph-catalog';
import {
  isCompatibleDatasetFileHandle,
  parsePersistedDatasetFileHandles,
  retainDatasetFileHandlesForSnapshot,
  sanitizePersistedDatasetFileHandlesForHydration,
} from './persisted-dataset-file-handles';
import {
  datasetSchema,
  evidenceSchema,
  exportSummarySchema,
  formulaColumnSchema,
  graphDefinitionSchema,
  issueRecordSchema,
  readinessSchema,
  telemetrySnapshotSchema,
  transformSchema,
  workspaceLedgerEntrySchema,
  workspaceSnapshotSchema,
  type GraphDefinition,
  type IssueRecord,
  type WorkspaceLedgerEntry,
  type WorkspaceSnapshot,
} from '../../schemas/workspace';
import {
  dateVersionSchema,
  identifierSchema,
  isoDateTimeSchema,
  looseObjectSchema,
  nonEmptyStringSchema,
  semverSchema,
  strictObject,
  versionRangeSchema,
} from '../../schemas/validation';
import type {
  PersistedDatasetFileHandle,
  PersistedWorkspaceRecord,
  WorkspaceRepository,
} from '../../services/persistence';
import { createWorkspaceKernelStore, type WorkspaceKernelStore } from '../../stores/workspace-kernel';

export interface WorkspaceCompatibilityEnvelope {
  currentAppBuildVersion: string;
  minimumReadableWorkspaceFormat: string;
  maximumReadableWorkspaceFormat: string;
  migrationPolicy: 'migrate-on-open';
}

export interface WorkspaceReopenBenchmark {
  savedAt: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  issueCount: number;
  benchmarkKey?: string;
  migrationPolicy: WorkspaceCompatibilityEnvelope['migrationPolicy'];
  migrationApplied: boolean;
}

export interface WorkspaceReopenReport {
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedgerEntry[];
  localizedIssues: IssueRecord[];
  benchmark: WorkspaceReopenBenchmark;
}

export interface WorkspaceReopenSession {
  kernelStore: WorkspaceKernelStore;
  report: WorkspaceReopenReport;
}

interface ReopenWorkspaceOptions {
  compatibilityEnvelope: WorkspaceCompatibilityEnvelope;
  now?: () => string;
  nowMs?: () => number;
}

const snapshotEnvelopeSchema = strictObject({
  workspaceId: identifierSchema,
  workspaceFormatVersion: semverSchema,
  appBuildVersion: semverSchema,
  schemaVersion: dateVersionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  compatibility: strictObject({
    minReadableAppBuild: semverSchema,
    maxTestedAppBuild: versionRangeSchema,
  }),
  datasets: z.array(z.unknown()),
  transformPipeline: z.array(z.unknown()),
  formulaColumns: z.array(z.unknown()),
  graphDefinitions: z.array(z.unknown()),
  activeGraphId: z.string(),
  referenceGraphId: z.string(),
  evidence: z.array(z.unknown()),
  issues: z.array(z.unknown()),
  readiness: z.unknown(),
  telemetrySnapshot: z.unknown(),
  exportSummary: z.unknown(),
});

const persistedWorkspaceRecordSchema = strictObject({
  workspaceId: identifierSchema,
  savedAt: isoDateTimeSchema,
  snapshot: looseObjectSchema,
  ledger: z.array(z.unknown()),
  datasetFileHandles: z.array(z.unknown()).optional(),
  benchmarkKey: nonEmptyStringSchema.optional(),
});

interface IssueFactoryInput {
  kind: string;
  severity: IssueRecord['severity'];
  source: IssueRecord['source'];
  title: string;
  detail: string;
  userMessage: string;
  graphId?: string;
  diagnostics?: Record<string, unknown>;
}

type GraphSelectionSlot = 'active' | 'reference';

export function collectAvailableFormulaDependencyIds(input: {
  datasets: WorkspaceSnapshot['datasets'];
  transforms: WorkspaceSnapshot['transformPipeline'];
}) {
  const availableDependencyIds = new Set(
    input.datasets.flatMap((dataset) => dataset.columns.map((column) => column.columnId)),
  );

  input.transforms.forEach((transform) => {
    transform.dependencyMetadata?.producesColumnIds.forEach((columnId) => {
      availableDependencyIds.add(columnId);
    });
  });

  return availableDependencyIds;
}

const reopenIssueIdPattern = /^workspace\.reopen\.(\d+)$/;
const persistentReopenIssueKinds = new Set([
  'workspace.reopen.transform.missing-dataset',
  'workspace.reopen.transform.missing-dependency',
  'workspace.reopen.transform.missing-upstream',
  'workspace.reopen.transform.stale-output',
  'workspace.reopen.graph.incompatible-composition',
]);

function asValidationMessages(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '<root>',
    message: issue.message,
  }));
}

function collectExistingIssueIds(values: unknown[]) {
  const issueIds = new Set<string>();

  values.forEach((value) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const issueId = (value as { issueId?: unknown }).issueId;

    if (typeof issueId === 'string') {
      issueIds.add(issueId);
    }
  });

  return issueIds;
}

function createReopenIssueIdFactory(existingIssueIds: Iterable<string>) {
  const usedIssueIds = new Set(existingIssueIds);
  let nextIssueNumber = 0;

  usedIssueIds.forEach((issueId) => {
    const match = reopenIssueIdPattern.exec(issueId);

    if (!match) {
      return;
    }

    nextIssueNumber = Math.max(nextIssueNumber, Number.parseInt(match[1] ?? '0', 10));
  });

  return () => {
    for (;;) {
      nextIssueNumber += 1;
      const issueId = `workspace.reopen.${String(nextIssueNumber).padStart(3, '0')}`;

      if (usedIssueIds.has(issueId)) {
        continue;
      }

      usedIssueIds.add(issueId);
      return issueId;
    }
  };
}

function isTransientReopenIssue(issue: IssueRecord) {
  return issue.kind.startsWith('workspace.reopen.')
    && issue.source.module === 'workspace-persistence'
    && !persistentReopenIssueKinds.has(issue.kind);
}

function isPersistentReopenIssue(issue: IssueRecord) {
  return issue.source.module === 'workspace-persistence' && persistentReopenIssueKinds.has(issue.kind);
}

function buildPersistentReopenIssueKey(input: Pick<IssueRecord, 'kind' | 'source'>) {
  return `${input.kind}::${input.source.module}::${input.source.entityType}::${input.source.entityId}`;
}

function parseCollection<T>(
  values: unknown[],
  schema: z.ZodType<T>,
  onInvalid: (index: number, error: z.ZodError, value: unknown) => void,
) {
  const accepted: T[] = [];

  values.forEach((value, index) => {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      onInvalid(index, parsed.error, value);
      return;
    }

  accepted.push(parsed.data);
  });

  return accepted;
}

function fallbackEntityId(entityType: string, index: number) {
  return `reopen.${entityType}.${String(index + 1).padStart(3, '0')}`;
}

function normalizeEntityIdCandidate(candidate: string) {
  const normalized = candidate.trim().replace(/[^A-Za-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '');

  return identifierSchema.safeParse(normalized).success ? normalized : null;
}

function extractEntityId(value: unknown, key: string, fallback: string) {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = (value as Record<string, unknown>)[key];

  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return fallback;
  }

  return normalizeEntityIdCandidate(candidate) ?? fallback;
}

function normalizeOptionalContextObject(value: unknown, supportedFields: readonly string[], legacyStringField: string) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? { [legacyStringField]: trimmedValue } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const context = value as Record<string, unknown>;
  const normalizedContext = Object.fromEntries(
    supportedFields.flatMap((field) => {
      const entry = context[field];

      return typeof entry === 'string' && entry.trim().length > 0 ? [[field, entry.trim()]] : [];
    }),
  );
  const hasMeaningfulContext = Object.keys(normalizedContext).length > 0;

  return hasMeaningfulContext ? normalizedContext : null;
}

function backfillDatasetSemanticFields(value: unknown) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const dataset = value as Record<string, unknown>;
  const supportedSemanticRoles = new Set(['unassigned', 'x', 'y', 'color', 'size', 'facetRow', 'facetColumn']);
  const columns = Array.isArray(dataset.columns)
    ? dataset.columns.map((columnValue) => {
        if (!columnValue || typeof columnValue !== 'object') {
          return columnValue;
        }

        const column = columnValue as Record<string, unknown>;
        const sourceName = typeof column.sourceName === 'string' && column.sourceName.trim().length > 0
          ? column.sourceName
          : typeof column.columnId === 'string' && column.columnId.trim().length > 0
            ? column.columnId
            : 'Column';

        return {
          ...column,
          label: typeof column.label === 'string' && column.label.trim().length > 0 ? column.label : sourceName,
          semanticRole: typeof column.semanticRole === 'string' && supportedSemanticRoles.has(column.semanticRole)
            ? column.semanticRole
            : 'unassigned',
          measurementContext: normalizeOptionalContextObject(
            column.measurementContext,
            ['quantity', 'method', 'condition', 'notes'],
            'notes',
          ),
          description: column.description === undefined ? null : column.description,
        };
      })
    : dataset.columns;

  return {
    ...dataset,
    datasetContext: normalizeOptionalContextObject(
      dataset.datasetContext,
      ['description', 'measurementNotes', 'sourceDescription'],
      'description',
    ),
    columns,
  };
}

function createGraphSelectionSource(selection: GraphSelectionSlot): IssueRecord['source'] {
  return {
    module: 'workspace-persistence',
    entityType: 'graph-selection',
    entityId: `${selection}-graph-selection`,
  };
}

function normalizeGraphSelectionId(requestedGraphId: string, selection: GraphSelectionSlot) {
  const normalizedGraphId = normalizeEntityIdCandidate(requestedGraphId);

  return {
    selection,
    requestedGraphId,
    resolutionCandidate: normalizedGraphId ?? requestedGraphId,
    source: createGraphSelectionSource(selection),
    ...(normalizedGraphId && normalizedGraphId !== requestedGraphId
      ? { normalizedRequestedGraphId: normalizedGraphId }
      : {}),
  };
}

function describeGraphSelectionIssue(input: {
  selection: GraphSelectionSlot;
  requestedGraphId: string;
  resolvedGraphId: string;
  normalizedRequestedGraphId?: string;
}) {
  const selectionLabel = input.selection === 'active' ? 'active' : 'reference';

  if (input.normalizedRequestedGraphId && input.normalizedRequestedGraphId === input.resolvedGraphId) {
    return {
      title: `The saved ${selectionLabel} graph selection was normalized during reopen`,
      detail: `Saved ${selectionLabel} graph selection "${input.requestedGraphId}" was normalized to "${input.normalizedRequestedGraphId}" during reopen.`,
      userMessage: `The saved ${selectionLabel} graph selection was normalized to "${input.normalizedRequestedGraphId}" during reopen.`,
    };
  }

  return {
    title: `The saved ${selectionLabel} graph selection could not be restored`,
    detail: `Saved ${selectionLabel} graph selection "${input.requestedGraphId}" could not be restored, so graph "${input.resolvedGraphId}" was selected instead.`,
    userMessage: `The saved ${selectionLabel} graph selection could not be restored. Graph "${input.resolvedGraphId}" was selected instead.`,
  };
}

function createRepairActions(input: {
  issueId: string;
  workspaceId: string;
  source: IssueRecord['source'];
  graphId?: string;
}): IssueRecord['repairActions'] {
  const repairActions: IssueRecord['repairActions'] = [
    {
      actionId: 'repair.focusIssue',
      label: 'Open repair card',
      command: 'repair.focusIssue',
      args: {
        issueId: input.issueId,
        workspaceId: input.workspaceId,
        panel: 'repair',
      },
    },
  ];

  const graphRepairTargetId =
    input.graphId ?? (input.source.entityType === 'graph' ? input.source.entityId : undefined);

  if ((input.source.entityType === 'graph' || input.source.entityType === 'graph-selection') && graphRepairTargetId) {
    repairActions.push({
      actionId: 'repair.focusGraph',
      label: 'Inspect graph',
      command: 'repair.focusGraph',
      args: {
        graphId: graphRepairTargetId,
      },
    });
  }

  if (input.source.entityType === 'formula') {
    repairActions.push({
      actionId: 'repair.focusFormula',
      label: 'Inspect formula',
      command: 'repair.focusFormula',
      args: {
        formulaId: input.source.entityId,
      },
    });
  }

  if (input.source.entityType === 'transform') {
    repairActions.push({
      actionId: 'repair.focusTransform',
      label: 'Inspect transform',
      command: 'repair.focusTransform',
      args: {
        transformId: input.source.entityId,
      },
    });
  }

  if (input.source.entityType === 'dataset') {
    repairActions.push({
      actionId: 'repair.focusDataset',
      label: 'Inspect dataset',
      command: 'repair.focusDataset',
      args: {
        datasetId: input.source.entityId,
      },
    });
  }

  if (input.source.entityType === 'evidence') {
    repairActions.push({
      actionId: 'repair.focusEvidence',
      label: 'Inspect evidence',
      command: 'repair.focusEvidence',
      args: {
        evidenceId: input.source.entityId,
      },
    });
  }

  return repairActions;
}

function semanticIssueId(...parts: string[]) {
  const sanitizedParts = parts.map((part) => part.trim().replace(/[^A-Za-z0-9._:-]+/g, '_')).filter(Boolean);
  const [namespace, ...entityParts] = sanitizedParts;

  return [
    namespace,
    ...entityParts.map((part) => `p${part.length}:${part}`),
  ].filter(Boolean).join('.');
}

function hasMeaningfulSemanticContext(context: Record<string, string | undefined> | null | undefined) {
  return Boolean(context && Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0));
}

function semanticGraphDiagnosticsMatch(existingIssue: IssueRecord, generatedIssue: IssueRecord) {
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

  return existingBlockedReasons.length === generatedBlockedReasons.length
    && existingBlockedReasons.every((reason, index) => reason === generatedBlockedReasons[index])
    && existingAffectedColumnIds.length === generatedAffectedColumnIds.length
    && existingAffectedColumnIds.every((columnId, index) => columnId === generatedAffectedColumnIds[index]);
}

function createReopenSemanticRepairActions(input: {
  issueId: string;
  workspaceId: string;
  datasetId: string;
  columnId?: string;
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

function createReopenGraphRepairAction(graphId: string) {
  return {
    actionId: 'repair.focusGraph',
    label: 'Inspect graph',
    command: 'repair.focusGraph',
    args: {
      graphId,
    },
  } satisfies IssueRecord['repairActions'][number];
}

function collectReopenGraphSemanticBlockedReasons(graph: GraphDefinition, dataset: WorkspaceSnapshot['datasets'][number]) {
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

function createReopenSemanticState(input: {
  workspaceId: string;
  referenceGraphId: string;
  datasets: WorkspaceSnapshot['datasets'];
  graphDefinitions: GraphDefinition[];
  occurredAt: string;
  existingIssues: IssueRecord[];
}) {
  const generatedIssueIds = new Set<string>();
  const existingSemanticIssuesById = new Map(
    input.existingIssues
      .filter((issue) => issue.kind.startsWith('semantics.'))
      .map((issue) => [issue.issueId, issue] as const),
  );
  const semanticIssues: IssueRecord[] = [];
  const pushIssue = (issue: IssueRecord) => {
    if (generatedIssueIds.has(issue.issueId)) {
      return issue.issueId;
    }

    generatedIssueIds.add(issue.issueId);

    const existingIssue = existingSemanticIssuesById.get(issue.issueId);

    if (!existingIssue || existingIssue.status === 'resolved') {
      semanticIssues.push(issue);
      return issue.issueId;
    }

    if (issue.kind === 'semantics.graph.composition-invalid' && !semanticGraphDiagnosticsMatch(existingIssue, issue)) {
      semanticIssues.push(issue);
      return issue.issueId;
    }

    semanticIssues.push({
      ...issue,
      status: existingIssue.status,
      detectedAt: existingIssue.detectedAt,
    });

    return issue.issueId;
  };

  const semanticDatasets = input.datasets.filter(
    (dataset) => dataset.sourceKind !== 'import-preview' && dataset.sourceKind !== 'recovery',
  );
  const existingIssueIds = new Set(input.existingIssues.map((issue) => issue.issueId));
  const restoreGraphStatusAfterSemanticClear = (graph: GraphDefinition, priorIssueIds: string[]) => {
    const hadSemanticIssue = graph.issueIds.some((issueId) => issueId.startsWith('semantics.'));
    const remainingNonSemanticIssueIds = priorIssueIds.filter((issueId) => existingIssueIds.has(issueId));

    if (graph.status !== 'stale' || remainingNonSemanticIssueIds.length > 0 || !hadSemanticIssue) {
      return graph.status;
    }

    return input.referenceGraphId === graph.graphId ? 'reference' : 'candidate';
  };

  semanticDatasets.forEach((dataset) => {
    dataset.columns.forEach((column) => {
      if (column.semanticRole === 'unassigned') {
        const issueId = semanticIssueId('semantics', dataset.datasetId, column.columnId, 'missing-role');

        pushIssue(issueRecordSchema.parse({
          issueId,
          kind: 'semantics.column.missing-role',
          severity: 'warning',
          status: 'open',
          detectedAt: input.occurredAt,
          source: {
            module: 'workspace-kernel',
            entityType: 'dataset-column',
            entityId: column.columnId,
          },
          title: 'Column semantic role is not assigned',
          detail: `Column "${column.label}" in dataset "${dataset.displayName}" is not assigned to an analytical role.`,
          userMessage: `Assign an analytical role for "${column.label}" before graphing begins.`,
          contextRef: {
            routeKey: 'workspaceDetail',
            workspaceId: input.workspaceId,
            panel: 'semantics',
          },
          repairActions: createReopenSemanticRepairActions({
            issueId,
            workspaceId: input.workspaceId,
            datasetId: dataset.datasetId,
            columnId: column.columnId,
          }),
          diagnostics: {
            datasetId: dataset.datasetId,
            columnId: column.columnId,
            field: 'semanticRole',
          },
        }));
      }

      if (!hasMeaningfulSemanticContext(column.measurementContext)) {
        const issueId = semanticIssueId('semantics', dataset.datasetId, column.columnId, 'missing-context');

        pushIssue(issueRecordSchema.parse({
          issueId,
          kind: 'semantics.column.missing-context',
          severity: 'warning',
          status: 'open',
          detectedAt: input.occurredAt,
          source: {
            module: 'workspace-kernel',
            entityType: 'dataset-column',
            entityId: column.columnId,
          },
          title: 'Column measurement context is missing',
          detail: `Column "${column.label}" does not yet describe how its measurement should be interpreted.`,
          userMessage: `Add measurement context for "${column.label}" when this meaning should be defensible.`,
          contextRef: {
            routeKey: 'workspaceDetail',
            workspaceId: input.workspaceId,
            panel: 'semantics',
          },
          repairActions: createReopenSemanticRepairActions({
            issueId,
            workspaceId: input.workspaceId,
            datasetId: dataset.datasetId,
            columnId: column.columnId,
          }),
          diagnostics: {
            datasetId: dataset.datasetId,
            columnId: column.columnId,
            field: 'measurementContext',
          },
        }));
      }
    });

    if (!hasMeaningfulSemanticContext(dataset.datasetContext)) {
      const issueId = semanticIssueId('semantics', dataset.datasetId, 'missing-dataset-context');

      pushIssue(issueRecordSchema.parse({
        issueId,
        kind: 'semantics.dataset.missing-context',
        severity: 'warning',
        status: 'open',
        detectedAt: input.occurredAt,
        source: {
          module: 'workspace-kernel',
          entityType: 'dataset-context',
          entityId: dataset.datasetId,
        },
        title: 'Dataset context is missing',
        detail: `Dataset "${dataset.displayName}" does not yet have graph-ready context notes.`,
        userMessage: `Add dataset context for "${dataset.displayName}" when graph readers need source or measurement notes.`,
        contextRef: {
          routeKey: 'workspaceDetail',
          workspaceId: input.workspaceId,
          panel: 'semantics',
        },
        repairActions: createReopenSemanticRepairActions({
          issueId,
          workspaceId: input.workspaceId,
          datasetId: dataset.datasetId,
        }),
        diagnostics: {
          datasetId: dataset.datasetId,
          field: 'datasetContext',
        },
      }));
    }
  });

  const datasetById = new Map(semanticDatasets.map((dataset) => [dataset.datasetId, dataset] as const));
  const graphDefinitions = input.graphDefinitions.map((graph) => {
    const priorIssueIds = graph.issueIds.filter((issueId) => !issueId.startsWith('semantics.'));
    const dataset = datasetById.get(graph.datasetId);

    if (!dataset) {
      return {
        ...graph,
        issueIds: priorIssueIds,
      } satisfies GraphDefinition;
    }

    const graphValidation = validateGraphComposition({ graph, dataset });
    const semanticCatalogValidation = selectSemanticGraphCatalogDiagnostics(graphValidation);
    const semanticGraphValidation = collectReopenGraphSemanticBlockedReasons(graphValidation.graph, dataset);
    const blockedReasons = [
      ...semanticCatalogValidation.blockedReasons,
      ...semanticGraphValidation.blockedReasons,
    ];
    const affectedColumnIds = [...new Set([
      ...semanticCatalogValidation.affectedColumnIds,
      ...semanticGraphValidation.affectedColumnIds,
    ])];

    if (blockedReasons.length === 0) {
      return {
        ...graphValidation.graph,
        status: restoreGraphStatusAfterSemanticClear(graph, priorIssueIds),
        issueIds: priorIssueIds,
      } satisfies GraphDefinition;
    }

    const issueId = semanticIssueId('semantics', dataset.datasetId, graph.graphId, 'graph-invalid');

    pushIssue(issueRecordSchema.parse({
      issueId,
      kind: 'semantics.graph.composition-invalid',
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
        workspaceId: input.workspaceId,
        graphId: graph.graphId,
        panel: 'semantics',
      },
      repairActions: [
        ...affectedColumnIds.flatMap((columnId) => createReopenSemanticRepairActions({
          issueId,
          workspaceId: input.workspaceId,
          datasetId: dataset.datasetId,
          columnId,
        })),
        createReopenGraphRepairAction(graph.graphId),
      ],
      diagnostics: {
        datasetId: dataset.datasetId,
        graphId: graph.graphId,
        blockedReasons,
        affectedColumnIds,
      },
    }));

    return {
      ...graphValidation.graph,
      status: graphValidation.graph.status === 'reference' ? 'reference' : 'stale',
      issueIds: [...new Set([...priorIssueIds, issueId])],
    } satisfies GraphDefinition;
  });

  return {
    graphDefinitions,
    issues: semanticIssues,
  };
}

function resolveGraphId(
  requestedGraphId: string,
  validGraphIds: string[],
  distinctFrom?: string,
): string {
  if (validGraphIds.includes(requestedGraphId)) {
    return requestedGraphId;
  }

  const resolvedGraphId = validGraphIds.find((graphId) => graphId !== distinctFrom) ?? validGraphIds[0];

  if (!resolvedGraphId) {
    throw new Error('Expected at least one valid graph definition during workspace reopen.');
  }

  return resolvedGraphId;
}

function createRecoveryDatasetId(workspaceId: string) {
  return `dataset_recovery_${workspaceId}`;
}

function createRecoveryGraphId(workspaceId: string) {
  return `graph_recovery_${workspaceId}`;
}

function createRecoveryDataset(workspaceId: string): WorkspaceSnapshot['datasets'][number] {
  return datasetSchema.parse({
    datasetId: createRecoveryDatasetId(workspaceId),
    displayName: 'Recovery Workspace',
    datasetContext: null,
    sourceKind: 'recovery',
    fingerprint: `sha256:${'0'.repeat(64)}`,
    rowCount: 0,
    columnCount: 0,
    columns: [],
  });
}

function createRecoveryGraph(input: {
  workspaceId: string;
  datasetId: string;
  issueId: string;
}): GraphDefinition {
  return graphDefinitionSchema.parse({
    graphId: createRecoveryGraphId(input.workspaceId),
    title: 'Recovery Required',
    status: 'candidate',
    datasetId: input.datasetId,
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
    issueIds: [input.issueId],
    evidenceIds: [],
  });
}

export function reopenPersistedWorkspaceRecord(
  record: PersistedWorkspaceRecord,
  options: ReopenWorkspaceOptions,
): WorkspaceReopenReport {
  const now = options.now ?? (() => new Date().toISOString());
  const nowMs = options.nowMs ?? (() => Date.now());
  const startedAt = now();
  const startedMs = nowMs();
  const persisted = persistedWorkspaceRecordSchema.parse(record);
  const snapshotInput = snapshotEnvelopeSchema.parse(persisted.snapshot);
  const nextReopenIssueId = createReopenIssueIdFactory(collectExistingIssueIds(snapshotInput.issues));
  const localizedIssues: IssueRecord[] = [];
  let persistentIssueMatches = new Map<string, IssueRecord>();
  let invalidDatasetCount = 0;

  const createIssue = (input: IssueFactoryInput) => {
    const persistentIssueKey = buildPersistentReopenIssueKey({
      kind: input.kind,
      source: input.source,
    });
    const persistedIssue = persistentIssueMatches.get(persistentIssueKey);
    const shouldReusePersistedIssue =
      persistedIssue !== undefined && (persistedIssue.status === 'open' || persistedIssue.status === 'deferred');
    const issueId = persistedIssue?.issueId ?? nextReopenIssueId();

    if (persistedIssue) {
      persistentIssueMatches.delete(persistentIssueKey);
    }

    const nextIssue = issueRecordSchema.parse({
      issueId,
      kind: input.kind,
      severity: input.severity,
      status: shouldReusePersistedIssue ? persistedIssue.status : 'open',
      detectedAt: shouldReusePersistedIssue ? persistedIssue.detectedAt : startedAt,
      source: input.source,
      title: input.title,
      detail: input.detail,
      userMessage: input.userMessage,
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: snapshotInput.workspaceId,
        ...(input.graphId ? { graphId: input.graphId } : {}),
        panel: 'repair',
      },
      repairActions: createRepairActions({
        issueId,
        workspaceId: snapshotInput.workspaceId,
        source: input.source,
        ...(input.graphId ? { graphId: input.graphId } : {}),
      }),
      diagnostics: input.diagnostics ?? {},
    });

    localizedIssues.push(nextIssue);

    return nextIssue;
  };
  const parsedPersistedIssues = parseCollection(snapshotInput.issues, issueRecordSchema, (index, error, value) => {
    createIssue({
      kind: 'workspace.reopen.issue.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'issue-record',
        entityId: extractEntityId(value, 'issueId', fallbackEntityId('issue', index)),
      },
      title: 'A saved issue record could not be reopened',
      detail: `Issue entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One saved issue record could not be reopened.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  persistentIssueMatches = new Map(
    parsedPersistedIssues
      .filter((issue) => isPersistentReopenIssue(issue))
      .map((issue) => [buildPersistentReopenIssueKey(issue), issue]),
  );
  const basePersistedIssues = parsedPersistedIssues.filter(
    (issue) => !isTransientReopenIssue(issue) && !isPersistentReopenIssue(issue) && !issue.kind.startsWith('semantics.'),
  );

  let datasets = parseCollection(snapshotInput.datasets.map(backfillDatasetSemanticFields), datasetSchema, (index, error, value) => {
    invalidDatasetCount += 1;
    createIssue({
      kind: 'workspace.reopen.dataset.invalid-contract',
      severity: 'blocking',
      source: {
        module: 'workspace-persistence',
        entityType: 'dataset',
        entityId: extractEntityId(value, 'datasetId', fallbackEntityId('dataset', index)),
      },
      title: 'Dataset data could not be reopened',
      detail: `Dataset entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One dataset entry could not be reopened. The rest of the workspace remains available.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  const persistedDatasetFileHandles = parsePersistedDatasetFileHandles(persisted.datasetFileHandles ?? []);

  datasets.forEach((dataset) => {
    if (!dataset.sourceFile) {
      return;
    }

    const persistedHandle = persistedDatasetFileHandles.find((entry) => isCompatibleDatasetFileHandle(dataset, entry));

    if (persistedHandle) {
      return;
    }

    createIssue({
      kind: 'workspace.reopen.dataset.missing-file-handle',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'dataset',
        entityId: dataset.datasetId,
      },
      title: 'A reopened dataset lost its source file handle',
      detail: `Dataset "${dataset.displayName}" expects source file handle "${dataset.sourceFile.fileHandleToken}", but no compatible persisted handle was available during reopen.`,
      userMessage:
        `The source file handle for dataset "${dataset.sourceFile.fileName}" is missing. The dataset remains available, but it may need to be re-linked before source-backed repairs can continue.`,
      diagnostics: {
        datasetId: dataset.datasetId,
        fileName: dataset.sourceFile.fileName,
        fileHandleToken: dataset.sourceFile.fileHandleToken,
      },
    });
  });

  const datasetIds = new Set(datasets.map((dataset) => dataset.datasetId));
  const datasetColumns = new Map(
    datasets.map((dataset) => [dataset.datasetId, new Set(dataset.columns.map((column) => column.columnId))]),
  );
  const availableDatasetColumnIds = new Set(
    datasets.flatMap((dataset) => dataset.columns.map((column) => column.columnId)),
  );
  const parsedTransforms = parseCollection(snapshotInput.transformPipeline, transformSchema, (index, error, value) => {
    createIssue({
      kind: 'workspace.reopen.transform.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'transform',
        entityId: extractEntityId(value, 'transformId', fallbackEntityId('transform', index)),
      },
      title: 'A saved transform could not be reopened',
      detail: `Transform entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One transform could not be reopened. Valid analysis state is still available.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  const transforms =
    availableDatasetColumnIds.size > 0
      ? (() => {
          const retainedTransforms: typeof parsedTransforms = [];
          const retainedTransformIds = new Set<string>();

          parsedTransforms.forEach((transform) => {
            const dependencyMetadata = transform.dependencyMetadata;

            if (!dependencyMetadata) {
              if (invalidDatasetCount > 0) {
                createIssue({
                  kind: 'workspace.reopen.transform.dataset-loss',
                  severity: 'warning',
                  source: {
                    module: 'workspace-persistence',
                    entityType: 'transform',
                    entityId: transform.transformId,
                  },
                  title: 'A saved transform could not be reopened after dataset validation failed',
                  detail: `Transform "${transform.transformId}" was excluded because dataset validation left reopen without enough metadata to confirm its dataset source safely.`,
                  userMessage: 'One saved transform was excluded because the reopened dataset state is incomplete.',
                  diagnostics: {
                    transformId: transform.transformId,
                    invalidDatasetCount,
                    availableDatasetCount: datasets.length,
                  },
                });
                return;
              }

              retainedTransforms.push(transform);
              retainedTransformIds.add(transform.transformId);
              return;
            }

            if (!datasetIds.has(dependencyMetadata.datasetId)) {
              createIssue({
                kind: 'workspace.reopen.transform.missing-dataset',
                severity: 'warning',
                source: {
                  module: 'workspace-persistence',
                  entityType: 'transform',
                  entityId: transform.transformId,
                },
                title: 'A saved transform references an unavailable dataset',
                detail: `Transform "${transform.transformId}" depends on dataset "${dependencyMetadata.datasetId}", which is unavailable after reopen validation.`,
                userMessage: 'One saved transform references a dataset that is no longer available and was excluded from reopen state.',
                diagnostics: {
                  transformId: transform.transformId,
                  datasetId: dependencyMetadata.datasetId,
                },
              });
              return;
            }

            const missingUpstreamTransformIds = dependencyMetadata.upstreamTransformIds.filter(
              (transformId) => !retainedTransformIds.has(transformId),
            );

            if (missingUpstreamTransformIds.length > 0) {
              createIssue({
                kind: 'workspace.reopen.transform.missing-upstream',
                severity: 'warning',
                source: {
                  module: 'workspace-persistence',
                  entityType: 'transform',
                  entityId: transform.transformId,
                },
                title: 'A saved transform depends on an unavailable prior step',
                detail: `Transform "${transform.transformId}" depends on earlier transform steps that could not be reopened safely.`,
                userMessage: 'One saved transform depends on an unavailable earlier step and was excluded from reopen state.',
                diagnostics: {
                  transformId: transform.transformId,
                  upstreamTransformIds: dependencyMetadata.upstreamTransformIds,
                  missingUpstreamTransformIds,
                },
              });
              return;
            }

            const availableColumns = datasetColumns.get(dependencyMetadata.datasetId) ?? new Set<string>();
            const missingDependencies = dependencyMetadata.dependsOnColumnIds.filter(
              (columnId) => !availableColumns.has(columnId),
            );

            if (missingDependencies.length > 0) {
              createIssue({
                kind: 'workspace.reopen.transform.missing-dependency',
                severity: 'warning',
                source: {
                  module: 'workspace-persistence',
                  entityType: 'transform',
                  entityId: transform.transformId,
                },
                title: 'A saved transform references unavailable columns',
                detail: `Transform "${transform.transformId}" depends on columns that are unavailable in the reopened workspace.`,
                userMessage: 'One saved transform references unavailable columns and was excluded from reopen state.',
                diagnostics: {
                  transformId: transform.transformId,
                  datasetId: dependencyMetadata.datasetId,
                  missingDependencies,
                },
              });
              return;
            }

            retainedTransforms.push(transform);
            retainedTransformIds.add(transform.transformId);
            dependencyMetadata.producesColumnIds.forEach((columnId) => {
              availableColumns.add(columnId);
            });
          });

          return retainedTransforms;
        })()
      : parsedTransforms.filter((transform) => {
          createIssue({
            kind: 'workspace.reopen.transform.dataset-loss',
            severity: 'warning',
            source: {
              module: 'workspace-persistence',
              entityType: 'transform',
              entityId: transform.transformId,
            },
            title: 'A saved transform could not be reopened after dataset validation failed',
            detail: `Transform "${transform.transformId}" was excluded because dataset validation left the workspace without a safe transform source of truth.`,
            userMessage: 'One saved transform was excluded because the reopened dataset state is incomplete.',
            diagnostics: {
              transformId: transform.transformId,
              invalidDatasetCount,
              availableDatasetCount: datasets.length,
            },
          });

          return false;
        });
  const parsedFormulaColumns = parseCollection(snapshotInput.formulaColumns, formulaColumnSchema, (index, error, value) => {
    createIssue({
      kind: 'workspace.reopen.formula.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'formula',
        entityId: extractEntityId(value, 'formulaId', fallbackEntityId('formula', index)),
      },
      title: 'A saved formula could not be reopened',
      detail: `Formula entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One formula could not be reopened. Valid analysis state is still available.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  const formulaColumns = [] as typeof parsedFormulaColumns;
  const unresolvedFormulaColumns = [...parsedFormulaColumns];
  const availableFormulaDependencyIds = collectAvailableFormulaDependencyIds({
    datasets,
    transforms,
  });
  let madeFormulaProgress = true;

  while (unresolvedFormulaColumns.length > 0 && madeFormulaProgress) {
    madeFormulaProgress = false;

    for (let index = unresolvedFormulaColumns.length - 1; index >= 0; index -= 1) {
      const formula = unresolvedFormulaColumns[index];

      if (!formula) {
        continue;
      }

      const missingDependencies = formula.dependsOn.filter((dependency) => !availableFormulaDependencyIds.has(dependency));

      if (missingDependencies.length > 0) {
        continue;
      }

      formulaColumns.push(formula);
      availableFormulaDependencyIds.add(formula.columnId);
      unresolvedFormulaColumns.splice(index, 1);
      madeFormulaProgress = true;
    }
  }

  unresolvedFormulaColumns.forEach((formula) => {
    const missingDependencies = formula.dependsOn.filter((dependency) => !availableFormulaDependencyIds.has(dependency));

    createIssue({
      kind: 'workspace.reopen.formula.missing-dependency',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'formula',
        entityId: formula.formulaId,
      },
      title: 'A saved formula references unavailable dependencies',
      detail: `Formula "${formula.formulaId}" depends on columns that are unavailable in the reopened workspace.`,
      userMessage: 'One saved formula references unavailable dependencies and was excluded from reopen state.',
      diagnostics: {
        formulaId: formula.formulaId,
        missingDependencies,
      },
    });
  });
  const parsedEvidence = parseCollection(snapshotInput.evidence, evidenceSchema, (index, error, value) => {
    createIssue({
      kind: 'workspace.reopen.evidence.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'evidence',
        entityId: extractEntityId(value, 'evidenceId', fallbackEntityId('evidence', index)),
      },
      title: 'Saved evidence could not be reopened',
      detail: `Evidence entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One evidence entry could not be reopened. Valid analysis state is still available.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  const parsedGraphs = parseCollection(snapshotInput.graphDefinitions, graphDefinitionSchema, (index, error, value) => {
    createIssue({
      kind: 'workspace.reopen.graph.invalid-contract',
      severity: 'blocking',
      source: {
        module: 'workspace-persistence',
        entityType: 'graph',
        entityId: extractEntityId(value, 'graphId', fallbackEntityId('graph', index)),
      },
      title: 'A saved graph definition could not be reopened',
      detail: `Graph entry ${index + 1} is invalid and was excluded from the reopened workspace.`,
      userMessage: 'One graph could not be reopened. Remaining graphs are still available.',
      diagnostics: {
        index,
        issues: asValidationMessages(error),
      },
    });
  });
  const graphReopenState = parsedGraphs.reduce<{
    graphDefinitions: GraphDefinition[];
    recoverableGraphIds: Set<string>;
  }>((state, graph) => {
    if (!datasetIds.has(graph.datasetId)) {
      createIssue({
        kind: 'workspace.reopen.graph.missing-dataset',
        severity: 'blocking',
        source: {
          module: 'workspace-persistence',
          entityType: 'graph',
          entityId: graph.graphId,
        },
        title: 'A reopened graph references a missing dataset',
        detail: `Graph "${graph.title}" references dataset "${graph.datasetId}", which is unavailable in the reopened workspace.`,
        userMessage: 'One graph depends on a dataset that is no longer available. Other saved work remains available.',
        graphId: graph.graphId,
        diagnostics: {
          datasetId: graph.datasetId,
        },
      });
      return state;
    }

    const availableColumns = datasetColumns.get(graph.datasetId) ?? new Set<string>();
    const missingColumns = Object.values(graph.roleAssignments)
      .flat()
      .filter((columnId) => !availableColumns.has(columnId));

    if (missingColumns.length > 0) {
      createIssue({
        kind: 'workspace.reopen.graph.missing-column',
        severity: 'blocking',
        source: {
          module: 'workspace-persistence',
          entityType: 'graph',
          entityId: graph.graphId,
        },
        title: 'A reopened graph references missing columns',
        detail: `Graph "${graph.title}" references columns that are unavailable in the reopened dataset.`,
        userMessage: 'One graph references columns that are no longer available. Other saved work remains available.',
        graphId: graph.graphId,
        diagnostics: {
          datasetId: graph.datasetId,
          missingColumns,
        },
      });
      return state;
    }

    const dataset = datasets.find((entry) => entry.datasetId === graph.datasetId);

    if (!dataset) {
      return state;
    }

    const graphValidation = validateGraphComposition({
      graph,
      dataset,
    });

    if (graphValidation.blockedReasons.length > 0) {
      const semanticGraphCatalogDiagnostics = selectSemanticGraphCatalogDiagnostics(graphValidation);
      const semanticGraphCatalogBlockedReasons = semanticGraphCatalogDiagnostics.blockedReasons;
      const nonSemanticGraphCatalogBlockedReasons = graphValidation.blockedReasons.filter(
        (reason) => !semanticGraphCatalogBlockedReasons.includes(reason),
      );

      if (
        dataset.sourceKind !== 'import-preview'
        && dataset.sourceKind !== 'recovery'
        &&
        graphValidation.affectedColumnIds.length > 0
        && semanticGraphCatalogBlockedReasons.length > 0
      ) {
        const catalogIssue = nonSemanticGraphCatalogBlockedReasons.length > 0
          ? createIssue({
              kind: 'workspace.reopen.graph.incompatible-composition',
              severity: 'blocking',
              source: {
                module: 'workspace-persistence',
                entityType: 'graph',
                entityId: graph.graphId,
              },
              title: 'A reopened graph is incompatible with the locked graph catalog',
              detail: `Graph "${graph.title}" violates the locked graph catalog or current analytical context and was retained as a stale repair scope during reopen.`,
              userMessage:
                'One saved graph is incompatible with the current analytical context. It remains available as a stale repair scope while valid graphs stay usable.',
              graphId: graph.graphId,
              diagnostics: {
                datasetId: graph.datasetId,
                family: graphValidation.graph.family ?? null,
                templateId: graphValidation.graph.templateId ?? null,
                blockedReasons: nonSemanticGraphCatalogBlockedReasons,
                affectedColumnIds: graphValidation.affectedColumnIds.filter(
                  (columnId) => !semanticGraphCatalogDiagnostics.affectedColumnIds.includes(columnId),
                ),
              },
            })
          : null;

        state.graphDefinitions.push({
          ...graphValidation.graph,
          status: graphValidation.graph.status === 'reference' ? 'reference' : 'stale',
          issueIds: [
            ...graphValidation.graph.issueIds.filter((issueId) => !issueId.startsWith('semantics.')),
            ...(catalogIssue ? [catalogIssue.issueId] : []),
          ],
        });
        return state;
      }

      const issue = createIssue({
        kind: 'workspace.reopen.graph.incompatible-composition',
        severity: 'blocking',
        source: {
          module: 'workspace-persistence',
          entityType: 'graph',
          entityId: graph.graphId,
        },
        title: 'A reopened graph is incompatible with the locked graph catalog',
        detail: `Graph "${graph.title}" violates the locked graph catalog or current analytical context and was retained as a stale repair scope during reopen.`,
        userMessage:
          'One saved graph is incompatible with the current analytical context. It remains available as a stale repair scope while valid graphs stay usable.',
        graphId: graph.graphId,
        diagnostics: {
          datasetId: graph.datasetId,
          family: graphValidation.graph.family ?? null,
          templateId: graphValidation.graph.templateId ?? null,
          blockedReasons: graphValidation.blockedReasons,
          affectedColumnIds: graphValidation.affectedColumnIds,
        },
      });
      state.graphDefinitions.push({
        ...graphValidation.graph,
        status: 'stale',
        issueIds: [...new Set([...graphValidation.graph.issueIds, issue.issueId])],
      });
      return state;
    }

    state.graphDefinitions.push(graphValidation.graph);
    state.recoverableGraphIds.add(graphValidation.graph.graphId);
    return state;
  }, {
    graphDefinitions: [],
    recoverableGraphIds: new Set<string>(),
  });
  let graphDefinitions = graphReopenState.graphDefinitions;
  const recoverableGraphIds = graphReopenState.recoverableGraphIds;

  if (recoverableGraphIds.size === 0) {
    const recoveryIssue = createIssue({
      kind: 'workspace.reopen.graph.none-recoverable',
      severity: 'blocking',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'Saved graphs could not be reopened',
      detail:
        'All saved graph definitions failed reopen validation for active use. A placeholder recovery graph was created so the workspace can open in a blocked repair state.',
      userMessage:
        'Saved graphs could not be reopened. The workspace was opened in a blocked recovery state so you can inspect issues and repair the session.',
      graphId: createRecoveryGraphId(snapshotInput.workspaceId),
    });

    if (datasets.length === 0) {
      datasets = [createRecoveryDataset(snapshotInput.workspaceId)];
    }

    const recoveryGraph = createRecoveryGraph({
      workspaceId: snapshotInput.workspaceId,
      datasetId: datasets[0]?.datasetId ?? createRecoveryDatasetId(snapshotInput.workspaceId),
      issueId: recoveryIssue.issueId,
    });

    graphDefinitions = [...graphDefinitions, recoveryGraph];
    recoverableGraphIds.add(recoveryGraph.graphId);
  }

  const availableGraphIds = new Set(graphDefinitions.map((graph) => graph.graphId));
  const evidence = parsedEvidence.filter((entry) => {
    if (availableGraphIds.has(entry.graphId)) {
      return true;
    }

    createIssue({
      kind: 'workspace.reopen.evidence.orphaned-graph',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'evidence',
        entityId: entry.evidenceId,
      },
      title: 'Saved evidence references a graph that could not be reopened',
      detail: `Evidence "${entry.evidenceId}" references graph "${entry.graphId}", which is unavailable after reopen validation.`,
      userMessage: 'One saved evidence entry references a graph that could not be reopened and was excluded from reopen state.',
      diagnostics: {
        evidenceId: entry.evidenceId,
        graphId: entry.graphId,
      },
    });

    return false;
  });

  const requestedActiveGraphSelection = normalizeGraphSelectionId(snapshotInput.activeGraphId, 'active');
  const requestedReferenceGraphSelection = normalizeGraphSelectionId(snapshotInput.referenceGraphId, 'reference');
  const activeGraphId = resolveGraphId(
    requestedActiveGraphSelection.resolutionCandidate,
    [...recoverableGraphIds],
    requestedReferenceGraphSelection.resolutionCandidate,
  );

  if (
    requestedActiveGraphSelection.normalizedRequestedGraphId
    || activeGraphId !== requestedActiveGraphSelection.resolutionCandidate
  ) {
    const graphSelectionIssue = describeGraphSelectionIssue({
      selection: requestedActiveGraphSelection.selection,
      requestedGraphId: snapshotInput.activeGraphId,
      resolvedGraphId: activeGraphId,
      ...(requestedActiveGraphSelection.normalizedRequestedGraphId
        ? { normalizedRequestedGraphId: requestedActiveGraphSelection.normalizedRequestedGraphId }
        : {}),
    });

    createIssue({
      kind: 'workspace.reopen.graph.invalid-selection',
      severity: 'warning',
      source: requestedActiveGraphSelection.source,
      title: graphSelectionIssue.title,
      detail: graphSelectionIssue.detail,
      userMessage: graphSelectionIssue.userMessage,
      graphId: activeGraphId,
      diagnostics: {
        selection: requestedActiveGraphSelection.selection,
        requestedGraphId: snapshotInput.activeGraphId,
        ...(requestedActiveGraphSelection.normalizedRequestedGraphId
          ? { normalizedRequestedGraphId: requestedActiveGraphSelection.normalizedRequestedGraphId }
          : {}),
        resolvedGraphId: activeGraphId,
      },
    });
  }

  const referenceGraphId = resolveGraphId(
    requestedReferenceGraphSelection.resolutionCandidate,
    [...recoverableGraphIds],
    activeGraphId,
  );

  if (
    requestedReferenceGraphSelection.normalizedRequestedGraphId
    || referenceGraphId !== requestedReferenceGraphSelection.resolutionCandidate
  ) {
    const graphSelectionIssue = describeGraphSelectionIssue({
      selection: requestedReferenceGraphSelection.selection,
      requestedGraphId: snapshotInput.referenceGraphId,
      resolvedGraphId: referenceGraphId,
      ...(requestedReferenceGraphSelection.normalizedRequestedGraphId
        ? { normalizedRequestedGraphId: requestedReferenceGraphSelection.normalizedRequestedGraphId }
        : {}),
    });

    createIssue({
      kind: 'workspace.reopen.graph.invalid-selection',
      severity: 'warning',
      source: requestedReferenceGraphSelection.source,
      title: graphSelectionIssue.title,
      detail: graphSelectionIssue.detail,
      userMessage: graphSelectionIssue.userMessage,
      graphId: referenceGraphId,
      diagnostics: {
        selection: requestedReferenceGraphSelection.selection,
        requestedGraphId: snapshotInput.referenceGraphId,
        ...(requestedReferenceGraphSelection.normalizedRequestedGraphId
          ? { normalizedRequestedGraphId: requestedReferenceGraphSelection.normalizedRequestedGraphId }
          : {}),
        resolvedGraphId: referenceGraphId,
      },
    });
  }

  const readiness = readinessSchema.safeParse(snapshotInput.readiness);

  if (!readiness.success) {
    createIssue({
      kind: 'workspace.reopen.readiness.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'Saved readiness state could not be restored directly',
      detail: 'The persisted readiness block was invalid and has been reset using safe defaults.',
      userMessage: 'The saved readiness block was invalid and has been reset.',
      diagnostics: {
        issues: asValidationMessages(readiness.error),
      },
    });
  }

  const telemetrySnapshot = telemetrySnapshotSchema.safeParse(snapshotInput.telemetrySnapshot);

  if (!telemetrySnapshot.success) {
    createIssue({
      kind: 'workspace.reopen.telemetry.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'Saved telemetry summary could not be restored directly',
      detail: 'The persisted telemetry snapshot was invalid and has been reset using safe defaults.',
      userMessage: 'The saved telemetry summary was invalid and has been reset.',
      diagnostics: {
        issues: asValidationMessages(telemetrySnapshot.error),
      },
    });
  }

  const exportSummary = exportSummarySchema.safeParse(snapshotInput.exportSummary);

  if (!exportSummary.success) {
    createIssue({
      kind: 'workspace.reopen.export.invalid-contract',
      severity: 'warning',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'Saved export summary could not be restored directly',
      detail: 'The persisted export summary was invalid and has been reset using safe defaults.',
      userMessage: 'The saved export summary was invalid and has been reset.',
      diagnostics: {
        issues: asValidationMessages(exportSummary.error),
      },
    });
  }

  const isFormatReadable =
    compareSemver(snapshotInput.workspaceFormatVersion, options.compatibilityEnvelope.minimumReadableWorkspaceFormat) >= 0 &&
    matchesVersionRange(snapshotInput.workspaceFormatVersion, options.compatibilityEnvelope.maximumReadableWorkspaceFormat);

  if (!isFormatReadable) {
    createIssue({
      kind: 'workspace.reopen.compatibility.blocked',
      severity: 'blocking',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'The saved workspace is outside the current compatibility envelope',
      detail: `Workspace format ${snapshotInput.workspaceFormatVersion} falls outside the readable range ${options.compatibilityEnvelope.minimumReadableWorkspaceFormat} to ${options.compatibilityEnvelope.maximumReadableWorkspaceFormat}.`,
      userMessage: 'This workspace was created outside the current compatibility envelope. Saved state is shown in a blocked recovery state.',
      diagnostics: {
        workspaceFormatVersion: snapshotInput.workspaceFormatVersion,
        minimumReadableWorkspaceFormat: options.compatibilityEnvelope.minimumReadableWorkspaceFormat,
        maximumReadableWorkspaceFormat: options.compatibilityEnvelope.maximumReadableWorkspaceFormat,
      },
    });
  }

  const isCurrentBuildReadable =
    compareSemver(options.compatibilityEnvelope.currentAppBuildVersion, snapshotInput.compatibility.minReadableAppBuild) >= 0;

  if (!isCurrentBuildReadable) {
    createIssue({
      kind: 'workspace.reopen.compatibility.blocked',
      severity: 'blocking',
      source: {
        module: 'workspace-persistence',
        entityType: 'workspace',
        entityId: snapshotInput.workspaceId,
      },
      title: 'The current app build cannot read this saved workspace safely',
      detail: `Current app build ${options.compatibilityEnvelope.currentAppBuildVersion} is older than the workspace minimum readable build ${snapshotInput.compatibility.minReadableAppBuild}.`,
      userMessage: 'This workspace requires a newer app build to be read safely.',
      diagnostics: {
        currentAppBuildVersion: options.compatibilityEnvelope.currentAppBuildVersion,
        minReadableAppBuild: snapshotInput.compatibility.minReadableAppBuild,
      },
    });
  }

  const ledger: WorkspaceLedgerEntry[] = [];
  let previousSequence = 0;
  let previousWorkspaceVersion = 0;

  persisted.ledger.forEach((entry, index) => {
    const parsed = workspaceLedgerEntrySchema.safeParse(entry);

    if (!parsed.success) {
      createIssue({
        kind: 'workspace.reopen.ledger.invalid-contract',
        severity: 'warning',
        source: {
          module: 'workspace-persistence',
          entityType: 'ledger',
          entityId: fallbackEntityId('ledger', index),
        },
        title: 'A saved ledger entry could not be reopened',
        detail: `Ledger entry ${index + 1} is invalid and was excluded from the reopened workspace history.`,
        userMessage: 'One saved history entry could not be reopened.',
        diagnostics: {
          index,
          issues: asValidationMessages(parsed.error),
        },
      });
      return;
    }

    if (parsed.data.sequence <= previousSequence || parsed.data.workspaceVersion <= previousWorkspaceVersion) {
      createIssue({
        kind: 'workspace.reopen.ledger.invalid-order',
        severity: 'warning',
        source: {
          module: 'workspace-persistence',
          entityType: 'ledger',
          entityId: parsed.data.ledgerEntryId,
        },
        title: 'Saved history contains out-of-order entries',
        detail: `Ledger entry ${parsed.data.ledgerEntryId} is out of sequence and was excluded from the reopened workspace history.`,
        userMessage: 'Some saved history entries were out of order and were excluded from reopen history.',
        diagnostics: {
          index,
          ledgerEntryId: parsed.data.ledgerEntryId,
          sequence: parsed.data.sequence,
          previousSequence,
          workspaceVersion: parsed.data.workspaceVersion,
          previousWorkspaceVersion,
        },
      });
      return;
    }

    ledger.push(parsed.data);
    previousSequence = parsed.data.sequence;
    previousWorkspaceVersion = parsed.data.workspaceVersion;
  });

  const baseReadiness = readiness.success
    ? readiness.data
    : {
        status: 'ready',
        blockingIssueIds: [],
        warningIssueIds: [],
        provenanceCompleteness: 'none',
      };
  const baseTelemetrySnapshot = telemetrySnapshot.success
    ? telemetrySnapshot.data
    : {
        lastGraphRenderMs: 0,
        offlineQueueDepth: 0,
        status: 'idle',
      };
  const baseExportSummary = exportSummary.success
    ? exportSummary.data
    : {
        lastExportedAt: null,
        includedReferenceGraphId: referenceGraphId,
        manifestVersion: '1.0.0',
      };
  const unmatchedPersistentIssues = [...persistentIssueMatches.values()].filter(
    (issue) => issue.status === 'open' || issue.status === 'deferred',
  );
  const reopenSemanticState = createReopenSemanticState({
    workspaceId: snapshotInput.workspaceId,
    referenceGraphId,
    datasets,
    graphDefinitions,
    occurredAt: startedAt,
    existingIssues: [...parsedPersistedIssues, ...basePersistedIssues, ...unmatchedPersistentIssues, ...localizedIssues],
  });
  graphDefinitions = reopenSemanticState.graphDefinitions;
  const allIssues = [...basePersistedIssues, ...unmatchedPersistentIssues, ...localizedIssues, ...reopenSemanticState.issues];
  const previousIssueIds = collectExistingIssueIds(snapshotInput.issues);
  const hasPreviousBlockingIssue =
    baseReadiness.blockingIssueIds.some((issueId) => previousIssueIds.has(issueId)) ||
    parsedPersistedIssues.some((issue) => issue.severity === 'blocking' && issue.status !== 'resolved');
  const hasPreviousWarningIssue =
    baseReadiness.warningIssueIds.some((issueId) => previousIssueIds.has(issueId)) ||
    parsedPersistedIssues.some((issue) => issue.severity === 'warning' && issue.status !== 'resolved');
  const validIssueIds = new Set(allIssues.map((issue) => issue.issueId));
  const openBlockingIssueIds = new Set(
    allIssues.filter((issue) => issue.severity === 'blocking' && issue.status !== 'resolved').map((issue) => issue.issueId),
  );
  const openWarningIssueIds = new Set(
    allIssues.filter((issue) => issue.severity === 'warning' && issue.status !== 'resolved').map((issue) => issue.issueId),
  );
  const validEvidenceIds = new Set(evidence.map((entry) => entry.evidenceId));
  const blockingIssueIds = new Set([
    ...baseReadiness.blockingIssueIds.filter(
      (issueId) => !previousIssueIds.has(issueId) || openBlockingIssueIds.has(issueId),
    ),
    ...openBlockingIssueIds,
  ]);
  const warningIssueIds = new Set([
    ...baseReadiness.warningIssueIds.filter(
      (issueId) => !previousIssueIds.has(issueId) || openWarningIssueIds.has(issueId),
    ),
    ...openWarningIssueIds,
  ]);
  const hasExplicitBlockingState = baseReadiness.status === 'blocked' && !hasPreviousBlockingIssue;
  const hasExplicitWarningState =
    baseReadiness.status === 'warning' && baseReadiness.provenanceCompleteness === 'complete' && !hasPreviousWarningIssue;
  const snapshot = workspaceSnapshotSchema.parse({
    workspaceId: snapshotInput.workspaceId,
    workspaceFormatVersion: snapshotInput.workspaceFormatVersion,
    appBuildVersion: options.compatibilityEnvelope.currentAppBuildVersion,
    schemaVersion: snapshotInput.schemaVersion,
    createdAt: snapshotInput.createdAt,
    updatedAt: startedAt,
    compatibility: snapshotInput.compatibility,
    datasets,
    transformPipeline: transforms,
    formulaColumns,
    graphDefinitions: graphDefinitions.map((graph) => {
      const evidenceIds = graph.evidenceIds.filter((evidenceId) => validEvidenceIds.has(evidenceId));
      const issueIds = graph.issueIds.filter((issueId) => validIssueIds.has(issueId));

      if (graph.graphId === referenceGraphId) {
        return {
          ...graph,
          evidenceIds,
          issueIds,
          status: 'reference',
        } satisfies GraphDefinition;
      }

      if (graph.graphId !== referenceGraphId && graph.status === 'reference') {
        return {
          ...graph,
          evidenceIds,
          issueIds,
          status: 'candidate',
        } satisfies GraphDefinition;
      }

      return {
        ...graph,
        evidenceIds,
        issueIds,
      } satisfies GraphDefinition;
    }),
    activeGraphId,
    referenceGraphId,
    evidence,
    issues: allIssues,
    readiness: {
      ...baseReadiness,
      status:
        blockingIssueIds.size > 0 || hasExplicitBlockingState
          ? 'blocked'
          : warningIssueIds.size > 0 ||
              hasExplicitWarningState ||
              baseReadiness.provenanceCompleteness !== 'complete'
            ? 'warning'
            : 'ready',
      blockingIssueIds: [...blockingIssueIds],
      warningIssueIds: [...warningIssueIds],
    },
    telemetrySnapshot: baseTelemetrySnapshot,
    exportSummary: {
      ...baseExportSummary,
      includedReferenceGraphId: referenceGraphId,
    },
  });
  const completedAt = now();
  const completedMs = nowMs();

  return {
    snapshot,
    ledger,
    localizedIssues,
    benchmark: {
      savedAt: persisted.savedAt,
      startedAt,
      completedAt,
      durationMs: Math.max(0, completedMs - startedMs),
      issueCount: localizedIssues.length,
      migrationPolicy: options.compatibilityEnvelope.migrationPolicy,
      migrationApplied: false,
      ...(persisted.benchmarkKey ? { benchmarkKey: persisted.benchmarkKey } : {}),
    },
  };
}

function retainRawDatasetFileHandlesForAcceptedSnapshot(record: PersistedWorkspaceRecord, snapshot: WorkspaceSnapshot) {
  const parsedDatasetFileHandles = parsePersistedDatasetFileHandles(
    Array.isArray(record.datasetFileHandles) ? record.datasetFileHandles : [],
  );

  return parsedDatasetFileHandles.filter((entry) =>
    snapshot.datasets.some((dataset) => isCompatibleDatasetFileHandle(dataset, entry)),
  );
}

function synchronizeSnapshotSourceFileMetadata(
  snapshot: WorkspaceSnapshot,
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  const sourceFilesByDatasetId = new Map(
    datasetFileHandles.map((entry) => [
      entry.datasetId,
      {
        fileName: entry.fileName,
        fileHandleToken: entry.fileHandleToken,
      },
    ]),
  );
  let changed = false;
  const datasets = snapshot.datasets.map((dataset) => {
    const sourceFile = sourceFilesByDatasetId.get(dataset.datasetId);

    if (!sourceFile) {
      return dataset;
    }

    if (
      dataset.sourceFile?.fileName === sourceFile.fileName
      && dataset.sourceFile?.fileHandleToken === sourceFile.fileHandleToken
    ) {
      return dataset;
    }

    changed = true;

    return {
      ...dataset,
      sourceFile,
    };
  });

  return changed
    ? workspaceSnapshotSchema.parse({
        ...snapshot,
        datasets,
      } satisfies WorkspaceSnapshot)
    : snapshot;
}

export async function reopenWorkspaceKernel(input: {
  repository: WorkspaceRepository;
  workspaceId: string;
  compatibilityEnvelope: WorkspaceCompatibilityEnvelope;
  now?: () => string;
  nowMs?: () => number;
}): Promise<WorkspaceReopenSession> {
  const record = await input.repository.loadWorkspaceRecord(input.workspaceId);

  if (!record) {
    throw new Error(`Saved workspace "${input.workspaceId}" was not found in local persistence.`);
  }

  const acceptedReport = reopenPersistedWorkspaceRecord(
    {
      ...record,
      datasetFileHandles: [],
    },
    {
      compatibilityEnvelope: input.compatibilityEnvelope,
      ...(input.now ? { now: input.now } : {}),
      ...(input.nowMs ? { nowMs: input.nowMs } : {}),
    },
  );
  const sanitizedDatasetFileHandles = await sanitizePersistedDatasetFileHandlesForHydration(
    retainRawDatasetFileHandlesForAcceptedSnapshot(record, acceptedReport.snapshot),
  );
  const reopenRecord = {
    ...record,
    datasetFileHandles: sanitizedDatasetFileHandles,
  } satisfies PersistedWorkspaceRecord & { datasetFileHandles: PersistedDatasetFileHandle[] };

  const reopenedReport = reopenPersistedWorkspaceRecord(reopenRecord, {
    compatibilityEnvelope: input.compatibilityEnvelope,
    now: () => acceptedReport.benchmark.completedAt,
    nowMs: () => 0,
  });
  const retainedDatasetFileHandles = retainDatasetFileHandlesForSnapshot(
    reopenedReport.snapshot,
    sanitizedDatasetFileHandles,
  );
  const synchronizedSnapshot = synchronizeSnapshotSourceFileMetadata(
    reopenedReport.snapshot,
    retainedDatasetFileHandles,
  );
  const report = {
    ...reopenedReport,
    snapshot: synchronizedSnapshot,
    benchmark: {
      ...reopenedReport.benchmark,
      startedAt: acceptedReport.benchmark.startedAt,
      completedAt: acceptedReport.benchmark.completedAt,
      durationMs: acceptedReport.benchmark.durationMs,
    },
  } satisfies WorkspaceReopenReport;

  return {
    kernelStore: createWorkspaceKernelStore({
      snapshot: report.snapshot,
      ledger: report.ledger,
      datasetFileHandles: retainDatasetFileHandlesForSnapshot(report.snapshot, retainedDatasetFileHandles),
    }),
    report,
  };
}
