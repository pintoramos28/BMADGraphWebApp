import type { ImportConfidence, ImportPreviewDataset, ImportSourceKind } from './preview-model';
import { IMPORT_PREVIEW_BUDGET_MS } from './benchmark-timing';

export interface TabularPreviewInput {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string;
  mimeType?: string | null;
  sheetName?: string | null;
  delimiter?: string | null;
  rows: string[][];
  durationMs: number;
}

const SAMPLE_ROW_LIMIT = 8;
const SAMPLE_VALUE_LIMIT = 3;

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

function detectHeader(rows: string[][]) {
  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];

  if (firstRow.length === 0) {
    return {
      hasHeader: false,
      confidence: 'low' as ImportConfidence,
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
  } as const;
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

function benchmarkScenarioForSource(sourceKind: ImportSourceKind) {
  if (sourceKind === 'excel-file') {
    return 'import.clean.excel-preview' as const;
  }

  if (sourceKind === 'pasted-table') {
    return 'import.clean.paste-preview' as const;
  }

  return 'import.clean.csv-preview' as const;
}

export function buildImportPreviewDataset(input: TabularPreviewInput): ImportPreviewDataset {
  const normalizedRows = normalizeRows(input.rows);
  const headerDetection = detectHeader(normalizedRows);
  const headerRow = headerDetection.hasHeader ? normalizedRows[0] ?? [] : [];
  const bodyRows = headerDetection.hasHeader ? normalizedRows.slice(1) : normalizedRows;
  const maxColumnCount = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnNames = Array.from({ length: maxColumnCount }, (_, index) => {
    const candidate = headerRow[index];

    return candidate && candidate.length > 0 ? candidate : `Column ${index + 1}`;
  });
  const columns = columnNames.map((sourceName, index) => {
    const values = bodyRows.map((row) => row[index] ?? '');
    const inference = inferColumnType(values);

    return {
      columnId: toColumnId(index),
      sourceName,
      sampleValues: values.filter((value) => value.length > 0).slice(0, SAMPLE_VALUE_LIMIT),
      inferredType: inference.inferredType,
      confidence: inference.confidence,
      nonEmptyCount: values.filter((value) => value.length > 0).length,
      nullCount: values.filter((value) => value.length === 0).length,
    };
  });

  const numericColumns = columns.filter((column) => column.inferredType === 'numeric').length;
  const dateColumns = columns.filter((column) => column.inferredType === 'date').length;
  const uncertainColumns = columns.filter((column) => column.inferredType === 'mixed');

  const assumptions = [
    {
      assumptionId: 'assumption_delimiter',
      category: 'delimiter' as const,
      label: 'Delimiter handling',
      value: input.sourceKind === 'excel-file' ? 'Workbook cells do not rely on a delimiter' : displayDelimiter(input.delimiter),
      confidence: input.sourceKind === 'excel-file' || input.delimiter ? 'high' : 'medium',
      details:
        input.sourceKind === 'excel-file'
          ? 'Excel preview reads workbook cells directly from the first sheet.'
          : 'The preview normalizer keeps the detected delimiter visible before commit.',
    },
    {
      assumptionId: 'assumption_header',
      category: 'header' as const,
      label: 'Header row',
      value: headerDetection.hasHeader ? 'Detected in the first row' : 'No header row detected',
      confidence: headerDetection.confidence,
      details: headerDetection.hasHeader
        ? 'The first row looked more like field labels than data values.'
        : 'The first row was treated as data because the header signal was weak.',
    },
    {
      assumptionId: 'assumption_numeric',
      category: 'numeric' as const,
      label: 'Numeric inference',
      value: `${numericColumns} ${numericColumns === 1 ? 'column' : 'columns'} inferred as numeric`,
      confidence: numericColumns > 0 ? 'high' : 'medium',
      details: 'Only columns with consistently numeric sample values are marked numeric.',
    },
    {
      assumptionId: 'assumption_date',
      category: 'date' as const,
      label: 'Date inference',
      value: `${dateColumns} ${dateColumns === 1 ? 'column' : 'columns'} inferred as date`,
      confidence: dateColumns > 0 ? 'high' : 'medium',
      details: 'Date inference uses parseable, non-numeric values from the preview sample.',
    },
    {
      assumptionId: 'assumption_uncertainty',
      category: 'uncertainty' as const,
      label: 'Uncertainty scan',
      value:
        uncertainColumns.length > 0
          ? `${uncertainColumns.length} ${uncertainColumns.length === 1 ? 'column needs' : 'columns need'} review`
          : 'No mixed-type columns found in the preview sample',
      confidence: uncertainColumns.length > 0 ? 'medium' : 'high',
      details: 'Mixed-type columns stay visible as uncertainty instead of silently coercing values.',
    },
  ];

  const uncertainties = uncertainColumns.map((column) => ({
    uncertaintyId: `uncertainty_${column.columnId}`,
    category: 'uncertainty' as const,
    severity: 'medium' as const,
    message: `"${column.sourceName}" mixes numeric/date-looking values with text and should be confirmed before commit.`,
    columnId: column.columnId,
  }));

  if (!headerDetection.hasHeader) {
    uncertainties.unshift({
      uncertaintyId: 'uncertainty_header_detection',
      category: 'header' as const,
      severity: 'low' as const,
      message: 'Header detection stayed conservative. Review the first row if those values are actually column names.',
    });
  }

  return {
    previewId: `preview_${input.sourceKind}_${Math.max(1, bodyRows.length)}_${Math.max(1, maxColumnCount)}`,
    source: {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      mimeType: input.mimeType ?? null,
      sheetName: input.sheetName ?? null,
      benchmarkScenario: benchmarkScenarioForSource(input.sourceKind),
    },
    rowCount: bodyRows.length,
    columnCount: columns.length,
    columns,
    sampleRows: bodyRows.slice(0, SAMPLE_ROW_LIMIT).map((row, rowIndex) => ({
      rowId: toRowId(rowIndex),
      cells: columns.map((column, columnIndex) => ({
        columnId: column.columnId,
        value: row[columnIndex] ?? '',
      })),
    })),
    assumptions,
    uncertainties,
    timing: {
      durationMs: Math.max(0, Math.round(input.durationMs)),
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      exceededBudget: input.durationMs > IMPORT_PREVIEW_BUDGET_MS,
    },
  };
}
