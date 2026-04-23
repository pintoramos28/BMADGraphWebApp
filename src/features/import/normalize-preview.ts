import type { IssueRecord } from '../../schemas/workspace';
import { IMPORT_PREVIEW_BUDGET_MS } from './benchmark-timing';
import type {
  ImportBenchmarkScenario,
  ImportConfirmedColumnType,
  ImportConfidence,
  ImportMissingValuePolicy,
  ImportPreviewAssumption,
  ImportPreviewDataset,
  ImportPreviewUncertainty,
  ImportRepairSelections,
  ImportSourceKind,
} from './preview-model';
import { createDefaultImportRepairSelections } from './preview-model';

export interface TabularPreviewInput {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string | undefined;
  mimeType?: string | null | undefined;
  sheetName?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  delimiter?: string | null | undefined;
  delimiterRequiresConfirmation?: boolean | undefined;
  rowLimit?: number | undefined;
  rowOverflow?: boolean | undefined;
  fullPreviewableRowCount?: number | undefined;
  rows: string[][];
  fullRows?: string[][] | undefined;
  includeConfirmedDataset?: boolean | undefined;
  durationMs: number;
  repairSelections?: ImportRepairSelections | undefined;
}

interface HeaderDecision {
  hasHeader: boolean;
  confidence: ImportConfidence;
}

interface ValueQuality {
  hasMissingValues: boolean;
  hasMalformedValues: boolean;
  missingValueCount: number;
  malformedValueCount: number;
  affectedRowCount: number;
}

const SAMPLE_ROW_LIMIT = 8;
const SAMPLE_VALUE_LIMIT = 3;
const REPAIR_CONTEXT_ROUTE_KEY = 'workspace.import';
const REPAIR_CONTEXT_PANEL = 'import-preview';

function hashPreviewIdentity(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function updateHashedIdentity(hash: number, input: string) {
  let nextHash = hash;

  for (let index = 0; index < input.length; index += 1) {
    nextHash ^= input.charCodeAt(index);
    nextHash = Math.imul(nextHash, 16777619);
  }

  return nextHash;
}

function createPreviewId(input: {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string | undefined;
  sheetName?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  delimiter?: string | null | undefined;
  delimiterRequiresConfirmation?: boolean | undefined;
  previewRows: string[][];
  repairSelections: ImportRepairSelections;
  confirmedDatasetFingerprint: string;
}) {
  return `preview_${hashPreviewIdentity(
    JSON.stringify({
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      fileName: input.fileName ?? null,
      sheetName: input.sheetName ?? null,
      benchmarkScenario: input.benchmarkScenario ?? null,
      delimiter: input.delimiter ?? null,
      delimiterRequiresConfirmation: input.delimiterRequiresConfirmation ?? false,
      previewRows: input.previewRows,
      repairSelections: input.repairSelections,
      confirmedDatasetFingerprint: input.confirmedDatasetFingerprint,
    }),
  )}`;
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function scoreHeaderCandidate(value: string) {
  if (value.length === 0) {
    return 0;
  }

  if (looksNumeric(value) || looksDate(value)) {
    return 0;
  }

  return /[A-Za-z]/.test(value) ? 1 : 0.5;
}

function normalizeRows(rows: string[][]) {
  return rows
    .map((row) => row.map((value) => normalizeCell(value)))
    .filter((row) => row.some((value) => value.length > 0));
}

function detectHeader(rows: string[][]): HeaderDecision {
  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];

  if (firstRow.length === 0) {
    return {
      hasHeader: false,
      confidence: 'low',
    };
  }

  const firstScore = firstRow.reduce((total, value) => total + scoreHeaderCandidate(value), 0);
  const secondScore = secondRow.reduce((total, value) => total + scoreHeaderCandidate(value), 0);
  const uniqueCount = new Set(firstRow.map((value) => value.toLowerCase())).size;
  const uniqueEnough = uniqueCount === firstRow.length;
  const ratio = firstRow.length > 0 ? firstScore / firstRow.length : 0;
  const hasHeader = uniqueEnough && ratio >= 0.6 && firstScore >= secondScore;

  return {
    hasHeader,
    confidence: hasHeader ? (ratio >= 0.85 ? 'high' : 'medium') : secondRow.length > 0 ? 'medium' : 'low',
  };
}

function findDuplicateHeaderNames(row: string[]) {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  row.forEach((value) => {
    const normalized = value.trim().toLowerCase();

    if (normalized.length === 0) {
      return;
    }

    if (seen.has(normalized)) {
      duplicates.add(value.trim());
      return;
    }

    seen.add(normalized);
  });

  return Array.from(duplicates.values());
}

function toColumnId(index: number) {
  return `col_${index + 1}`;
}

function toRowId(index: number) {
  return `row_${index + 1}`;
}

function displayDelimiter(delimiter: string | null | undefined) {
  if (!delimiter) {
    return 'Not applicable';
  }

  if (delimiter === ',') {
    return 'Comma (,)';
  }

  if (delimiter === '\t') {
    return 'Tab';
  }

  if (delimiter === ';') {
    return 'Semicolon (;)';
  }

  if (delimiter === '|') {
    return 'Pipe (|)';
  }

  return delimiter;
}

function displayMissingValuePolicy(policy: ImportMissingValuePolicy) {
  return policy === 'drop-invalid-rows'
    ? 'Rows with missing or malformed values will be excluded from the active analysis.'
    : 'Missing or malformed values will stay in the active analysis as empty cells.';
}

function createConfirmedDatasetFingerprint(input: {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string | undefined;
  sheetName?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  delimiter?: string | null | undefined;
  repairSelections: ImportRepairSelections;
  columnNames: string[];
  columnTypes: Array<'string' | 'number' | 'date'>;
  rows: string[][];
  rowCount: number;
  isPartialPreview: boolean;
}) {
  let hash = 2166136261;
  const parts = [
    input.sourceKind,
    input.sourceLabel,
    input.fileName ?? '',
    input.sheetName ?? '',
    input.benchmarkScenario ?? '',
    input.delimiter ?? '',
    JSON.stringify(input.repairSelections),
    String(input.columnNames.length),
    String(input.rowCount),
    input.isPartialPreview ? 'partial' : 'full',
  ];

  parts.forEach((part) => {
    hash = updateHashedIdentity(hash, part);
    hash = updateHashedIdentity(hash, '\u001f');
  });

  input.columnNames.forEach((columnName) => {
    hash = updateHashedIdentity(hash, columnName);
    hash = updateHashedIdentity(hash, '\u001e');
  });

  input.columnTypes.forEach((columnType) => {
    hash = updateHashedIdentity(hash, columnType);
    hash = updateHashedIdentity(hash, '\u001d');
  });

  input.rows.forEach((row) => {
    row.forEach((value) => {
      hash = updateHashedIdentity(hash, value);
      hash = updateHashedIdentity(hash, '\u001c');
    });
    hash = updateHashedIdentity(hash, '\u001b');
  });

  return `import_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

interface AdditionalConfirmedColumn {
  columnIndex: number;
  sourceName: string;
}

function createAdditionalColumnsAcknowledgementToken(columns: AdditionalConfirmedColumn[]) {
  return `ack_${hashPreviewIdentity(JSON.stringify(columns))}`;
}

function collectAdditionalConfirmedColumns(previewColumnNames: string[], confirmedColumnNames: string[]) {
  return confirmedColumnNames.reduce<AdditionalConfirmedColumn[]>((additionalColumns, sourceName, columnIndex) => {
    if (columnIndex >= previewColumnNames.length || previewColumnNames[columnIndex] !== sourceName) {
      additionalColumns.push({
        columnIndex,
        sourceName,
      });
    }

    return additionalColumns;
  }, []);
}

function looksNumeric(value: string) {
  if (value.length === 0) {
    return false;
  }

  const normalized = value.replace(/,/g, '');

  return /^-?\d+(?:\.\d+)?$/.test(normalized);
}

function looksDate(value: string) {
  if (value.length === 0 || looksNumeric(value)) {
    return false;
  }

  if (!/\d.*[-/:\s].*\d|[A-Za-z]{3,}\s+\d{1,2}/.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);

  return !Number.isNaN(parsed);
}

function inferColumnType(values: string[]) {
  const populated = values.filter((value) => value.length > 0);

  if (populated.length === 0) {
    return {
      inferredType: 'empty',
      confidence: 'low',
    } as const;
  }

  const numericCount = populated.filter(looksNumeric).length;
  const dateCount = populated.filter(looksDate).length;

  if (numericCount === populated.length) {
    return {
      inferredType: 'numeric',
      confidence: populated.length >= 3 ? 'high' : 'medium',
    } as const;
  }

  if (dateCount === populated.length) {
    return {
      inferredType: 'date',
      confidence: populated.length >= 3 ? 'high' : 'medium',
    } as const;
  }

  const numericRatio = numericCount / populated.length;
  const dateRatio = dateCount / populated.length;

  if (numericRatio >= 0.6 || dateRatio >= 0.6) {
    return {
      inferredType: 'mixed',
      confidence: 'low',
    } as const;
  }

  return {
    inferredType: 'text',
    confidence: populated.length >= 3 ? 'high' : 'medium',
  } as const;
}

function createIssueBase(
  issueId: string,
  kind: string,
  title: string,
  detail: string,
  userMessage: string,
  detectedAt: string,
) {
  return {
    issueId,
    kind,
    status: 'open' as const,
    detectedAt,
    source: {
      module: 'features.import',
      entityType: 'import-preview',
      entityId: issueId,
    },
    title,
    detail,
    userMessage,
    contextRef: {
      routeKey: REPAIR_CONTEXT_ROUTE_KEY,
      panel: REPAIR_CONTEXT_PANEL,
    },
  };
}

function requiresExplicitDelimiterConfirmation(input: {
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  delimiterRequiresConfirmation?: boolean | undefined;
}) {
  return input.benchmarkScenario === 'import.dirty.delimiter-repair' || input.delimiterRequiresConfirmation === true;
}

function buildDelimiterIssue(input: {
  delimiter: string | null;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  delimiterRequiresConfirmation?: boolean | undefined;
  selectionApplied: boolean;
  detectedAt: string;
}): IssueRecord | null {
  const requiresExplicitConfirmation = requiresExplicitDelimiterConfirmation(input);

  if (input.selectionApplied || !requiresExplicitConfirmation) {
    return null;
  }

  return {
    ...createIssueBase(
      'issue_import_delimiter_confirmation',
      'import.delimiter.confirmation-required',
      'Confirm the delimiter before import',
      input.delimiter
        ? `The preview detected ${displayDelimiter(input.delimiter)} delimiters. Confirm that parsing choice or select a different delimiter before import continues.`
        : 'The preview found conflicting delimiter signals. Confirm the correct delimiter before import continues.',
      input.delimiter
        ? `Confirm whether ${displayDelimiter(input.delimiter)} is the correct delimiter.`
        : 'Confirm which delimiter should be used before import continues.',
      input.detectedAt,
    ),
    severity: 'blocking',
    repairActions: [
      {
        actionId: 'set-delimiter',
        label: 'Confirm or change delimiter',
        command: 'import.set-delimiter',
        args: {
          options: [',', '\t', ';', '|'],
          detectedDelimiter: input.delimiter,
        },
      },
    ],
    diagnostics: {
      category: 'delimiter',
      detectedDelimiter: input.delimiter,
      options: [',', '\t', ';', '|'],
    },
  };
}

function buildHeaderIssue(input: {
  headerDecision: HeaderDecision;
  headerRow: string[];
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  selectionApplied: boolean;
  bodyRowCount: number;
  detectedAt: string;
}): IssueRecord | null {
  const duplicateHeaders = findDuplicateHeaderNames(input.headerRow);
  const headerChoiceRemovesAllRows = input.headerDecision.hasHeader && input.bodyRowCount === 0;
  const requiresExplicitConfirmation =
    headerChoiceRemovesAllRows ||
    input.headerDecision.confidence !== 'high' ||
    duplicateHeaders.length > 0 ||
    input.benchmarkScenario === 'import.dirty.header-repair';

  if (!requiresExplicitConfirmation || (input.selectionApplied && !headerChoiceRemovesAllRows)) {
    return null;
  }

  return {
    ...createIssueBase(
      'issue_import_header_confirmation',
      'import.header.confirmation-required',
      'Confirm how the first row should be interpreted',
      headerChoiceRemovesAllRows
        ? 'Treating the first row as headers leaves no data rows available for import. Switch the first row back to data or choose a source with additional rows.'
        : duplicateHeaders.length > 0
        ? `The first row contains duplicate header names (${duplicateHeaders.join(', ')}), so you need to confirm whether it should stay as headers or be treated as data.`
        : input.headerDecision.hasHeader
          ? 'The first row looked like headers, but the signal was not strong enough to proceed without confirmation.'
          : 'The first row was treated as data because header detection stayed conservative.',
      headerChoiceRemovesAllRows
        ? 'Choose whether the first row should stay as data so at least one row remains available for import.'
        : input.headerDecision.hasHeader
        ? 'Confirm that the first row contains column headers.'
        : 'Choose whether the first row should be treated as headers or data.',
      input.detectedAt,
    ),
    severity: 'blocking',
    repairActions: [
      {
        actionId: 'set-header-selection',
        label: 'Choose first-row handling',
        command: 'import.set-header-selection',
        args: {
          options: ['first-row-header', 'first-row-data'],
          detectedHasHeader: input.headerDecision.hasHeader,
          duplicateHeaders,
        },
      },
    ],
    diagnostics: {
      category: 'header',
      detectedHasHeader: input.headerDecision.hasHeader,
      bodyRowCount: input.bodyRowCount,
      duplicateHeaders,
      options: ['first-row-header', 'first-row-data'],
    },
  };
}

function buildColumnTypeIssue(
  columnId: string,
  sourceName: string,
  inferredType: string,
  selectionApplied: boolean,
  detectedAt: string,
): IssueRecord | null {
  if (inferredType !== 'mixed' || selectionApplied) {
    return null;
  }

  return {
    ...createIssueBase(
      `issue_import_type_${columnId}`,
      'import.column-type.confirmation-required',
      `Confirm the data type for ${sourceName}`,
      `"${sourceName}" mixes numeric, date, or text-looking values in the preview sample. Choose the type BMAD should honor before import continues.`,
      `Choose the confirmed data type for ${sourceName}.`,
      detectedAt,
    ),
    severity: 'blocking',
    repairActions: [
      {
        actionId: 'set-column-type',
        label: 'Confirm column type',
        command: 'import.set-column-type',
        args: {
          columnId,
          sourceName,
          options: ['text', 'numeric', 'date'],
        },
      },
    ],
    diagnostics: {
      category: 'column-type',
      columnId,
      sourceName,
      options: ['text', 'numeric', 'date'],
    },
  };
}

function resolveExplicitColumnType(values: string[], override: ImportConfirmedColumnType | undefined) {
  if (override) {
    return override;
  }

  const inference = inferColumnType(values);

  if (inference.inferredType === 'numeric' || inference.inferredType === 'date' || inference.inferredType === 'text') {
    return inference.inferredType;
  }

  return 'text';
}

function inspectRowAgainstColumnTypes(row: string[], columnTypes: ImportConfirmedColumnType[]) {
  let missingValueCount = 0;
  let malformedValueCount = 0;
  const columnCount = Math.max(row.length, columnTypes.length);
  const nextRow = Array.from({ length: columnCount }, (_, columnIndex) => {
    const value = row[columnIndex] ?? '';

    if (value.length === 0) {
      missingValueCount += 1;
      return '';
    }

    const targetType = columnTypes[columnIndex] ?? 'text';

    if (targetType === 'numeric' && !looksNumeric(value)) {
      malformedValueCount += 1;
      return '';
    }

    if (targetType === 'date' && !looksDate(value)) {
      malformedValueCount += 1;
      return '';
    }

    return value;
  });

  return {
    nextRow,
    rowHasProblem: missingValueCount > 0 || malformedValueCount > 0,
    missingValueCount,
    malformedValueCount,
  };
}

function collectValueQuality(rows: string[][], columnTypes: ImportConfirmedColumnType[]) {
  return rows.reduce<ValueQuality>(
    (quality, row) => {
      const rowInspection = inspectRowAgainstColumnTypes(row, columnTypes);

      if (rowInspection.missingValueCount > 0) {
        quality.hasMissingValues = true;
        quality.missingValueCount += rowInspection.missingValueCount;
      }

      if (rowInspection.malformedValueCount > 0) {
        quality.hasMalformedValues = true;
        quality.malformedValueCount += rowInspection.malformedValueCount;
      }

      if (rowInspection.rowHasProblem) {
        quality.affectedRowCount += 1;
      }

      return quality;
    },
    {
      hasMissingValues: false,
      hasMalformedValues: false,
      missingValueCount: 0,
      malformedValueCount: 0,
      affectedRowCount: 0,
    },
  );
}

function applyMissingValuePolicy(
  rows: string[][],
  columnTypes: ImportConfirmedColumnType[],
  missingValuePolicy: ImportMissingValuePolicy | null,
) {
  if (!missingValuePolicy) {
    return {
      rows,
      removedAllRows: false,
    };
  }

  const transformedRows = rows
    .map((row) => {
      const rowInspection = inspectRowAgainstColumnTypes(row, columnTypes);

      return rowInspection;
    })
    .filter((row) => missingValuePolicy !== 'drop-invalid-rows' || !row.rowHasProblem)
    .map((row) => row.nextRow);

  return {
    rows: transformedRows,
    removedAllRows: missingValuePolicy === 'drop-invalid-rows' && rows.length > 0 && transformedRows.length === 0,
  };
}

function buildMissingValueIssues(
  quality: ValueQuality,
  policy: ImportMissingValuePolicy | null,
  policyEmptiesDataset: boolean,
  detectedAt: string,
): IssueRecord[] {
  if (!quality.hasMissingValues && !quality.hasMalformedValues) {
    return [];
  }

  if (!policy) {
    return [
      {
        ...createIssueBase(
          'issue_import_missing_value_policy',
          'import.missing-value.policy-required',
          'Choose how missing or malformed values should be handled',
          `The preview found ${quality.missingValueCount} missing cells and ${quality.malformedValueCount} malformed cells across ${quality.affectedRowCount} rows.`,
          'Choose how missing or malformed values should affect the active analysis before import continues.',
          detectedAt,
        ),
        severity: 'blocking',
        repairActions: [
          {
            actionId: 'set-missing-value-policy',
            label: 'Choose missing-value handling',
            command: 'import.set-missing-value-policy',
            args: {
              options: ['mark-empty', 'drop-invalid-rows'],
              missingValueCount: quality.missingValueCount,
              malformedValueCount: quality.malformedValueCount,
              affectedRowCount: quality.affectedRowCount,
            },
          },
        ],
        diagnostics: {
          category: 'missing-values',
          missingValueCount: quality.missingValueCount,
          malformedValueCount: quality.malformedValueCount,
          affectedRowCount: quality.affectedRowCount,
          options: ['mark-empty', 'drop-invalid-rows'],
        },
      },
    ];
  }

  if (policyEmptiesDataset) {
    return [
      {
        ...createIssueBase(
          'issue_import_missing_value_policy_empty-result',
          'import.missing-value.policy-empty-result',
          'This repair would remove every row from the import',
          'Dropping invalid rows would leave no data rows available for the active analysis. Choose a different repair before confirming the import.',
          'Choose a different missing-value policy because this repair would leave no rows to import.',
          detectedAt,
        ),
        severity: 'blocking',
        repairActions: [
          {
            actionId: 'change-missing-value-policy',
            label: 'Change missing-value handling',
            command: 'import.set-missing-value-policy',
            args: {
              options: ['mark-empty', 'drop-invalid-rows'],
              currentPolicy: policy,
            },
          },
        ],
        diagnostics: {
          category: 'missing-values',
          currentPolicy: policy,
          missingValueCount: quality.missingValueCount,
          malformedValueCount: quality.malformedValueCount,
          affectedRowCount: quality.affectedRowCount,
        },
      },
    ];
  }

  return [
    {
      ...createIssueBase(
        'issue_import_missing_value_policy_applied',
        'import.missing-value.policy-applied',
        'Missing-value handling is configured',
        displayMissingValuePolicy(policy),
        displayMissingValuePolicy(policy),
        detectedAt,
      ),
      severity: 'info',
      repairActions: [
        {
          actionId: 'change-missing-value-policy',
          label: 'Change missing-value handling',
          command: 'import.set-missing-value-policy',
          args: {
            options: ['mark-empty', 'drop-invalid-rows'],
            currentPolicy: policy,
          },
        },
      ],
      diagnostics: {
        category: 'missing-values',
        currentPolicy: policy,
        missingValueCount: quality.missingValueCount,
        malformedValueCount: quality.malformedValueCount,
        affectedRowCount: quality.affectedRowCount,
      },
    },
  ];
}

function buildAdditionalColumnsIssue(input: {
  previewColumnNames: string[];
  confirmedColumnNames: string[];
  acknowledgement: string | null | undefined;
  detectedAt: string;
}): IssueRecord | null {
  const additionalColumns = collectAdditionalConfirmedColumns(input.previewColumnNames, input.confirmedColumnNames);

  if (additionalColumns.length === 0) {
    return null;
  }

  const acknowledgementToken = createAdditionalColumnsAcknowledgementToken(additionalColumns);
  const additionalColumnNames = additionalColumns.map((column) => column.sourceName);

  if (input.acknowledgement === acknowledgementToken) {
    return null;
  }

  return {
    ...createIssueBase(
      'issue_import_additional_columns_confirmation',
      'import.additional-columns.confirmation-required',
      'Confirm the columns that appear outside the visible preview',
      `The confirmed dataset includes ${additionalColumns.length} additional ${additionalColumns.length === 1 ? 'column' : 'columns'} outside the visible preview window: ${additionalColumnNames.join(', ')}.`,
      'Acknowledge the additional columns that were detected outside the visible preview before confirming this import.',
      input.detectedAt,
    ),
    severity: 'blocking',
    repairActions: [
      {
        actionId: 'acknowledge-additional-columns',
        label: 'Acknowledge additional columns',
        command: 'import.acknowledge-additional-columns',
        args: {
          additionalColumns: additionalColumnNames,
          acknowledgementToken,
        },
      },
    ],
    diagnostics: {
      category: 'additional-columns',
      additionalColumns: additionalColumnNames,
      additionalColumnIndexes: additionalColumns.map((column) => column.columnIndex + 1),
      acknowledgementToken,
      visibleColumnCount: input.previewColumnNames.length,
      confirmedColumnCount: input.confirmedColumnNames.length,
    },
  };
}

export function buildImportPreviewDataset(input: TabularPreviewInput): ImportPreviewDataset {
  const detectedAt = new Date().toISOString();
  const normalizedPreviewRows = normalizeRows(input.rows);
  const normalizedFullRows =
    input.fullRows === undefined ? normalizedPreviewRows : normalizeRows(input.fullRows);
  const repairSelections = input.repairSelections ?? createDefaultImportRepairSelections();
  const autoHeaderDecision = detectHeader(normalizedPreviewRows);
  const hasHeader =
    repairSelections.headerSelection === 'first-row-header'
      ? true
      : repairSelections.headerSelection === 'first-row-data'
        ? false
        : autoHeaderDecision.hasHeader;
  const headerDecision: HeaderDecision = {
    hasHeader,
    confidence: repairSelections.headerSelection ? 'high' : autoHeaderDecision.confidence,
  };
  const previewHeaderRow = hasHeader ? normalizedPreviewRows[0] ?? [] : [];
  const headerRow = hasHeader ? normalizedFullRows[0] ?? [] : [];
  const previewBodyRows = hasHeader ? normalizedPreviewRows.slice(1) : normalizedPreviewRows;
  const bodyRows = hasHeader ? normalizedFullRows.slice(1) : normalizedFullRows;
  const fullPreviewableRowCount = input.fullPreviewableRowCount ?? normalizedFullRows.length;
  const fullBodyRowCount = Math.max(fullPreviewableRowCount - (hasHeader ? 1 : 0), 0);
  const keepSingleRowHeaderPreviewRepairable =
    bodyRows.length === 0 && repairSelections.headerSelection === 'first-row-header';

  if (normalizedFullRows.length === 0 || (bodyRows.length === 0 && !keepSingleRowHeaderPreviewRepairable)) {
    throw new Error('The selected source did not contain any previewable data rows after normalization.');
  }

  const confirmedMaxColumnCount = bodyRows.reduce((max, row) => Math.max(max, row.length), headerRow.length);
  const confirmedColumnNames = Array.from({ length: confirmedMaxColumnCount }, (_, index) => {
    const candidate = headerRow[index];

    return candidate && candidate.length > 0 ? candidate : `Column ${index + 1}`;
  });
  const initialColumnValues = confirmedColumnNames.map((_, index) => bodyRows.map((row) => row[index] ?? ''));
  const inferredColumns = initialColumnValues.map((values, index) => {
    const inference = inferColumnType(values);
    const sourceName = confirmedColumnNames[index] ?? `Column ${index + 1}`;

    return {
      columnId: toColumnId(index),
      sourceName,
      inference,
    };
  });
  const validationColumnTypes = inferredColumns.map((column, index) =>
    resolveExplicitColumnType(initialColumnValues[index] ?? [], repairSelections.columnTypeOverrides[column.columnId]),
  );
  const valueQuality = collectValueQuality(bodyRows, validationColumnTypes);
  const policyAdjustedBodyRowsResult = applyMissingValuePolicy(
    bodyRows,
    validationColumnTypes,
    repairSelections.missingValuePolicy,
  );
  const previewPolicyAdjustedBodyRowsResult = applyMissingValuePolicy(
    previewBodyRows,
    validationColumnTypes,
    repairSelections.missingValuePolicy,
  );
  const policyAdjustedBodyRows = policyAdjustedBodyRowsResult.rows;
  const confirmedColumnValues = confirmedColumnNames.map((_, index) => policyAdjustedBodyRows.map((row) => row[index] ?? ''));
  const confirmedInferredColumns = confirmedColumnValues.map((values, index) => {
    const inference = inferColumnType(values);
    const sourceName = confirmedColumnNames[index] ?? `Column ${index + 1}`;

    return {
      columnId: toColumnId(index),
      sourceName,
      inference,
    };
  });
  const previewRowsForDisplay = policyAdjustedBodyRowsResult.removedAllRows
    ? previewBodyRows
    : previewPolicyAdjustedBodyRowsResult.rows.length > 0 || policyAdjustedBodyRows.length === 0
      ? previewPolicyAdjustedBodyRowsResult.rows
      : policyAdjustedBodyRows;
  const previewTargetRows =
    input.rowLimit === undefined ? previewRowsForDisplay : previewRowsForDisplay.slice(0, input.rowLimit);
  const visiblePreviewMaxColumnCount = previewTargetRows.reduce(
    (max, row) => Math.max(max, row.length),
    previewHeaderRow.length,
  );
  const previewColumnNames = Array.from({ length: visiblePreviewMaxColumnCount }, (_, index) => {
    const candidate = previewHeaderRow[index];

    return candidate && candidate.length > 0 ? candidate : `Column ${index + 1}`;
  });

  const isPartialPreview =
    input.rowOverflow === true ||
    fullBodyRowCount > previewTargetRows.length ||
    (input.rowLimit !== undefined && fullBodyRowCount > input.rowLimit);
  const columns = previewColumnNames.map((sourceName, index) => {
    const values = previewTargetRows.map((row) => row[index] ?? '');
    const baseInference = confirmedInferredColumns[index]?.inference ?? inferColumnType(values);
    const displayedType =
      repairSelections.columnTypeOverrides[toColumnId(index)] ?? baseInference.inferredType;

    return {
      columnId: toColumnId(index),
      sourceName,
      sampleValues: values.filter((value) => value.length > 0).slice(0, SAMPLE_VALUE_LIMIT),
      inferredType: displayedType,
      confidence:
        repairSelections.columnTypeOverrides[toColumnId(index)] !== undefined ? 'high' : baseInference.confidence,
      nonEmptyCount: values.filter((value) => value.length > 0).length,
      nullCount: values.filter((value) => value.length === 0).length,
    } as const;
  });

  const numericColumns = columns.filter((column) => column.inferredType === 'numeric').length;
  const dateColumns = columns.filter((column) => column.inferredType === 'date').length;
  const uncertainColumns = confirmedInferredColumns.filter(
    (column) => column.inference.inferredType === 'mixed' && repairSelections.columnTypeOverrides[column.columnId] === undefined,
  );

  const assumptions: ImportPreviewAssumption[] = [
    {
      assumptionId: 'assumption_delimiter',
      category: 'delimiter',
      label: 'Delimiter handling',
      value:
        input.sourceKind === 'excel-file'
          ? 'Workbook cells do not rely on a delimiter'
          : input.delimiter
            ? displayDelimiter(input.delimiter)
            : 'Delimiter needs confirmation',
      confidence:
        input.sourceKind === 'excel-file'
          ? 'high'
          : repairSelections.delimiter
            ? 'high'
            : requiresExplicitDelimiterConfirmation({
                benchmarkScenario: input.benchmarkScenario,
                delimiterRequiresConfirmation: input.delimiterRequiresConfirmation,
              })
              ? 'medium'
              : input.delimiter
                ? 'high'
                : 'medium',
      details:
        input.sourceKind === 'excel-file'
          ? 'Excel preview reads workbook cells directly from the first sheet.'
          : 'The worker keeps the selected delimiter visible and can rerun the preview after you change it.',
    },
    {
      assumptionId: 'assumption_header',
      category: 'header',
      label: 'Header row',
      value: hasHeader ? 'Treating the first row as headers' : 'Treating the first row as data',
      confidence: headerDecision.confidence,
      details: hasHeader
        ? 'Column labels come from the first visible row.'
        : 'Generic column names stay in place because the first row is part of the dataset.',
    },
    {
      assumptionId: 'assumption_numeric',
      category: 'numeric',
      label: 'Numeric inference',
      value: `${numericColumns} ${numericColumns === 1 ? 'column' : 'columns'} confirmed as numeric`,
      confidence: numericColumns > 0 ? 'high' : 'medium',
      details: 'Numeric columns can be confirmed directly from the repair cards when mixed values appear.',
    },
    {
      assumptionId: 'assumption_date',
      category: 'date',
      label: 'Date inference',
      value: `${dateColumns} ${dateColumns === 1 ? 'column' : 'columns'} confirmed as date`,
      confidence: dateColumns > 0 ? 'high' : 'medium',
      details: 'Date confirmation uses the preview sample and any explicit repair choices.',
    },
    {
      assumptionId: 'assumption_uncertainty',
      category: 'uncertainty',
      label: 'Repair scan',
      value:
        uncertainColumns.length > 0
          ? `${uncertainColumns.length} ${uncertainColumns.length === 1 ? 'column needs' : 'columns need'} confirmation`
          : 'No unresolved mixed-type columns remain in the confirmed dataset',
      confidence: uncertainColumns.length > 0 ? 'medium' : 'high',
      details: 'Repair cards stay inline so uncertain parsing choices can be confirmed before import.',
    },
  ];

  const uncertainties: ImportPreviewUncertainty[] = uncertainColumns.map((column) => ({
    uncertaintyId: `uncertainty_${column.columnId}`,
    category: 'uncertainty',
    severity: 'medium',
    message: `"${column.sourceName}" mixes multiple value patterns and must be confirmed before import.`,
    columnId: column.columnId,
  }));

  if (headerDecision.confidence !== 'high') {
    uncertainties.unshift({
      uncertaintyId: 'uncertainty_header_detection',
      category: 'header',
      severity: 'low',
      message: 'Header detection stayed conservative and needs confirmation before import.',
    });
  }

  const issues = [
    buildDelimiterIssue({
      delimiter: input.delimiter ?? null,
      benchmarkScenario: input.benchmarkScenario,
      delimiterRequiresConfirmation: input.delimiterRequiresConfirmation,
      selectionApplied: repairSelections.delimiter !== null,
      detectedAt,
    }),
    buildHeaderIssue({
      headerDecision,
      headerRow: normalizedFullRows[0] ?? [],
      benchmarkScenario: input.benchmarkScenario,
      selectionApplied: repairSelections.headerSelection !== null,
      bodyRowCount: bodyRows.length,
      detectedAt,
    }),
    ...confirmedInferredColumns.map((column) =>
      buildColumnTypeIssue(
        column.columnId,
        column.sourceName,
        column.inference.inferredType,
        repairSelections.columnTypeOverrides[column.columnId] !== undefined,
        detectedAt,
      ),
    ),
    ...buildMissingValueIssues(
      valueQuality,
      repairSelections.missingValuePolicy,
      policyAdjustedBodyRowsResult.removedAllRows,
      detectedAt,
    ),
    buildAdditionalColumnsIssue({
      previewColumnNames,
      confirmedColumnNames,
      acknowledgement: repairSelections.additionalColumnsAcknowledgement,
      detectedAt,
    }),
  ].filter((issue): issue is IssueRecord => issue !== null);

  const confirmedDatasetColumnTypes = confirmedColumnNames.map((_, index) =>
    resolveExplicitColumnType(confirmedColumnValues[index] ?? [], repairSelections.columnTypeOverrides[toColumnId(index)]),
  );
  const confirmedDatasetRowCount =
    repairSelections.missingValuePolicy === 'drop-invalid-rows' ? policyAdjustedBodyRows.length : fullBodyRowCount;
  const confirmedDatasetColumnDataTypes = confirmedDatasetColumnTypes.map((confirmedColumnType) =>
    confirmedColumnType === 'numeric' ? 'number' : confirmedColumnType === 'date' ? 'date' : 'string',
  );

  const confirmedDataset = {
    rowCount: confirmedDatasetRowCount,
    columnCount: confirmedColumnNames.length,
    fingerprint: createConfirmedDatasetFingerprint({
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      sheetName: input.sheetName ?? null,
      benchmarkScenario: input.benchmarkScenario ?? null,
      delimiter: input.delimiter ?? null,
      repairSelections,
      columnNames: confirmedColumnNames,
      columnTypes: confirmedDatasetColumnDataTypes,
      rows: policyAdjustedBodyRows,
      rowCount: confirmedDatasetRowCount,
      isPartialPreview,
    }),
    columns: confirmedColumnNames.map((sourceName, index) => ({
      columnId: toColumnId(index),
      sourceName,
      dataType: confirmedDatasetColumnDataTypes[index] ?? 'string',
    })) satisfies NonNullable<ImportPreviewDataset['confirmedDataset']>['columns'],
    rows: policyAdjustedBodyRows.map((row) =>
      Object.fromEntries(
        confirmedColumnNames.map((_, index) => [toColumnId(index), row[index] ?? '']),
      ),
    ) satisfies NonNullable<ImportPreviewDataset['confirmedDataset']>['rows'],
  } satisfies NonNullable<ImportPreviewDataset['confirmedDataset']>;

  return {
    previewId: createPreviewId({
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      sheetName: input.sheetName ?? null,
      benchmarkScenario: input.benchmarkScenario ?? null,
      delimiter: input.delimiter ?? null,
      delimiterRequiresConfirmation: input.delimiterRequiresConfirmation,
      previewRows: previewTargetRows,
      repairSelections,
      confirmedDatasetFingerprint: confirmedDataset.fingerprint,
    }),
    source: {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      mimeType: input.mimeType ?? null,
      sheetName: input.sheetName ?? null,
      benchmarkScenario: input.benchmarkScenario ?? null,
    },
    rowCount: previewTargetRows.length,
    isPartialPreview,
    columnCount: columns.length,
    columns,
    sampleRows: previewTargetRows.slice(0, SAMPLE_ROW_LIMIT).map((row, rowIndex) => ({
      rowId: toRowId(rowIndex),
      cells: columns.map((column, columnIndex) => ({
        columnId: column.columnId,
        value: row[columnIndex] ?? '',
      })),
    })),
    assumptions,
    uncertainties,
    issues,
    repairSelections,
    ...(input.includeConfirmedDataset !== false ? { confirmedDataset } : {}),
    timing: {
      durationMs: Math.max(0, Math.round(input.durationMs)),
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      exceededBudget: input.durationMs > IMPORT_PREVIEW_BUDGET_MS,
    },
  };
}
