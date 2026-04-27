import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from 'zustand';

import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';
import { selectSemanticGraphCatalogDiagnostics, validateGraphComposition } from '../workspace-persistence/graph-catalog';
import { saveWorkspaceKernelToIndexedDb } from '../workspace-persistence/save-workspace';
import {
  clearSemanticWorkspaceSavePending,
  markSemanticWorkspaceSavePending,
} from '../workspace-persistence/workspace-kernel-persistence-state';
import {
  SEMANTIC_DATA_TYPES,
  SEMANTIC_ROLES,
  createColumnSemanticDraft,
  createDatasetContextDraft,
  createSemanticSummary,
  isConfirmedSemanticDataset,
  parseMeasurementContext,
  toDatasetContext,
  validateColumnSemanticDraft,
  type ColumnSemanticDraft,
  type DatasetContextDraft,
} from './semantic-model';

interface WorkspaceSemanticsPanelProps {
  workspaceId: string;
  kernelStore: WorkspaceKernelStore;
}

type ColumnDrafts = Record<string, ColumnSemanticDraft>;

type SemanticSaveTarget =
  | { kind: 'column'; datasetId: string; columnId: string; correlationId: string }
  | { kind: 'dataset-context'; datasetId: string; correlationId: string };

type WorkspaceKernelState = ReturnType<WorkspaceKernelStore['getState']>;
type WorkspaceSnapshot = WorkspaceKernelState['snapshot'];
type WorkspaceLedger = WorkspaceKernelState['ledger'];
type WorkspaceLedgerEntry = WorkspaceLedger[number];
type WorkspaceDatasetFileHandles = WorkspaceKernelState['datasetFileHandles'];
type WorkspaceDatasetColumn = WorkspaceSnapshot['datasets'][number]['columns'][number];

const panelCardStyle = {
  border: '1px solid rgba(31, 42, 54, 0.12)',
  borderRadius: '1rem',
  padding: '1rem',
  background: 'rgba(255, 255, 255, 0.72)',
} satisfies CSSProperties;

const fieldStyle = {
  display: 'grid',
  gap: '0.25rem',
} satisfies CSSProperties;

const controlStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(31, 42, 54, 0.22)',
  borderRadius: '0.6rem',
  padding: '0.55rem 0.65rem',
  font: 'inherit',
} satisfies CSSProperties;

let nextSemanticMutationOrdinal = 0;

function createMeta() {
  const timestamp = new Date().toISOString();
  nextSemanticMutationOrdinal += 1;

  return {
    actorId: 'workspace-semantics-panel',
    actorKind: 'user',
    correlationId: `semantics_${timestamp.replace(/[^0-9A-Za-z]+/g, '_')}_${nextSemanticMutationOrdinal}`,
    occurredAt: timestamp,
  };
}

function isSemanticIssueId(issueId: string) {
  return issueId.startsWith('semantics.');
}

function semanticIssueId(...parts: string[]) {
  const sanitizedParts = parts.map((part) => part.trim().replace(/[^A-Za-z0-9._:-]+/g, '_')).filter(Boolean);
  const [namespace, ...entityParts] = sanitizedParts;

  return [
    namespace,
    ...entityParts.map((part) => `p${part.length}:${part}`),
  ].filter(Boolean).join('.');
}

export function resolveRenderedColumnSemanticDraft(
  columnDrafts: Record<string, ColumnSemanticDraft>,
  column: WorkspaceDatasetColumn,
) {
  return columnDrafts[column.columnId] ?? createColumnSemanticDraft(column);
}

function graphSemanticDiagnosticsMatch(
  existingIssue: WorkspaceSnapshot['issues'][number],
  generatedIssue: WorkspaceSnapshot['issues'][number],
) {
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

function collectGraphSemanticBlockedReasons(
  graph: WorkspaceSnapshot['graphDefinitions'][number],
  dataset: WorkspaceSnapshot['datasets'][number],
) {
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

function isGraphSemanticIssueForDataset(issue: WorkspaceSnapshot['issues'][number], datasetId: string) {
  const diagnostics = issue.diagnostics as { datasetId?: unknown };

  return issue.kind === 'semantics.graph.composition-invalid' && diagnostics.datasetId === datasetId;
}

function createGraphSemanticRepairActions(input: {
  issueId: string;
  workspaceId: string;
  datasetId: string;
  graphId: string;
  affectedColumnIds: string[];
}) {
  return [
    ...input.affectedColumnIds.map((columnId) => ({
      actionId: 'repair.focusSemanticField',
      label: 'Edit column semantics',
      command: 'repair.focusSemanticField',
      args: {
        issueId: input.issueId,
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        columnId,
      },
    })),
    {
      actionId: 'repair.focusGraph',
      label: 'Inspect graph',
      command: 'repair.focusGraph',
      args: {
        graphId: input.graphId,
      },
    },
  ] satisfies WorkspaceSnapshot['issues'][number]['repairActions'];
}

function createSemanticFieldRepairActions(input: {
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
  ] satisfies WorkspaceSnapshot['issues'][number]['repairActions'];
}

function hasMeaningfulSemanticContext(context: Record<string, string | undefined> | null | undefined) {
  return Boolean(context && Object.values(context).some((value) => typeof value === 'string' && value.trim().length > 0));
}

function preserveRollbackGeneratedIssueState(
  generatedIssue: WorkspaceSnapshot['issues'][number],
  existingIssuesById: Map<string, WorkspaceSnapshot['issues'][number]>,
) {
  const existingIssue = existingIssuesById.get(generatedIssue.issueId);

  if (!existingIssue || existingIssue.status === 'resolved') {
    return generatedIssue;
  }

  if (
    generatedIssue.kind === 'semantics.graph.composition-invalid'
    && !graphSemanticDiagnosticsMatch(existingIssue, generatedIssue)
  ) {
    return generatedIssue;
  }

  return {
    ...generatedIssue,
    status: existingIssue.status,
    detectedAt: existingIssue.detectedAt,
  } satisfies WorkspaceSnapshot['issues'][number];
}

function createColumnSemanticRollbackIssues(input: {
  snapshot: WorkspaceSnapshot;
  dataset: WorkspaceSnapshot['datasets'][number];
  column: WorkspaceSnapshot['datasets'][number]['columns'][number];
  existingIssuesById: Map<string, WorkspaceSnapshot['issues'][number]>;
}) {
  const issues: WorkspaceSnapshot['issues'] = [];

  if (input.column.semanticRole === 'unassigned') {
    const issueId = semanticIssueId('semantics', input.dataset.datasetId, input.column.columnId, 'missing-role');

    issues.push({
      issueId,
      kind: 'semantics.column.missing-role',
      severity: 'warning',
      status: 'open',
      detectedAt: input.snapshot.updatedAt,
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
      repairActions: createSemanticFieldRepairActions({
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

  if (!hasMeaningfulSemanticContext(input.column.measurementContext)) {
    const issueId = semanticIssueId('semantics', input.dataset.datasetId, input.column.columnId, 'missing-context');

    issues.push({
      issueId,
      kind: 'semantics.column.missing-context',
      severity: 'warning',
      status: 'open',
      detectedAt: input.snapshot.updatedAt,
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
      repairActions: createSemanticFieldRepairActions({
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

  return issues.map((issue) => preserveRollbackGeneratedIssueState(issue, input.existingIssuesById));
}

function createDatasetContextRollbackIssues(input: {
  snapshot: WorkspaceSnapshot;
  dataset: WorkspaceSnapshot['datasets'][number];
  existingIssuesById: Map<string, WorkspaceSnapshot['issues'][number]>;
}) {
  if (hasMeaningfulSemanticContext(input.dataset.datasetContext)) {
    return [] satisfies WorkspaceSnapshot['issues'];
  }

  const issueId = semanticIssueId('semantics', input.dataset.datasetId, 'missing-dataset-context');
  const issue = {
    issueId,
    kind: 'semantics.dataset.missing-context',
    severity: 'warning',
    status: 'open',
    detectedAt: input.snapshot.updatedAt,
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
    repairActions: createSemanticFieldRepairActions({
      issueId,
      workspaceId: input.snapshot.workspaceId,
      datasetId: input.dataset.datasetId,
    }),
    diagnostics: {
      datasetId: input.dataset.datasetId,
      field: 'datasetContext',
    },
  } satisfies WorkspaceSnapshot['issues'][number];

  return [preserveRollbackGeneratedIssueState(issue, input.existingIssuesById)] satisfies WorkspaceSnapshot['issues'];
}

function createTargetRollbackSemanticIssues(input: {
  snapshot: WorkspaceSnapshot;
  dataset: WorkspaceSnapshot['datasets'][number];
  target: SemanticSaveTarget;
  existingIssuesById: Map<string, WorkspaceSnapshot['issues'][number]>;
}) {
  if (input.target.kind === 'dataset-context') {
    return createDatasetContextRollbackIssues(input);
  }

  const target = input.target;
  const column = input.dataset.columns.find((candidate) => candidate.columnId === target.columnId);

  if (!column) {
    return [] satisfies WorkspaceSnapshot['issues'];
  }

  return createColumnSemanticRollbackIssues({
    snapshot: input.snapshot,
    dataset: input.dataset,
    column,
    existingIssuesById: input.existingIssuesById,
  });
}

function rebuildGraphSemanticRollbackState(input: {
  snapshot: WorkspaceSnapshot;
  dataset: WorkspaceSnapshot['datasets'][number];
  existingIssues?: WorkspaceSnapshot['issues'];
}) {
  const existingGraphIssuesById = new Map(
    [
      ...input.snapshot.issues,
      ...(input.existingIssues ?? []),
    ]
      .filter((issue) => isGraphSemanticIssueForDataset(issue, input.dataset.datasetId))
      .map((issue) => [issue.issueId, issue] as const),
  );
  const nextGraphIssues: WorkspaceSnapshot['issues'] = [];
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
    const priorIssueIds = graph.issueIds.filter((issueId) => !isSemanticIssueId(issueId));
    const hadSemanticIssue = graph.issueIds.some(isSemanticIssueId);

    if (blockedReasons.length === 0) {
      return {
        ...validation.graph,
        status: graph.status === 'stale' && priorIssueIds.length === 0 && hadSemanticIssue
          ? (input.snapshot.referenceGraphId === graph.graphId ? 'reference' : 'candidate')
          : validation.graph.status,
        issueIds: priorIssueIds,
      } satisfies typeof graph;
    }

    const issueId = semanticIssueId('semantics', input.dataset.datasetId, graph.graphId, 'graph-invalid');
    const generatedIssue = {
      issueId,
      kind: 'semantics.graph.composition-invalid',
      severity: 'blocking',
      status: 'open',
      detectedAt: input.snapshot.updatedAt,
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
      repairActions: createGraphSemanticRepairActions({
        issueId,
        workspaceId: input.snapshot.workspaceId,
        datasetId: input.dataset.datasetId,
        graphId: graph.graphId,
        affectedColumnIds,
      }),
      diagnostics: {
        datasetId: input.dataset.datasetId,
        graphId: graph.graphId,
        blockedReasons,
        affectedColumnIds,
      },
    } satisfies WorkspaceSnapshot['issues'][number];
    nextGraphIssues.push(preserveRollbackGeneratedIssueState(generatedIssue, existingGraphIssuesById));

    return {
      ...validation.graph,
      status: validation.graph.status === 'reference' ? 'reference' : 'stale',
      issueIds: [...priorIssueIds, issueId],
    } satisfies typeof graph;
  });

  return { graphDefinitions, nextGraphIssues };
}

function isTargetRollbackIssue(
  issue: WorkspaceSnapshot['issues'][number],
  target: SemanticSaveTarget,
  snapshot?: WorkspaceSnapshot,
) {
  if (!issue.kind.startsWith('semantics.')) {
    return false;
  }

  const diagnostics = issue.diagnostics as {
    datasetId?: unknown;
    columnId?: unknown;
    graphId?: unknown;
    affectedColumnIds?: unknown;
  };

  if (diagnostics.datasetId !== target.datasetId) {
    return false;
  }

  if (target.kind === 'dataset-context') {
    return issue.kind === 'semantics.dataset.missing-context';
  }

  if (
    diagnostics.columnId === target.columnId
    && (issue.kind === 'semantics.column.missing-role' || issue.kind === 'semantics.column.missing-context')
  ) {
    return true;
  }

  if (issue.kind !== 'semantics.graph.composition-invalid') {
    return false;
  }

  const affectedColumnIds = Array.isArray(diagnostics.affectedColumnIds)
    ? diagnostics.affectedColumnIds.filter((columnId): columnId is string => typeof columnId === 'string')
    : [];

  if (affectedColumnIds.length > 0) {
    return affectedColumnIds.includes(target.columnId);
  }

  if (!snapshot || typeof diagnostics.graphId !== 'string') {
    return false;
  }

  const graph = snapshot.graphDefinitions.find((candidate) => candidate.graphId === diagnostics.graphId);

  return Boolean(
    graph
    && graph.datasetId === target.datasetId
    && Object.values(graph.roleAssignments).some((columnIds) => columnIds.includes(target.columnId)),
  );
}

function restoreGraphSemanticRollbackState(
  currentSnapshot: WorkspaceSnapshot,
  previousSnapshot: WorkspaceSnapshot,
  target: SemanticSaveTarget,
) {
  if (target.kind !== 'column') {
    return currentSnapshot.graphDefinitions;
  }

  const previousGraphById = new Map(previousSnapshot.graphDefinitions.map((graph) => [graph.graphId, graph] as const));
  const currentTargetIssueIds = new Set(
    currentSnapshot.issues
      .filter((issue) => isTargetRollbackIssue(issue, target, currentSnapshot))
      .map((issue) => issue.issueId),
  );
  const previousTargetIssueIds = new Set(
    previousSnapshot.issues
      .filter((issue) => isTargetRollbackIssue(issue, target, previousSnapshot))
      .map((issue) => issue.issueId),
  );

  return currentSnapshot.graphDefinitions.map((graph) => {
    if (graph.datasetId !== target.datasetId) {
      return graph;
    }

    const previousGraph = previousGraphById.get(graph.graphId);

    if (!previousGraph) {
      return {
        ...graph,
        issueIds: graph.issueIds.filter((issueId) => !currentTargetIssueIds.has(issueId)),
      } satisfies typeof graph;
    }

    const previousSemanticIssueIds = previousGraph.issueIds.filter((issueId) => previousTargetIssueIds.has(issueId));
    const nextIssueIds = [
      ...graph.issueIds.filter((issueId) => !currentTargetIssueIds.has(issueId)),
      ...previousSemanticIssueIds,
    ];
    const hadTargetIssue = graph.issueIds.some((issueId) => currentTargetIssueIds.has(issueId));
    const hasRemainingSemanticIssue = nextIssueIds.some(isSemanticIssueId);

    return {
      ...graph,
      status: hadTargetIssue && !hasRemainingSemanticIssue && graph.status === 'stale' && previousGraph.status !== 'stale'
        ? previousGraph.status
        : graph.status,
      issueIds: Array.from(new Set(nextIssueIds)),
    } satisfies typeof graph;
  });
}

function restoreReadinessRollbackState(
  currentSnapshot: WorkspaceSnapshot,
  finalIssues: WorkspaceSnapshot['issues'],
  target: SemanticSaveTarget,
) {
  const removedTargetIssueIds = new Set(
    currentSnapshot.issues.filter((issue) => isTargetRollbackIssue(issue, target, currentSnapshot)).map((issue) => issue.issueId),
  );
  const unresolvedIssuesById = new Map(
    finalIssues
      .filter((issue) => issue.status !== 'resolved')
      .map((issue) => [issue.issueId, issue] as const),
  );
  const blockingIssueIds = Array.from(new Set([
    ...currentSnapshot.readiness.blockingIssueIds.filter((issueId) => !removedTargetIssueIds.has(issueId)),
    ...finalIssues
      .filter((issue) => issue.status !== 'resolved' && issue.severity === 'blocking')
      .map((issue) => issue.issueId),
  ])).filter((issueId) => !removedTargetIssueIds.has(issueId) || unresolvedIssuesById.has(issueId));
  const warningIssueIds = Array.from(new Set([
    ...currentSnapshot.readiness.warningIssueIds.filter((issueId) => !removedTargetIssueIds.has(issueId)),
    ...finalIssues
      .filter((issue) => issue.status !== 'resolved' && issue.severity === 'warning')
      .map((issue) => issue.issueId),
  ])).filter((issueId) => !removedTargetIssueIds.has(issueId) || unresolvedIssuesById.has(issueId));

  return {
    ...currentSnapshot.readiness,
    status: blockingIssueIds.length > 0
      ? 'blocked'
      : warningIssueIds.length > 0 || currentSnapshot.readiness.provenanceCompleteness !== 'complete'
        ? 'warning'
        : 'ready',
    blockingIssueIds,
    warningIssueIds,
  } satisfies WorkspaceSnapshot['readiness'];
}

const rollbackColumnSemanticFields = [
  'label',
  'dataType',
  'semanticRole',
  'unit',
  'measurementContext',
  'description',
] as const;

const rollbackDatasetContextFields = [
  'description',
  'measurementNotes',
  'sourceDescription',
] as const;

function semanticFieldValueEquals(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function datasetContextHasMeaningfulValue(context: WorkspaceSnapshot['datasets'][number]['datasetContext'] | Record<string, unknown>) {
  return rollbackDatasetContextFields.some((field) => {
    const value = context?.[field];

    return typeof value === 'string' && value.trim().length > 0;
  });
}

function rebaseColumnForFailedSemanticMutation(input: {
  currentColumn: WorkspaceSnapshot['datasets'][number]['columns'][number];
  previousColumn: WorkspaceSnapshot['datasets'][number]['columns'][number];
  failedMutationLedgerEntry?: WorkspaceLedgerEntry | undefined;
  laterSameColumnLedgerEntries?: WorkspaceLedgerEntry[] | undefined;
}) {
  const payload = input.failedMutationLedgerEntry?.payload as {
    previous?: Partial<WorkspaceSnapshot['datasets'][number]['columns'][number]>;
    next?: Partial<WorkspaceSnapshot['datasets'][number]['columns'][number]>;
  } | undefined;

  if (!payload?.next) {
    return input.previousColumn;
  }

  return rollbackColumnSemanticFields.reduce((column, field) => {
    if (!(field in payload.next!)) {
      return column;
    }

    const currentValue = input.currentColumn[field];
    const failedNextValue = payload.next?.[field];

    if (!semanticFieldValueEquals(currentValue, failedNextValue)) {
      return column;
    }

  const laterMutationRetainedFailedValue = (input.laterSameColumnLedgerEntries ?? []).some((entry) => {
      const laterPayload = entry.payload as {
        previous?: Partial<WorkspaceSnapshot['datasets'][number]['columns'][number]>;
        next?: Partial<WorkspaceSnapshot['datasets'][number]['columns'][number]>;
      } | undefined;

      return Boolean(
        laterPayload?.next
        && field in laterPayload.next
        && semanticFieldValueEquals(laterPayload.next[field], failedNextValue),
      );
    });

    if (laterMutationRetainedFailedValue) {
      return column;
    }

    const previousValue = field in (payload.previous ?? {})
      ? payload.previous?.[field]
      : input.previousColumn[field];

    return {
      ...column,
      [field]: previousValue ?? null,
    } satisfies typeof column;
  }, input.currentColumn);
}

function normalizeRebasedDatasetContext(
  context: NonNullable<WorkspaceSnapshot['datasets'][number]['datasetContext']>,
): WorkspaceSnapshot['datasets'][number]['datasetContext'] {
  const nextContext = Object.fromEntries(
    rollbackDatasetContextFields.flatMap((field) => {
      const value = context[field];

      return typeof value === 'string' && value.trim().length > 0 ? [[field, value]] : [];
    }),
  ) as NonNullable<WorkspaceSnapshot['datasets'][number]['datasetContext']>;

  return Object.keys(nextContext).length > 0 ? nextContext : null;
}

function rebaseDatasetContextForFailedMutation(input: {
  currentDatasetContext: WorkspaceSnapshot['datasets'][number]['datasetContext'];
  previousDatasetContext: WorkspaceSnapshot['datasets'][number]['datasetContext'];
  failedMutationLedgerEntry?: WorkspaceLedgerEntry | undefined;
  laterDatasetContextLedgerEntries?: WorkspaceLedgerEntry[] | undefined;
}) {
  const payload = input.failedMutationLedgerEntry?.payload as {
    previous?: WorkspaceSnapshot['datasets'][number]['datasetContext'];
    next?: WorkspaceSnapshot['datasets'][number]['datasetContext'];
  } | undefined;

  if (!payload || !('next' in payload)) {
    return input.previousDatasetContext;
  }

  const currentContext = input.currentDatasetContext ?? {};
  const previousContext = payload.previous ?? input.previousDatasetContext ?? {};
  const failedNextContext = payload.next ?? {};
  const rebasedContext = rollbackDatasetContextFields.reduce((context, field) => {
    const currentValue = currentContext[field] ?? null;
    const failedNextValue = failedNextContext[field] ?? null;

    if (!semanticFieldValueEquals(currentValue, failedNextValue)) {
      return context;
    }

    const laterMutationRetainedFailedValue = (input.laterDatasetContextLedgerEntries ?? []).some((entry) => {
      const laterPayload = entry.payload as {
        previous?: WorkspaceSnapshot['datasets'][number]['datasetContext'];
        next?: WorkspaceSnapshot['datasets'][number]['datasetContext'];
      } | undefined;
      const laterPreviousContext = laterPayload?.previous ?? {};
      const laterNextContext = laterPayload?.next ?? {};
      const laterPreviousValue = laterPreviousContext[field] ?? null;
      const laterNextValue = laterNextContext[field] ?? null;
      const laterRetainsAllBlankContext = !datasetContextHasMeaningfulValue(failedNextContext)
        && !datasetContextHasMeaningfulValue(laterNextContext);
      const laterChangedAnotherField = rollbackDatasetContextFields.some((candidateField) => (
        candidateField !== field
        && !semanticFieldValueEquals(
          laterPreviousContext[candidateField] ?? null,
          laterNextContext[candidateField] ?? null,
        )
      ));

      return Boolean(
        laterPayload
        && semanticFieldValueEquals(laterNextValue, failedNextValue)
        && (
          laterRetainsAllBlankContext
          ||
          !semanticFieldValueEquals(laterPreviousValue, failedNextValue)
          || (!(field in laterNextContext) && laterChangedAnotherField)
        ),
      );
    });

    if (laterMutationRetainedFailedValue) {
      return context;
    }

    return {
      ...context,
      [field]: previousContext[field],
    };
  }, { ...currentContext });

  return normalizeRebasedDatasetContext(rebasedContext);
}

export function createConfirmedDatasetColumnSyncKey(
  confirmedDataset: WorkspaceSnapshot['datasets'][number] | null,
) {
  if (!confirmedDataset) {
    return 'no-confirmed-dataset';
  }

  return JSON.stringify({
    datasetId: confirmedDataset.datasetId,
    columns: confirmedDataset.columns.map((column) => ({
      columnId: column.columnId,
      label: column.label,
      dataType: column.dataType,
      semanticRole: column.semanticRole,
      unit: column.unit,
      measurementContext: column.measurementContext,
      description: column.description ?? null,
    })),
  });
}

function createConfirmedDatasetContextSyncKey(
  confirmedDataset: WorkspaceSnapshot['datasets'][number] | null,
) {
  if (!confirmedDataset) {
    return 'no-confirmed-dataset';
  }

  return JSON.stringify({
    datasetId: confirmedDataset.datasetId,
    datasetContext: confirmedDataset.datasetContext,
  });
}

export function createSemanticPersistenceRollbackSnapshot(input: {
  currentSnapshot: WorkspaceSnapshot;
  previousSnapshot: WorkspaceSnapshot;
  currentLedger: WorkspaceLedger;
  target: SemanticSaveTarget;
  failedMutationLedgerEntry?: WorkspaceLedgerEntry | undefined;
}) {
  const previousDataset = input.previousSnapshot.datasets.find((dataset) => dataset.datasetId === input.target.datasetId);
  const currentTargetDataset = input.currentSnapshot.datasets.find((dataset) => dataset.datasetId === input.target.datasetId);
  const failedMutationLedgerIndex = input.failedMutationLedgerEntry
    ? input.currentLedger.findIndex((entry) => entry.correlationId === input.failedMutationLedgerEntry?.correlationId)
    : -1;
  const laterSameColumnLedgerEntries = (() => {
    if (input.target.kind !== 'column' || failedMutationLedgerIndex < 0) {
      return [];
    }

    const target = input.target;

    return input.currentLedger.slice(failedMutationLedgerIndex + 1).filter((entry) => (
      entry.type === 'dataset.column-semantics.updated'
      && entry.entityRefs.datasetId === target.datasetId
      && entry.entityRefs.columnId === target.columnId
    ));
  })();
  const laterDatasetContextLedgerEntries = (() => {
    if (input.target.kind !== 'dataset-context' || failedMutationLedgerIndex < 0) {
      return [];
    }

    return input.currentLedger.slice(failedMutationLedgerIndex + 1).filter((entry) => (
      entry.type === 'dataset.context.updated'
      && entry.entityRefs.datasetId === input.target.datasetId
    ));
  })();

  if (!currentTargetDataset) {
    const removedTargetIssueIds = new Set(
      input.currentSnapshot.issues
        .filter((issue) => isTargetRollbackIssue(issue, input.target, input.currentSnapshot))
        .map((issue) => issue.issueId),
    );
    const graphDefinitions = input.currentSnapshot.graphDefinitions.map((graph) => ({
      ...graph,
      issueIds: graph.issueIds.filter((issueId) => !removedTargetIssueIds.has(issueId)),
    }));
    const issues = input.currentSnapshot.issues.filter((issue) => !isTargetRollbackIssue(issue, input.target, input.currentSnapshot));

    return {
      ...input.currentSnapshot,
      graphDefinitions,
      issues,
      readiness: restoreReadinessRollbackState(input.currentSnapshot, issues, input.target),
    } satisfies WorkspaceSnapshot;
  }

  if (!previousDataset) {
    return input.currentSnapshot;
  }

  const datasets = input.currentSnapshot.datasets.map((dataset) => {
    if (dataset.datasetId !== input.target.datasetId) {
      return dataset;
    }

    if (input.target.kind === 'dataset-context') {
      return {
        ...dataset,
        datasetContext: rebaseDatasetContextForFailedMutation({
          currentDatasetContext: dataset.datasetContext,
          previousDatasetContext: previousDataset.datasetContext,
          failedMutationLedgerEntry: input.failedMutationLedgerEntry,
          laterDatasetContextLedgerEntries,
        }),
      } satisfies typeof dataset;
    }

    const columnTarget = input.target;
    const previousColumn = previousDataset.columns.find((column) => column.columnId === columnTarget.columnId);

    if (!previousColumn) {
      return dataset;
    }

    const currentColumn = dataset.columns.find((column) => column.columnId === columnTarget.columnId);

    if (!currentColumn) {
      return dataset;
    }

    const rebasedColumn = rebaseColumnForFailedSemanticMutation({
      currentColumn,
      previousColumn,
      failedMutationLedgerEntry: input.failedMutationLedgerEntry,
      laterSameColumnLedgerEntries,
    });

    return {
      ...dataset,
      columns: dataset.columns.map((column) => (column.columnId === columnTarget.columnId ? rebasedColumn : column)),
    } satisfies typeof dataset;
  });
  const existingIssuesById = new Map(input.currentSnapshot.issues.map((issue) => [issue.issueId, issue] as const));
  const currentNonTargetIssues = input.currentSnapshot.issues.filter((issue) => !isTargetRollbackIssue(issue, input.target, input.currentSnapshot));
  const rolledBackSnapshot = {
    ...input.currentSnapshot,
    datasets,
    issues: currentNonTargetIssues,
  } satisfies WorkspaceSnapshot;
  const rolledBackDataset = rolledBackSnapshot.datasets.find((dataset) => dataset.datasetId === input.target.datasetId);
  const regeneratedTargetIssues = rolledBackDataset
    ? createTargetRollbackSemanticIssues({
        snapshot: rolledBackSnapshot,
        dataset: rolledBackDataset,
        target: input.target,
        existingIssuesById,
      })
    : [];
  const rolledBackSnapshotWithTargetIssues = {
    ...rolledBackSnapshot,
    issues: [...currentNonTargetIssues, ...regeneratedTargetIssues],
  } satisfies WorkspaceSnapshot;
  const graphRollbackState = input.target.kind === 'column' && rolledBackDataset
    ? rebuildGraphSemanticRollbackState({
        snapshot: rolledBackSnapshotWithTargetIssues,
        dataset: rolledBackDataset,
        existingIssues: input.currentSnapshot.issues,
      })
    : {
        graphDefinitions: restoreGraphSemanticRollbackState(input.currentSnapshot, input.previousSnapshot, input.target),
        nextGraphIssues: [] satisfies WorkspaceSnapshot['issues'],
      };
  const issues = [
    ...rolledBackSnapshotWithTargetIssues.issues.filter((issue) => !isGraphSemanticIssueForDataset(issue, input.target.datasetId)),
    ...rolledBackSnapshotWithTargetIssues.issues.filter(
      (issue) =>
        isGraphSemanticIssueForDataset(issue, input.target.datasetId)
        && !isTargetRollbackIssue(issue, input.target, rolledBackSnapshotWithTargetIssues)
        && !graphRollbackState.nextGraphIssues.some((nextIssue) => nextIssue.issueId === issue.issueId),
    ),
    ...graphRollbackState.nextGraphIssues,
  ];

  return {
    ...input.currentSnapshot,
    datasets,
    graphDefinitions: graphRollbackState.graphDefinitions,
    issues,
    readiness: restoreReadinessRollbackState(input.currentSnapshot, issues, input.target),
  } satisfies WorkspaceSnapshot;
}

function replaceSnapshotAfterRollback(input: {
  kernelStore: WorkspaceKernelStore;
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedger;
  datasetFileHandles: WorkspaceDatasetFileHandles;
}) {
  input.kernelStore.getState().commands.replaceSnapshot({
    snapshot: input.snapshot,
    ledger: input.ledger,
    ...(input.datasetFileHandles.length > 0 ? { datasetFileHandles: input.datasetFileHandles } : {}),
  });
}

export function rollbackSemanticPersistenceFailure(input: {
  kernelStore: WorkspaceKernelStore;
  previousSnapshot: WorkspaceSnapshot;
  previousLedger: WorkspaceLedger;
  previousDatasetFileHandles: WorkspaceDatasetFileHandles;
  expectedWorkspaceVersion: number;
  target: SemanticSaveTarget;
}) {
  const currentState = input.kernelStore.getState();

  if (currentState.workspaceVersion === input.expectedWorkspaceVersion) {
    replaceSnapshotAfterRollback({
      kernelStore: input.kernelStore,
      snapshot: input.previousSnapshot,
      ledger: input.previousLedger,
      datasetFileHandles: currentState.selectors.datasetFileHandles(),
    });
    return;
  }

  replaceSnapshotAfterRollback({
    kernelStore: input.kernelStore,
    snapshot: createSemanticPersistenceRollbackSnapshot({
      currentSnapshot: currentState.snapshot,
      previousSnapshot: input.previousSnapshot,
      currentLedger: currentState.ledger,
      target: input.target,
      failedMutationLedgerEntry: currentState.ledger.find((entry) => entry.correlationId === input.target.correlationId),
    }),
    ledger: currentState.ledger.filter((entry) => entry.correlationId !== input.target.correlationId),
    datasetFileHandles: currentState.selectors.datasetFileHandles(),
  });
}

export function handleSemanticPersistenceFailure(input: {
  kernelStore: WorkspaceKernelStore;
  previousSnapshot: WorkspaceSnapshot;
  previousLedger: WorkspaceLedger;
  previousDatasetFileHandles: WorkspaceDatasetFileHandles;
  expectedWorkspaceVersion: number;
  target: SemanticSaveTarget;
  semanticMutationApplied: boolean;
}) {
  if (!input.semanticMutationApplied) {
    return false;
  }

  rollbackSemanticPersistenceFailure({
    kernelStore: input.kernelStore,
    previousSnapshot: input.previousSnapshot,
    previousLedger: input.previousLedger,
    previousDatasetFileHandles: input.previousDatasetFileHandles,
    expectedWorkspaceVersion: input.expectedWorkspaceVersion,
    target: input.target,
  });

  return true;
}

export function WorkspaceSemanticsPanel({ workspaceId, kernelStore }: WorkspaceSemanticsPanelProps) {
  const snapshot = useStore(kernelStore, (state) => state.snapshot);
  const [columnDrafts, setColumnDrafts] = useState<ColumnDrafts>({});
  const [datasetContextDraft, setDatasetContextDraft] = useState<DatasetContextDraft>({
    description: '',
    measurementNotes: '',
    sourceDescription: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSaveTarget, setPendingSaveTarget] = useState<SemanticSaveTarget | null>(null);
  const pendingSaveRef = useRef<SemanticSaveTarget | null>(null);
  const activeGraph = snapshot.graphDefinitions.find((graph) => graph.graphId === snapshot.activeGraphId);
  const dataset = snapshot.datasets.find((candidate) => candidate.datasetId === (activeGraph?.datasetId ?? snapshot.datasets[0]?.datasetId)) ?? null;
  const confirmedDataset = isConfirmedSemanticDataset(dataset) ? dataset : null;
  const semanticSummary = useMemo(
    () => createSemanticSummary(confirmedDataset, snapshot.issues),
    [confirmedDataset, snapshot.issues],
  );
  const confirmedDatasetColumnSyncKey = useMemo(
    () => createConfirmedDatasetColumnSyncKey(confirmedDataset),
    [confirmedDataset],
  );
  const confirmedDatasetContextSyncKey = useMemo(
    () => createConfirmedDatasetContextSyncKey(confirmedDataset),
    [confirmedDataset],
  );

  useEffect(() => {
    if (!confirmedDataset) {
      setColumnDrafts({});
      return;
    }

    setColumnDrafts(Object.fromEntries(
      confirmedDataset.columns.map((column) => [column.columnId, createColumnSemanticDraft(column)]),
    ));
  }, [confirmedDataset?.datasetId, confirmedDatasetColumnSyncKey]);

  useEffect(() => {
    if (!confirmedDataset) {
      setDatasetContextDraft({ description: '', measurementNotes: '', sourceDescription: '' });
      return;
    }

    setDatasetContextDraft(createDatasetContextDraft(confirmedDataset));
  }, [confirmedDataset?.datasetId, confirmedDatasetContextSyncKey]);

  const summaryByColumnId = useMemo(() => new Map(
    semanticSummary?.columns.map((column) => [column.columnId, column]) ?? [],
  ), [semanticSummary]);

  const saveColumn = async (columnId: string) => {
    if (!confirmedDataset || pendingSaveRef.current) {
      return;
    }

    const column = confirmedDataset.columns.find((candidate) => candidate.columnId === columnId);
    const draft = column ? resolveRenderedColumnSemanticDraft(columnDrafts, column) : undefined;
    const validationErrors = draft ? validateColumnSemanticDraft(draft) : ['Column semantics are not ready to save.'];

    if (!draft || validationErrors.length > 0) {
      setMessage(null);
      setError(validationErrors.join(' '));
      return;
    }

    const previousState = kernelStore.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const mutationWorkspaceVersion = previousState.workspaceVersion + 1;

    const meta = createMeta();
    const saveTarget = {
      kind: 'column',
      datasetId: confirmedDataset.datasetId,
      columnId,
      correlationId: meta.correlationId,
    } satisfies SemanticSaveTarget;
    let semanticMutationApplied = false;

    try {
      markSemanticWorkspaceSavePending(kernelStore, {
        correlationId: saveTarget.correlationId,
        workspaceVersion: mutationWorkspaceVersion,
      });
      pendingSaveRef.current = saveTarget;
      setPendingSaveTarget(saveTarget);
      kernelStore.getState().commands.updateColumnSemantics({
        datasetId: confirmedDataset.datasetId,
        columnId,
        label: draft.label,
        dataType: draft.dataType,
        semanticRole: draft.semanticRole,
        unit: draft.unit,
        measurementContext: parseMeasurementContext(draft.measurementContext),
        description: draft.description,
        ...meta,
      });
      semanticMutationApplied = true;
      await saveWorkspaceKernelToIndexedDb(kernelStore, { semanticSaveCorrelationId: saveTarget.correlationId });
      setError(null);
      setMessage(`Saved semantic choices for ${draft.label.trim()}.`);
    } catch (caughtError) {
      handleSemanticPersistenceFailure({
        kernelStore,
        previousSnapshot,
        previousLedger,
        previousDatasetFileHandles,
        expectedWorkspaceVersion: mutationWorkspaceVersion,
        target: saveTarget,
        semanticMutationApplied,
      });
      setMessage(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Semantic changes could not be saved.');
    } finally {
      clearSemanticWorkspaceSavePending(kernelStore, saveTarget.correlationId);
      pendingSaveRef.current = null;
      setPendingSaveTarget(null);
    }
  };

  const saveDatasetContext = async () => {
    if (!confirmedDataset || pendingSaveRef.current) {
      return;
    }

    const previousState = kernelStore.getState();
    const previousSnapshot = previousState.selectors.persistedWorkspace();
    const previousLedger = structuredClone(previousState.ledger);
    const previousDatasetFileHandles = previousState.selectors.datasetFileHandles();
    const mutationWorkspaceVersion = previousState.workspaceVersion + 1;

    const meta = createMeta();
    const saveTarget = {
      kind: 'dataset-context',
      datasetId: confirmedDataset.datasetId,
      correlationId: meta.correlationId,
    } satisfies SemanticSaveTarget;
    let semanticMutationApplied = false;

    try {
      markSemanticWorkspaceSavePending(kernelStore, {
        correlationId: saveTarget.correlationId,
        workspaceVersion: mutationWorkspaceVersion,
      });
      pendingSaveRef.current = saveTarget;
      setPendingSaveTarget(saveTarget);
      kernelStore.getState().commands.updateDatasetContext({
        datasetId: confirmedDataset.datasetId,
        datasetContext: toDatasetContext(datasetContextDraft),
        ...meta,
      });
      semanticMutationApplied = true;
      await saveWorkspaceKernelToIndexedDb(kernelStore, { semanticSaveCorrelationId: saveTarget.correlationId });
      setError(null);
      setMessage('Saved dataset context.');
    } catch (caughtError) {
      handleSemanticPersistenceFailure({
        kernelStore,
        previousSnapshot,
        previousLedger,
        previousDatasetFileHandles,
        expectedWorkspaceVersion: mutationWorkspaceVersion,
        target: saveTarget,
        semanticMutationApplied,
      });
      setMessage(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Dataset context could not be saved.');
    } finally {
      clearSemanticWorkspaceSavePending(kernelStore, saveTarget.correlationId);
      pendingSaveRef.current = null;
      setPendingSaveTarget(null);
    }
  };

  return (
    <section
      aria-labelledby="workspace-semantics-heading"
      role="region"
      style={{ ...panelCardStyle, marginTop: '1rem', display: 'grid', gap: '1rem' }}
    >
      <div>
        <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', color: '#6f5b45' }}>
          Confirmed Dataset Semantics
        </p>
        <h2 id="workspace-semantics-heading" style={{ margin: '0.35rem 0 0' }}>Workspace semantics</h2>
        <p style={{ margin: '0.5rem 0 0', lineHeight: 1.5 }}>
          Review editable labels, data types, analytical roles, units, and measurement context for workspace {workspaceId}.
        </p>
      </div>

      {message ? <p role="status" aria-live="polite" style={{ margin: 0, color: '#25613f' }}>{message}</p> : null}
      {error ? <p role="alert" style={{ margin: 0, color: '#9b2c2c' }}>{error}</p> : null}

      {!confirmedDataset ? (
        <p style={{ margin: 0, lineHeight: 1.5 }}>Confirm an import before editing canonical dataset semantics.</p>
      ) : (
        <>
          <section aria-labelledby="dataset-context-heading" style={panelCardStyle}>
            <h3 id="dataset-context-heading" style={{ marginTop: 0 }}>{confirmedDataset.displayName} context</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={fieldStyle}>
                Dataset description
                <textarea
                  aria-describedby="dataset-description-helper"
                  style={controlStyle}
                  rows={2}
                  value={datasetContextDraft.description}
                  onChange={(event) => setDatasetContextDraft((draft) => ({ ...draft, description: event.target.value }))}
                />
                <small id="dataset-description-helper">Describe the dataset for graph readers without duplicating the title.</small>
              </label>
              <label style={fieldStyle}>
                Dataset measurement notes
                <textarea
                  style={controlStyle}
                  rows={2}
                  value={datasetContextDraft.measurementNotes}
                  onChange={(event) => setDatasetContextDraft((draft) => ({ ...draft, measurementNotes: event.target.value }))}
                />
              </label>
              <label style={fieldStyle}>
                Dataset source description
                <textarea
                  style={controlStyle}
                  rows={2}
                  value={datasetContextDraft.sourceDescription}
                  onChange={(event) => setDatasetContextDraft((draft) => ({ ...draft, sourceDescription: event.target.value }))}
                />
              </label>
              <button type="button" disabled={pendingSaveTarget !== null} onClick={() => void saveDatasetContext()}>
                {pendingSaveTarget?.kind === 'dataset-context' ? 'Saving dataset context…' : 'Save dataset context'}
              </button>
            </div>
          </section>

          <section aria-label="Column semantic editors" style={{ display: 'grid', gap: '0.75rem' }}>
            {confirmedDataset.columns.map((column) => {
              const draft = resolveRenderedColumnSemanticDraft(columnDrafts, column);
              const validationErrors = validateColumnSemanticDraft(draft);
              const summary = summaryByColumnId.get(column.columnId);
              const controlName = draft.label.trim() || column.sourceName;

              return (
                <article key={column.columnId} style={panelCardStyle}>
                  <h3 style={{ marginTop: 0 }}>{column.sourceName}</h3>
                  <p style={{ marginTop: 0, lineHeight: 1.5 }}>
                    Source name stays <strong>{column.sourceName}</strong>; label controls graph, summary, and export display.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem' }}>
                    <label style={fieldStyle}>
                      Label for {controlName}
                      <input
                        style={controlStyle}
                        value={draft.label}
                        onChange={(event) => setColumnDrafts((drafts) => ({
                          ...drafts,
                          [column.columnId]: { ...draft, label: event.target.value },
                        }))}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Data type for {controlName}
                      <select
                        style={controlStyle}
                        value={draft.dataType}
                        onChange={(event) => setColumnDrafts((drafts) => ({
                          ...drafts,
                          [column.columnId]: { ...draft, dataType: event.target.value as ColumnSemanticDraft['dataType'] },
                        }))}
                      >
                        {SEMANTIC_DATA_TYPES.map((dataType) => <option key={dataType} value={dataType}>{dataType}</option>)}
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      Semantic role for {controlName}
                      <select
                        style={controlStyle}
                        value={draft.semanticRole}
                        onChange={(event) => setColumnDrafts((drafts) => ({
                          ...drafts,
                          [column.columnId]: { ...draft, semanticRole: event.target.value as ColumnSemanticDraft['semanticRole'] },
                        }))}
                      >
                        {SEMANTIC_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      Unit for {controlName}
                      <input
                        style={controlStyle}
                        value={draft.unit}
                        onChange={(event) => setColumnDrafts((drafts) => ({
                          ...drafts,
                          [column.columnId]: { ...draft, unit: event.target.value },
                        }))}
                      />
                    </label>
                  </div>
                  <fieldset style={{ ...fieldStyle, marginTop: '0.75rem', border: 0, padding: 0 }}>
                    <legend>Structured measurement context for {controlName}</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem' }}>
                      <label style={fieldStyle}>
                        Quantity for {controlName}
                        <input
                          style={controlStyle}
                          value={draft.measurementContext.quantity}
                          onChange={(event) => setColumnDrafts((drafts) => ({
                            ...drafts,
                            [column.columnId]: {
                              ...draft,
                              measurementContext: { ...draft.measurementContext, quantity: event.target.value },
                            },
                          }))}
                        />
                      </label>
                      <label style={fieldStyle}>
                        Method for {controlName}
                        <input
                          style={controlStyle}
                          value={draft.measurementContext.method}
                          onChange={(event) => setColumnDrafts((drafts) => ({
                            ...drafts,
                            [column.columnId]: {
                              ...draft,
                              measurementContext: { ...draft.measurementContext, method: event.target.value },
                            },
                          }))}
                        />
                      </label>
                      <label style={fieldStyle}>
                        Condition for {controlName}
                        <input
                          style={controlStyle}
                          value={draft.measurementContext.condition}
                          onChange={(event) => setColumnDrafts((drafts) => ({
                            ...drafts,
                            [column.columnId]: {
                              ...draft,
                              measurementContext: { ...draft.measurementContext, condition: event.target.value },
                            },
                          }))}
                        />
                      </label>
                      <label style={fieldStyle}>
                        Measurement context for {controlName}
                        <textarea
                          style={controlStyle}
                          rows={2}
                          value={draft.measurementContext.notes}
                          onChange={(event) => setColumnDrafts((drafts) => ({
                            ...drafts,
                            [column.columnId]: {
                              ...draft,
                              measurementContext: { ...draft.measurementContext, notes: event.target.value },
                            },
                          }))}
                        />
                      </label>
                    </div>
                  </fieldset>
                  <label style={{ ...fieldStyle, marginTop: '0.75rem' }}>
                    Description for {controlName}
                    <textarea
                      style={controlStyle}
                      rows={2}
                      value={draft.description}
                      onChange={(event) => setColumnDrafts((drafts) => ({
                        ...drafts,
                        [column.columnId]: { ...draft, description: event.target.value },
                      }))}
                    />
                  </label>
                  {validationErrors.length > 0 ? (
                    <p role="alert" style={{ color: '#9b2c2c' }}>{validationErrors.join(' ')}</p>
                  ) : null}
                  <p style={{ lineHeight: 1.5 }}>
                    Active choice: {summary?.semanticRole ?? draft.semanticRole} · {summary?.dataType ?? draft.dataType}
                    {summary?.unit ? ` · ${summary.unit}` : ''}
                  </p>
                  <button type="button" disabled={pendingSaveTarget !== null} onClick={() => void saveColumn(column.columnId)}>
                    {pendingSaveTarget?.kind === 'column' && pendingSaveTarget.columnId === column.columnId
                      ? `Saving semantics for ${controlName}…`
                      : `Save semantics for ${controlName}`}
                  </button>
                </article>
              );
            })}
          </section>

          <section aria-labelledby="graph-ready-semantic-summary-heading" style={panelCardStyle}>
            <h3 id="graph-ready-semantic-summary-heading" style={{ marginTop: 0 }}>Graph-ready semantic summary</h3>
            <p style={{ lineHeight: 1.5 }}>
              Dataset: <strong>{semanticSummary?.datasetTitle ?? confirmedDataset.displayName}</strong>
            </p>
            <ul>
              {(semanticSummary?.assignedRoles.length ? semanticSummary.assignedRoles : ['No graph roles assigned yet.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={{ lineHeight: 1.5 }}>
              Missing roles: {semanticSummary?.missingRoleColumnNames.length ? semanticSummary.missingRoleColumnNames.join(', ') : 'none'}.
              {' '}Missing measurement context: {semanticSummary?.missingContextColumnNames.length ? semanticSummary.missingContextColumnNames.join(', ') : 'none'}.
              Dataset context: {semanticSummary?.datasetContextMissing ? 'missing' : 'provided'}.
            </p>
            {semanticSummary?.issueSummaries.length ? (
              <div style={{ lineHeight: 1.5 }}>
                <p style={{ marginBottom: '0.35rem' }}>Open semantic gaps:</p>
                <ul>
                  {semanticSummary.issueSummaries.map((issueSummary, index) => <li key={`${issueSummary}-${index}`}>{issueSummary}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
