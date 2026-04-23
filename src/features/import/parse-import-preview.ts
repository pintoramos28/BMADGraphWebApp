import Papa, { type ParseResult, type ParseStepResult, type Parser } from 'papaparse';
import * as XLSX from 'xlsx';

import {
  createDefaultImportRepairSelections,
  type ImportBenchmarkScenario,
  type ImportSourceKind,
} from './preview-model';
import { buildImportPreviewDataset, type TabularPreviewInput } from './normalize-preview';

export const IMPORT_PREVIEW_ROW_LIMIT = 200;
const IMPORT_PREVIEW_SAMPLE_ROW_LIMIT = IMPORT_PREVIEW_ROW_LIMIT + 2;

export interface ImportPreviewParseInput {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string | undefined;
  mimeType?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  textContent?: string | null | undefined;
  binaryContent?: ArrayBuffer | null | undefined;
  repairSelections?: ReturnType<typeof createDefaultImportRepairSelections> | undefined;
  materializeConfirmedDataset?: boolean | undefined;
}

const DELIMITER_CANDIDATES = [',', '\t', ';', '|'] as const;
const DELIMITER_SAMPLE_LINE_LIMIT = 10;
const DELIMITER_OVERRIDE_MIN_REPEATED_LINE_COUNT = 2;

function normalizePreviewCell(value: string) {
  return value.trim();
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

function scoreHeaderCandidate(value: string) {
  if (value.length === 0) {
    return 0;
  }

  if (looksNumeric(value) || looksDate(value)) {
    return 0;
  }

  return /[A-Za-z]/.test(value) ? 1 : 0.5;
}

function detectHeader(rows: string[][]) {
  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];

  if (firstRow.length === 0) {
    return false;
  }

  const firstScore = firstRow.reduce((total, value) => total + scoreHeaderCandidate(value), 0);
  const secondScore = secondRow.reduce((total, value) => total + scoreHeaderCandidate(value), 0);
  const uniqueCount = new Set(firstRow.map((value) => value.toLowerCase())).size;
  const uniqueEnough = uniqueCount === firstRow.length;
  const ratio = firstRow.length > 0 ? firstScore / firstRow.length : 0;

  return uniqueEnough && ratio >= 0.6 && firstScore >= secondScore;
}

function assertText(input: ImportPreviewParseInput) {
  if (!input.textContent || input.textContent.trim().length === 0) {
    throw new Error('The selected import source did not contain readable tabular text.');
  }

  return input.textContent;
}

function assertBinary(input: ImportPreviewParseInput) {
  if (!input.binaryContent || input.binaryContent.byteLength === 0) {
    throw new Error('The selected workbook could not be read from local storage.');
  }

  return input.binaryContent;
}

function normalizeDelimitedRow(row: Array<string | null | undefined>) {
  return row.map((value: string | null | undefined) => (value === undefined || value === null ? '' : String(value)));
}

function getParseErrorCode(error: ParseResult<unknown>['errors'][number]) {
  return (error as { code?: string }).code;
}

function getFatalDelimitedParseError(errors: ParseResult<unknown>['errors']) {
  return errors.find((error) => getParseErrorCode(error) !== 'UndetectableDelimiter');
}

type DelimitedSampleRecord = {
  content: string;
  delimiterCounts: Record<(typeof DELIMITER_CANDIDATES)[number], number>;
};

function createEmptyDelimiterCounts(): Record<(typeof DELIMITER_CANDIDATES)[number], number> {
  return Object.fromEntries(DELIMITER_CANDIDATES.map((delimiter) => [delimiter, 0])) as Record<
    (typeof DELIMITER_CANDIDATES)[number],
    number
  >;
}

function hasNonDelimiterOnlyContent(content: string) {
  return /[^,\t;|"\s]/.test(content);
}

function isDelimiterOnlyValue(value: string) {
  return /^[,\t;|]+$/.test(value);
}

function sampleDelimitedPreviewRecords(textContent: string) {
  const sampledRecords: DelimitedSampleRecord[] = [];
  let currentContent = '';
  let currentDelimiterCounts = createEmptyDelimiterCounts();
  let inQuotes = false;

  const flushRecord = () => {
    if (currentContent.trim().length > 0 && hasNonDelimiterOnlyContent(currentContent)) {
      sampledRecords.push({
        content: currentContent,
        delimiterCounts: currentDelimiterCounts,
      });
    }

    currentContent = '';
    currentDelimiterCounts = createEmptyDelimiterCounts();
  };

  for (let index = 0; index < textContent.length; index += 1) {
    const character = textContent[index];

    if (character === '"') {
      currentContent += character;

      if (inQuotes && textContent[index + 1] === '"') {
        currentContent += textContent[index + 1];
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (character === '\n' || character === '\r')) {
      flushRecord();

      if (character === '\r' && textContent[index + 1] === '\n') {
        index += 1;
      }

      if (sampledRecords.length >= DELIMITER_SAMPLE_LINE_LIMIT) {
        break;
      }

      continue;
    }

    if (!inQuotes && DELIMITER_CANDIDATES.includes(character as (typeof DELIMITER_CANDIDATES)[number])) {
      currentDelimiterCounts[character as (typeof DELIMITER_CANDIDATES)[number]] += 1;
    }

    currentContent += character;
  }

  if (
    sampledRecords.length < DELIMITER_SAMPLE_LINE_LIMIT &&
    currentContent.trim().length > 0 &&
    hasNonDelimiterOnlyContent(currentContent)
  ) {
    flushRecord();
  }

  return sampledRecords;
}

function detectDelimitedPreviewDelimiter(textContent: string) {
  const sampledRecords = sampleDelimitedPreviewRecords(textContent);

  const delimiterCandidates = DELIMITER_CANDIDATES.map((delimiter) => {
    const counts = sampledRecords
      .map((record) => record.delimiterCounts[delimiter])
      .filter((count) => count > 0);
    let dominantDelimiterCount = 0;
    let modeCount = 0;

    if (counts.length > 0) {
      const dominantDelimiterEntry = Array.from(
        counts.reduce((frequencies, count) => {
          frequencies.set(count, (frequencies.get(count) ?? 0) + 1);

          return frequencies;
        }, new Map<number, number>()),
      ).sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return right[0] - left[0];
      })[0];

      if (dominantDelimiterEntry) {
        dominantDelimiterCount = dominantDelimiterEntry[0];
        modeCount = dominantDelimiterEntry[1];
      }
    }

    return {
      delimiter,
      dominantDelimiterCount,
      linesWithDelimiter: counts.length,
      modeCount,
      structureScore: dominantDelimiterCount * modeCount,
    };
  })
    .sort((left, right) => {
      if (right.structureScore !== left.structureScore) {
        return right.structureScore - left.structureScore;
      }

      if (right.modeCount !== left.modeCount) {
        return right.modeCount - left.modeCount;
      }

      return right.linesWithDelimiter - left.linesWithDelimiter;
    });

  const strongestCandidate = delimiterCandidates.find(
    (candidate) => candidate.modeCount >= DELIMITER_OVERRIDE_MIN_REPEATED_LINE_COUNT,
  );
  const strongestCompetingCandidate = delimiterCandidates.find(
    (candidate) => candidate.delimiter !== strongestCandidate?.delimiter && candidate.modeCount > 0,
  );
  const candidatesWithSignal = delimiterCandidates.filter((candidate) => candidate.modeCount > 0);

  if (!strongestCandidate) {
    return {
      delimiter: '',
      requiresDelimiterConfirmation: candidatesWithSignal.length > 1,
    };
  }

  if (
    strongestCompetingCandidate &&
    strongestCompetingCandidate.structureScore === strongestCandidate.structureScore &&
    strongestCompetingCandidate.modeCount === strongestCandidate.modeCount &&
    strongestCompetingCandidate.linesWithDelimiter === strongestCandidate.linesWithDelimiter
  ) {
    return {
      delimiter: '',
      requiresDelimiterConfirmation: true,
    };
  }

  if (
    strongestCompetingCandidate &&
    strongestCandidate.modeCount === DELIMITER_OVERRIDE_MIN_REPEATED_LINE_COUNT &&
    strongestCandidate.linesWithDelimiter === DELIMITER_OVERRIDE_MIN_REPEATED_LINE_COUNT &&
    strongestCandidate.dominantDelimiterCount === 1
  ) {
    return {
      delimiter: '',
      requiresDelimiterConfirmation: true,
    };
  }

  return {
    delimiter: strongestCandidate.delimiter,
    requiresDelimiterConfirmation: false,
  };
}

function parseDelimitedRows(
  textContent: string,
  options: {
    delimiterOverride?: ReturnType<typeof createDefaultImportRepairSelections>['delimiter'];
  } = {},
) {
  const detectedDelimiter = options.delimiterOverride
    ? {
        delimiter: options.delimiterOverride,
        requiresDelimiterConfirmation: false,
      }
    : detectDelimitedPreviewDelimiter(textContent);
  const configuredDelimiter = detectedDelimiter.delimiter;
  const collectRows = (stopAfterPreviewBoundary: boolean) => {
    const previewRows: string[][] = [];
    const confirmedRows: string[][] = [];
    let parsedDelimiter: string | null = null;
    let parseError: string | null = null;
    let totalPreviewableRowCount = 0;
    let reachedPreviewBoundary = false;

    Papa.parse<string[]>(textContent, {
      delimiter: configuredDelimiter,
      preview: 0,
      skipEmptyLines: 'greedy',
      step: (result: ParseStepResult<unknown>, parser: Parser) => {
        const fatalError = getFatalDelimitedParseError(result.errors);

        if (fatalError) {
          parseError = fatalError.message ?? 'The tabular text could not be parsed.';
          parser.abort();
          return;
        }

        parsedDelimiter = result.meta.delimiter || parsedDelimiter;
        const normalizedRow = normalizeDelimitedRow(
          Array.isArray(result.data) ? (result.data as Array<string | null | undefined>) : [],
        );

        if (!hasPreviewableValues(normalizedRow)) {
          return;
        }

        totalPreviewableRowCount += 1;

        if (!stopAfterPreviewBoundary) {
          confirmedRows.push(normalizedRow);
        }

        if (previewRows.length < IMPORT_PREVIEW_SAMPLE_ROW_LIMIT) {
          previewRows.push(normalizedRow);
        }

        if (stopAfterPreviewBoundary && previewRows.length >= IMPORT_PREVIEW_SAMPLE_ROW_LIMIT) {
          reachedPreviewBoundary = true;
          parser.abort();
        }
      },
      complete: (result: ParseResult<unknown>) => {
        parsedDelimiter = result.meta.delimiter || parsedDelimiter;
        const fatalError = getFatalDelimitedParseError(result.errors);

        if (!parseError && fatalError) {
          parseError = fatalError.message ?? 'The tabular text could not be parsed.';
        }
      },
    });

    if (parseError) {
      throw new Error(parseError);
    }

    return {
      delimiter: parsedDelimiter,
      previewRows,
      confirmedRows: stopAfterPreviewBoundary ? previewRows : confirmedRows,
      totalPreviewableRowCount,
      reachedPreviewBoundary,
    };
  };

  const sampledRows = collectRows(true);

  if (!sampledRows.reachedPreviewBoundary) {
    return {
      delimiter: sampledRows.delimiter,
      previewRows: sampledRows.previewRows,
      confirmedRows: sampledRows.confirmedRows,
      totalPreviewableRowCount: sampledRows.totalPreviewableRowCount,
      requiresDelimiterConfirmation: detectedDelimiter.requiresDelimiterConfirmation,
    };
  }

  const confirmedRows = collectRows(false);

  return {
    delimiter: confirmedRows.delimiter ?? sampledRows.delimiter,
    previewRows: sampledRows.previewRows,
    confirmedRows: confirmedRows.confirmedRows,
    totalPreviewableRowCount: confirmedRows.totalPreviewableRowCount,
    requiresDelimiterConfirmation: detectedDelimiter.requiresDelimiterConfirmation,
  };
}

type DenseWorksheet = Array<Array<XLSX.CellObject | undefined> | undefined> & XLSX.WorkSheet;

interface PopulatedWorksheetRow {
  rowIndex: number;
  columnIndexes: number[];
}

interface PreviewableWorksheetRow {
  worksheetRow: PopulatedWorksheetRow;
  rowValues: string[];
}

function toSortedNumericKeys(value: object) {
  return Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .map((key) => Number(key))
    .sort((left, right) => left - right);
}

function listPopulatedWorksheetRows(sheet: XLSX.WorkSheet): PopulatedWorksheetRow[] {
  if (Array.isArray(sheet)) {
    const denseSheet = sheet as DenseWorksheet;

    return toSortedNumericKeys(denseSheet)
      .map((rowIndex) => {
        const denseRow = denseSheet[rowIndex];

        return {
          rowIndex,
          columnIndexes: Array.isArray(denseRow) ? toSortedNumericKeys(denseRow) : [],
        };
      })
      .filter((row) => row.columnIndexes.length > 0);
  }

  const rowMap = new Map<number, Set<number>>();

  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) {
      continue;
    }

    const cell = sheet[key];

    if (!cell) {
      continue;
    }

    const { r: rowIndex, c: columnIndex } = XLSX.utils.decode_cell(key);
    const rowColumns = rowMap.get(rowIndex) ?? new Set<number>();
    rowColumns.add(columnIndex);
    rowMap.set(rowIndex, rowColumns);
  }

  return Array.from(rowMap.entries())
    .sort(([leftRowIndex], [rightRowIndex]) => leftRowIndex - rightRowIndex)
    .map(([rowIndex, columnIndexes]) => ({
      rowIndex,
      columnIndexes: Array.from(columnIndexes).sort((left, right) => left - right),
    }));
}

function hasPreviewableValues(row: string[]) {
  const populatedValues = row.map((value) => value.trim()).filter((value) => value.length > 0);

  if (populatedValues.length === 0) {
    return false;
  }

  if (populatedValues.some((value) => hasNonDelimiterOnlyContent(value))) {
    return true;
  }

  if (!populatedValues.every((value) => isDelimiterOnlyValue(value))) {
    return false;
  }

  const firstPopulatedValue = populatedValues[0];

  if (row.length === 1 && populatedValues.length === 1 && firstPopulatedValue && firstPopulatedValue.length > 1) {
    return false;
  }

  return true;
}

function collectWorksheetPreviewColumnIndexes(rows: PopulatedWorksheetRow[]) {
  return Array.from(new Set(rows.flatMap((row) => row.columnIndexes))).sort((left, right) => left - right);
}

function materializeWorksheetRows(
  worksheetRows: PopulatedWorksheetRow[],
  previewColumnIndexes: number[],
  readCellValue: (rowIndex: number, columnIndex: number) => string,
) {
  return worksheetRows.map(({ rowIndex }) => previewColumnIndexes.map((columnIndex) => readCellValue(rowIndex, columnIndex)));
}

function readWorksheetRowValues(
  worksheetRow: PopulatedWorksheetRow,
  readCellValue: (rowIndex: number, columnIndex: number) => string,
) {
  return worksheetRow.columnIndexes.map((columnIndex) => readCellValue(worksheetRow.rowIndex, columnIndex));
}

function collectPreviewableWorksheetRows(
  worksheetRows: PopulatedWorksheetRow[],
  readCellValue: (rowIndex: number, columnIndex: number) => string,
  options: {
    rowLimit?: number;
  } = {},
) {
  const previewableRows: PreviewableWorksheetRow[] = [];
  const previewRowLimit = options.rowLimit ?? Number.POSITIVE_INFINITY;
  let reachedPreviewBoundary = false;

  for (const worksheetRow of worksheetRows) {
    const rowValues = readWorksheetRowValues(worksheetRow, readCellValue);

    if (!hasPreviewableValues(rowValues)) {
      continue;
    }

    previewableRows.push({
      worksheetRow,
      rowValues,
    });

    if (previewableRows.length >= previewRowLimit) {
      reachedPreviewBoundary = true;
      break;
    }
  }

  return {
    previewableRows,
    reachedPreviewBoundary,
  };
}

function parseWorkbookRows(binaryContent: ArrayBuffer) {
  const workbook = XLSX.read(binaryContent, {
    type: 'array',
    dense: true,
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The workbook did not contain any sheets to preview.');
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    throw new Error('The workbook sheet could not be opened.');
  }

  const populatedWorksheetRows = listPopulatedWorksheetRows(sheet);

  const readCellValue = (rowIndex: number, columnIndex: number) => {
    const denseRow = (sheet as DenseWorksheet)[rowIndex];
    const cell =
      Array.isArray(denseRow) && columnIndex < denseRow.length
        ? denseRow[columnIndex]
        : sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];

    if (!cell) {
      return '';
    }

    return String(cell.w ?? cell.v ?? '');
  };

  if (populatedWorksheetRows.length === 0) {
    throw new Error('The first worksheet did not contain any previewable rows.');
  }

  const sampledPreviewableRows = collectPreviewableWorksheetRows(populatedWorksheetRows, readCellValue, {
    rowLimit: IMPORT_PREVIEW_SAMPLE_ROW_LIMIT,
  });
  const sampledPreviewableWorksheetRows = sampledPreviewableRows.previewableRows;

  if (sampledPreviewableWorksheetRows.length === 0) {
    throw new Error('The first worksheet did not contain any previewable rows.');
  }

  let visiblePreviewRowCount = Math.min(sampledPreviewableWorksheetRows.length, IMPORT_PREVIEW_ROW_LIMIT + 1);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidateVisibleRows = sampledPreviewableWorksheetRows
      .slice(0, visiblePreviewRowCount)
      .map((entry) => entry.worksheetRow);
    const candidateColumnIndexes = collectWorksheetPreviewColumnIndexes(candidateVisibleRows);
    const headerProbeRows = materializeWorksheetRows(
      candidateVisibleRows.slice(0, 2),
      candidateColumnIndexes,
      readCellValue,
    ).map((row) => row.map((value) => normalizePreviewCell(value)));
    const resolvedVisiblePreviewRowCount = Math.min(
      sampledPreviewableWorksheetRows.length,
      detectHeader(headerProbeRows) ? IMPORT_PREVIEW_ROW_LIMIT + 1 : IMPORT_PREVIEW_ROW_LIMIT,
    );

    if (resolvedVisiblePreviewRowCount === visiblePreviewRowCount) {
      break;
    }

    visiblePreviewRowCount = resolvedVisiblePreviewRowCount;
  }

  const visibleWorksheetRows = sampledPreviewableWorksheetRows
    .slice(0, visiblePreviewRowCount)
    .map((entry) => entry.worksheetRow);
  const previewColumnIndexes = collectWorksheetPreviewColumnIndexes(visibleWorksheetRows);
  const previewRows = materializeWorksheetRows(
    sampledPreviewableWorksheetRows
      .slice(0, visiblePreviewRowCount + 1)
      .map((entry) => entry.worksheetRow),
    previewColumnIndexes,
    readCellValue,
  );
  const allPreviewableWorksheetRows = sampledPreviewableRows.reachedPreviewBoundary
    ? collectPreviewableWorksheetRows(populatedWorksheetRows, readCellValue).previewableRows
    : sampledPreviewableWorksheetRows;
  const confirmedColumnIndexes = collectWorksheetPreviewColumnIndexes(
    allPreviewableWorksheetRows.map((entry) => entry.worksheetRow),
  );
  const confirmedRows = materializeWorksheetRows(
    allPreviewableWorksheetRows.map((entry) => entry.worksheetRow),
    confirmedColumnIndexes,
    readCellValue,
  );

  if (previewRows.length === 0) {
    throw new Error('The first worksheet did not contain any previewable rows.');
  }

  return {
    hasAdditionalPreviewableRows: allPreviewableWorksheetRows.length > visiblePreviewRowCount,
    previewRows,
    confirmedRows,
    totalPreviewableRowCount: allPreviewableWorksheetRows.length,
    sheetName: firstSheetName,
  };
}

export async function parseImportPreview(input: ImportPreviewParseInput) {
  const startedAt = performance.now();
  const repairSelections = input.repairSelections ?? createDefaultImportRepairSelections();
  let normalizedInput: Omit<TabularPreviewInput, 'durationMs'>;

  if (input.sourceKind === 'excel-file') {
    const workbook = parseWorkbookRows(assertBinary(input));
    normalizedInput = {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      sheetName: workbook.sheetName,
      benchmarkScenario: input.benchmarkScenario ?? null,
      rowLimit: IMPORT_PREVIEW_ROW_LIMIT,
      rowOverflow: workbook.hasAdditionalPreviewableRows,
      fullPreviewableRowCount: workbook.totalPreviewableRowCount,
      rows: workbook.previewRows,
      fullRows: workbook.confirmedRows,
      repairSelections,
    };
  } else {
    const delimited = parseDelimitedRows(assertText(input), {
      delimiterOverride: repairSelections.delimiter,
    });
    normalizedInput = {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      benchmarkScenario: input.benchmarkScenario ?? null,
      delimiter: delimited.delimiter,
      delimiterRequiresConfirmation: delimited.requiresDelimiterConfirmation,
      rowLimit: IMPORT_PREVIEW_ROW_LIMIT,
      rowOverflow: delimited.totalPreviewableRowCount > delimited.previewRows.length,
      fullPreviewableRowCount: delimited.totalPreviewableRowCount,
      rows: delimited.previewRows,
      fullRows: delimited.confirmedRows,
      repairSelections,
    };
  }

  const durationMs = performance.now() - startedAt;

  return buildImportPreviewDataset({
    ...normalizedInput,
    includeConfirmedDataset: input.materializeConfirmedDataset === true,
    durationMs,
  });
}
