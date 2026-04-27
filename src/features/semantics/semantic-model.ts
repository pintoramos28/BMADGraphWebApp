import type { IssueRecord, WorkspaceSnapshot } from '../../schemas/workspace';

export const SEMANTIC_DATA_TYPES = ['string', 'number', 'integer', 'boolean', 'date', 'datetime'] as const;
export const SEMANTIC_ROLES = ['unassigned', 'x', 'y', 'color', 'size', 'facetRow', 'facetColumn'] as const;

export type SemanticDataType = (typeof SEMANTIC_DATA_TYPES)[number];
export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

export interface ColumnSemanticDraft {
  label: string;
  dataType: SemanticDataType;
  semanticRole: SemanticRole;
  unit: string;
  measurementContext: MeasurementContextDraft;
  description: string;
}

export interface MeasurementContextDraft {
  quantity: string;
  method: string;
  condition: string;
  notes: string;
}

export interface DatasetContextDraft {
  description: string;
  measurementNotes: string;
  sourceDescription: string;
}

export interface GraphReadySemanticSummary {
  datasetId: string;
  datasetTitle: string;
  columns: Array<{
    columnId: string;
    sourceName: string;
    label: string;
    dataType: SemanticDataType;
    semanticRole: SemanticRole;
    unit: string | null;
    measurementContext: string | null;
  }>;
  assignedRoles: string[];
  missingRoleColumnIds: string[];
  missingRoleColumnNames: string[];
  missingContextColumnIds: string[];
  missingContextColumnNames: string[];
  datasetContextMissing: boolean;
  issueIds: string[];
  issueSummaries: string[];
}

export function isConfirmedSemanticDataset(dataset: WorkspaceSnapshot['datasets'][number] | null | undefined) {
  return Boolean(dataset && dataset.sourceKind !== 'import-preview' && dataset.sourceKind !== 'recovery');
}

export function isSemanticDataType(value: string): value is SemanticDataType {
  return (SEMANTIC_DATA_TYPES as readonly string[]).includes(value);
}

export function isSemanticRole(value: string): value is SemanticRole {
  return (SEMANTIC_ROLES as readonly string[]).includes(value);
}

export function hasMeaningfulMeasurementContext(
  measurementContext: WorkspaceSnapshot['datasets'][number]['columns'][number]['measurementContext'],
) {
  return Boolean(
    measurementContext
    && Object.values(measurementContext).some((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

export function hasMeaningfulDatasetContext(datasetContext: WorkspaceSnapshot['datasets'][number]['datasetContext']) {
  return Boolean(
    datasetContext
    && Object.values(datasetContext).some((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

export function flattenMeasurementContext(
  measurementContext: WorkspaceSnapshot['datasets'][number]['columns'][number]['measurementContext'],
) {
  if (!hasMeaningfulMeasurementContext(measurementContext)) {
    return '';
  }

  return [
    measurementContext?.quantity,
    measurementContext?.method,
    measurementContext?.condition,
    measurementContext?.notes,
  ].filter((value): value is string => Boolean(value && value.trim())).join(' · ');
}

export function createMeasurementContextDraft(
  measurementContext: WorkspaceSnapshot['datasets'][number]['columns'][number]['measurementContext'],
): MeasurementContextDraft {
  return {
    quantity: measurementContext?.quantity ?? '',
    method: measurementContext?.method ?? '',
    condition: measurementContext?.condition ?? '',
    notes: measurementContext?.notes ?? '',
  };
}

export function parseMeasurementContext(draft: MeasurementContextDraft) {
  const quantity = draft.quantity.trim();
  const method = draft.method.trim();
  const condition = draft.condition.trim();
  const notes = draft.notes.trim();

  if (!quantity && !method && !condition && !notes) {
    return null;
  }

  return {
    ...(quantity ? { quantity } : {}),
    ...(method ? { method } : {}),
    ...(condition ? { condition } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function createColumnSemanticDraft(
  column: WorkspaceSnapshot['datasets'][number]['columns'][number],
): ColumnSemanticDraft {
  return {
    label: column.label,
    dataType: column.dataType,
    semanticRole: column.semanticRole,
    unit: column.unit ?? '',
    measurementContext: createMeasurementContextDraft(column.measurementContext),
    description: column.description ?? '',
  };
}

export function createDatasetContextDraft(dataset: WorkspaceSnapshot['datasets'][number]): DatasetContextDraft {
  return {
    description: dataset.datasetContext?.description ?? '',
    measurementNotes: dataset.datasetContext?.measurementNotes ?? '',
    sourceDescription: dataset.datasetContext?.sourceDescription ?? '',
  };
}

export function toDatasetContext(draft: DatasetContextDraft): WorkspaceSnapshot['datasets'][number]['datasetContext'] {
  const description = draft.description.trim();
  const measurementNotes = draft.measurementNotes.trim();
  const sourceDescription = draft.sourceDescription.trim();

  if (!description && !measurementNotes && !sourceDescription) {
    return null;
  }

  return {
    ...(description ? { description } : {}),
    ...(measurementNotes ? { measurementNotes } : {}),
    ...(sourceDescription ? { sourceDescription } : {}),
  };
}

export function validateColumnSemanticDraft(draft: ColumnSemanticDraft) {
  const errors: string[] = [];

  if (draft.label.trim().length === 0) {
    errors.push('Label is required before semantic edits can be committed.');
  }

  if (!isSemanticDataType(draft.dataType)) {
    errors.push('Choose a supported data type.');
  }

  if (!isSemanticRole(draft.semanticRole)) {
    errors.push('Choose a supported semantic role.');
  }

  return errors;
}

function describeSemanticIssue(issue: IssueRecord, columnsById: Map<string, GraphReadySemanticSummary['columns'][number]>) {
  const diagnostics = issue.diagnostics as { columnId?: unknown; affectedColumnIds?: unknown };
  const columnLabels = [
    ...(typeof diagnostics.columnId === 'string' ? [diagnostics.columnId] : []),
    ...(Array.isArray(diagnostics.affectedColumnIds)
      ? diagnostics.affectedColumnIds.filter((columnId): columnId is string => typeof columnId === 'string')
      : []),
  ]
    .map((columnId) => columnsById.get(columnId)?.label)
    .filter((label): label is string => Boolean(label));
  const uniqueColumnLabels = [...new Set(columnLabels)];
  const issueText = issue.userMessage || issue.title;

  return uniqueColumnLabels.length > 0
    ? `${uniqueColumnLabels.join(', ')}: ${issueText}`
    : issueText;
}

export function createSemanticSummary(
  dataset: WorkspaceSnapshot['datasets'][number] | null | undefined,
  issues: IssueRecord[] = [],
): GraphReadySemanticSummary | null {
  if (!dataset) {
    return null;
  }

  const columns = dataset.columns.map((column) => ({
    columnId: column.columnId,
    sourceName: column.sourceName,
    label: column.label,
    dataType: column.dataType,
    semanticRole: column.semanticRole,
    unit: column.unit,
      measurementContext: flattenMeasurementContext(column.measurementContext) || null,
    }));
  const columnsById = new Map(columns.map((column) => [column.columnId, column] as const));
  const unresolvedSemanticIssues = issues
    .filter((issue) => issue.status !== 'resolved')
    .filter((issue) => issue.kind.startsWith('semantics.'))
    .filter((issue) => {
      const diagnostics = issue.diagnostics as { datasetId?: unknown };

      return diagnostics.datasetId === dataset.datasetId || issue.source.entityId === dataset.datasetId;
    });
  const missingRoleColumns = columns.filter((column) => column.semanticRole === 'unassigned');
  const missingContextColumns = columns.filter((column) => column.measurementContext === null);

  return {
    datasetId: dataset.datasetId,
    datasetTitle: dataset.displayName,
    columns,
    assignedRoles: columns
      .filter((column) => column.semanticRole !== 'unassigned')
      .map((column) => `${column.semanticRole}: ${column.label}${column.unit ? ` (${column.unit})` : ''}`),
    missingRoleColumnIds: missingRoleColumns.map((column) => column.columnId),
    missingRoleColumnNames: missingRoleColumns.map((column) => column.label),
    missingContextColumnIds: missingContextColumns.map((column) => column.columnId),
    missingContextColumnNames: missingContextColumns.map((column) => column.label),
    datasetContextMissing: !hasMeaningfulDatasetContext(dataset.datasetContext),
    issueIds: unresolvedSemanticIssues.map((issue) => issue.issueId),
    issueSummaries: unresolvedSemanticIssues.map((issue) => describeSemanticIssue(issue, columnsById)),
  };
}
