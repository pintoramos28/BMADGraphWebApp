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

function cellToPreviewText(cell: XLSX.CellObject | undefined) {
  return cell ? String(cell.w ?? cell.v ?? '') : '';
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
    materializeConfirmedDataset?: boolean | undefined;
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
        } else if (stopAfterPreviewBoundary) {
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

  if (!sampledRows.reachedPreviewBoundary || options.materializeConfirmedDataset !== true) {
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
const MAX_DENSE_PREVIEW_BLANK_GAP_SCAN = 20;
const MAX_SPARSE_PREVIEW_BLANK_GAP_SCAN = 20;
const MAX_DENSE_FALLBACK_OWN_ROW_SCAN = 1_024;
const MAX_SPARSE_FALLBACK_OWN_CELL_SCAN = 16_384;
const MAX_SPARSE_FALLBACK_OWN_KEY_SCAN = 4_096;
const MAX_SPARSE_FALLBACK_LEADING_EMPTY_ROW_SCAN = 50;
const MAX_SPARSE_FALLBACK_GRID_PROBE_CELL_SCAN = MAX_SPARSE_FALLBACK_OWN_CELL_SCAN;
const MAX_SPARSE_PREVIEW_COLUMN_PROBE_SPAN = 256;
const MAX_SAFE_WORKSHEET_COLUMN_INDEX = 16_383;

interface PopulatedWorksheetRow {
  rowIndex: number;
  columnIndexes: number[];
}

interface PreviewableWorksheetRow {
  worksheetRow: PopulatedWorksheetRow;
  rowValues: string[];
}

interface PreviewableWorksheetRowsResult {
  previewableRows: PreviewableWorksheetRow[];
  reachedPreviewBoundary: boolean;
  stoppedBeforeEnd?: boolean | undefined;
}

interface CollectPreviewableWorksheetRowsOptions {
  rowLimit?: number;
}

function toSortedNumericKeys(value: object) {
  return Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .map((key) => Number(key))
    .sort((left, right) => left - right);
}

function* iterateDenseNumericRowIndexes(value: DenseWorksheet) {
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || !/^\d+$/.test(key)) {
      continue;
    }

    yield Number(key);
  }
}

function getOwnDenseWorksheetRow(value: DenseWorksheet, rowIndex: number) {
  const descriptor = Object.getOwnPropertyDescriptor(value, String(rowIndex));

  return descriptor?.value;
}

function getOwnDataPropertyValue(value: object, property: PropertyKey) {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);

  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function parseSparseCellAddress(address: string) {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address);

  if (!match) {
    return null;
  }

  const columnLabel = match[1]?.toUpperCase() ?? '';
  const rowNumber = Number(match[2]);

  if (
    columnLabel.length === 0
    || columnLabel.length > 3
    || !Number.isSafeInteger(rowNumber)
    || rowNumber <= 0
  ) {
    return null;
  }

  let columnIndex = 0;

  for (let index = 0; index < columnLabel.length; index += 1) {
    columnIndex = columnIndex * 26 + (columnLabel.charCodeAt(index) - 64);

    if (columnIndex - 1 > MAX_SAFE_WORKSHEET_COLUMN_INDEX) {
      return null;
    }
  }

  if (columnIndex <= 0 || columnIndex - 1 > MAX_SAFE_WORKSHEET_COLUMN_INDEX) {
    return null;
  }

  const cellAddress = {
    r: rowNumber - 1,
    c: columnIndex - 1,
  };

  if (address !== XLSX.utils.encode_cell(cellAddress)) {
    return null;
  }

  return cellAddress;
}

function listPopulatedWorksheetRows(sheet: XLSX.WorkSheet): PopulatedWorksheetRow[] {
  if (Array.isArray(sheet)) {
    const denseSheet = sheet as DenseWorksheet;

    return toSortedNumericKeys(denseSheet)
      .map((rowIndex) => {
        const denseRow = getOwnDenseWorksheetRow(denseSheet, rowIndex);

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

    const cellAddress = parseSparseCellAddress(key);

    if (!cellAddress) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(sheet, key);
    const cell = descriptor && 'value' in descriptor ? descriptor.value : undefined;

    if (!cell) {
      continue;
    }

    const { r: rowIndex, c: columnIndex } = cellAddress;
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

function collectSparsePreviewableWorksheetRowsFromOwnCells(
  sheet: XLSX.WorkSheet,
  readCellValue: (rowIndex: number, columnIndex: number) => string,
  rowLimit: number,
) {
  const rowMap = new Map<number, Set<number>>();
  const candidateRowLimit = rowLimit + MAX_SPARSE_FALLBACK_LEADING_EMPTY_ROW_SCAN + 1;
  let stoppedBeforeEnd = false;

  const getHighestTrackedRowIndex = () => (rowMap.size > 0 ? Math.max(...rowMap.keys()) : Number.NEGATIVE_INFINITY);
  const addCandidateColumn = (rowIndex: number, columnIndex: number) => {
    const existingRowColumns = rowMap.get(rowIndex);

    if (existingRowColumns) {
      existingRowColumns.add(columnIndex);

      return;
    }

    if (rowMap.size >= candidateRowLimit) {
      const highestTrackedRowIndex = getHighestTrackedRowIndex();

      if (rowIndex >= highestTrackedRowIndex) {
        stoppedBeforeEnd = true;

        return;
      }

      rowMap.delete(highestTrackedRowIndex);
      stoppedBeforeEnd = true;
    }

    rowMap.set(rowIndex, new Set([columnIndex]));
  };

  const collectBoundedLeadingGridCandidates = () => {
    const rowProbeLimit = rowLimit + MAX_SPARSE_FALLBACK_LEADING_EMPTY_ROW_SCAN + 1;
    const decodedRange = typeof sheet['!ref'] === 'string'
      ? (() => {
          try {
            return XLSX.utils.decode_range(sheet['!ref'] as string);
          } catch {
            return null;
          }
        })()
      : null;
    const declaredRangeFitsLeadingGrid = decodedRange !== null
      && decodedRange.s.r >= 0
      && decodedRange.s.c >= 0
      && decodedRange.e.r < rowProbeLimit
      && decodedRange.e.c < MAX_SPARSE_PREVIEW_COLUMN_PROBE_SPAN;
    const rowProbeEnd = declaredRangeFitsLeadingGrid && decodedRange !== null
      ? decodedRange.e.r + 1
      : rowProbeLimit;
    const columnProbeEnd = declaredRangeFitsLeadingGrid && decodedRange !== null
      ? decodedRange.e.c + 1
      : MAX_SPARSE_PREVIEW_COLUMN_PROBE_SPAN;
    let probedCells = 0;

    for (let rowIndex = 0; rowIndex < rowProbeEnd; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < columnProbeEnd; columnIndex += 1) {
        probedCells += 1;

        if (probedCells > MAX_SPARSE_FALLBACK_GRID_PROBE_CELL_SCAN) {
          stoppedBeforeEnd = true;

          return false;
        }

        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });

        if (!Object.prototype.hasOwnProperty.call(sheet, address)) {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(sheet, address);
        const cell = descriptor && 'value' in descriptor ? descriptor.value : undefined;

        if (cell) {
          addCandidateColumn(rowIndex, columnIndex);
        }
      }
    }

    stoppedBeforeEnd = !declaredRangeFitsLeadingGrid;

    return declaredRangeFitsLeadingGrid;
  };

  const collectPreviewableRowsFromOrderedCandidates = (
    leadingEmptyRowLimit = MAX_SPARSE_FALLBACK_LEADING_EMPTY_ROW_SCAN,
  ) => {
    const previewableRows: PreviewableWorksheetRow[] = [];
    const leadingEmptyRowIndexes = new Set<number>();
    let processedPreviewCandidateCells = 0;
    let reachedPreviewBoundary = false;

    for (const worksheetRow of worksheetRowsFromMap(rowMap)) {
      const rowValues = readWorksheetRowValues(worksheetRow, readCellValue);
      const hasPreviewableRowValues = hasPreviewableValues(rowValues);

      if (!hasPreviewableRowValues) {
        if (previewableRows.length === 0) {
          leadingEmptyRowIndexes.add(worksheetRow.rowIndex);

          if (leadingEmptyRowIndexes.size >= leadingEmptyRowLimit) {
            stoppedBeforeEnd = true;
            break;
          }
        }

        continue;
      }

      processedPreviewCandidateCells += worksheetRow.columnIndexes.length;

      if (processedPreviewCandidateCells > MAX_SPARSE_FALLBACK_OWN_CELL_SCAN) {
        stoppedBeforeEnd = true;
        break;
      }

      if (previewableRows.length >= rowLimit) {
        reachedPreviewBoundary = true;
        break;
      }

      previewableRows.push({
        worksheetRow,
        rowValues,
      });

      while (rowMap.size > rowLimit + 1) {
        const nextHighestRowIndex = getHighestTrackedRowIndex();
        rowMap.delete(nextHighestRowIndex);
      }
    }

    return {
      previewableRows,
      reachedPreviewBoundary,
    };
  };

  const leadingGridCapturedCompleteDeclaredRange = collectBoundedLeadingGridCandidates();

  const leadingGridRows = collectPreviewableRowsFromOrderedCandidates();
  const leadingGridCandidateColumnCount = Math.max(0, ...Array.from(rowMap.values(), (columns) => columns.size));

  if (
    leadingGridRows.reachedPreviewBoundary
    || (leadingGridRows.previewableRows.length > 0 && leadingGridCandidateColumnCount >= 2)
  ) {
    return {
      ...leadingGridRows,
      stoppedBeforeEnd: leadingGridRows.reachedPreviewBoundary || !leadingGridCapturedCompleteDeclaredRange,
    };
  }

  if (leadingGridRows.previewableRows.length === 0 && stoppedBeforeEnd) {
    // The bounded leading-grid probe may find only styled/empty cells before
    // later valid sparse rows. Drop those non-previewable leading candidates
    // and continue into the bounded own-key fallback before deciding the
    // workbook is empty or partial.
    rowMap.clear();
    stoppedBeforeEnd = false;
  }

  let processedOwnKeys = 0;

  for (const key in sheet) {
    if (!Object.prototype.hasOwnProperty.call(sheet, key) || key.startsWith('!')) {
      continue;
    }

    processedOwnKeys += 1;

    if (processedOwnKeys > MAX_SPARSE_FALLBACK_OWN_KEY_SCAN) {
      stoppedBeforeEnd = true;

      break;
    }

    const cellAddress = parseSparseCellAddress(key);

    if (!cellAddress) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(sheet, key);
    const cell = descriptor && 'value' in descriptor ? descriptor.value : undefined;

    if (!cell) {
      continue;
    }

    const { r: rowIndex, c: columnIndex } = cellAddress;

    if (!hasPreviewableValues([cellToPreviewText(cell)])) {
      continue;
    }

    addCandidateColumn(rowIndex, columnIndex);
  }

  const collectedRows = collectPreviewableRowsFromOrderedCandidates(candidateRowLimit);

  return {
    ...collectedRows,
    stoppedBeforeEnd: stoppedBeforeEnd || collectedRows.reachedPreviewBoundary,
  };
}

function collectSparsePreviewableWorksheetRowsForPreview(
  sheet: XLSX.WorkSheet,
  readCellValue: (rowIndex: number, columnIndex: number) => string,
  rowLimit: number,
): PreviewableWorksheetRowsResult {
  const previewableRows: PreviewableWorksheetRow[] = [];
  let reachedPreviewBoundary = false;
  let stoppedBeforeEnd = false;

  const addRowIfPreviewable = (worksheetRow: PopulatedWorksheetRow) => {
    const rowValues = readWorksheetRowValues(worksheetRow, readCellValue);

    if (!hasPreviewableValues(rowValues)) {
      return false;
    }

    if (previewableRows.length >= rowLimit) {
      reachedPreviewBoundary = true;

      return true;
    }

    previewableRows.push({
      worksheetRow,
      rowValues,
    });

    return true;
  };

  const decodedRange = typeof sheet['!ref'] === 'string'
    ? (() => {
        try {
          return XLSX.utils.decode_range(sheet['!ref'] as string);
        } catch {
          return null;
        }
      })()
    : null;

  if (decodedRange) {
    const startRow = Math.max(0, decodedRange.s.r);
    const endRow = Math.max(startRow, decodedRange.e.r);
    const startColumn = Math.max(0, Math.min(decodedRange.s.c, MAX_SAFE_WORKSHEET_COLUMN_INDEX));
    const endColumn = Math.max(startColumn, Math.min(decodedRange.e.c, MAX_SAFE_WORKSHEET_COLUMN_INDEX));
    const columnProbeSpan = endColumn - startColumn + 1;
    let blankGapScanCount = 0;

    if (columnProbeSpan > MAX_SPARSE_PREVIEW_COLUMN_PROBE_SPAN) {
      return collectSparsePreviewableWorksheetRowsFromOwnCells(sheet, readCellValue, rowLimit);
    }

    for (let rowIndex = startRow; rowIndex <= endRow && !reachedPreviewBoundary; rowIndex += 1) {
      const columnIndexes: number[] = [];

      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });

        if (!Object.prototype.hasOwnProperty.call(sheet, address)) {
          continue;
        }

        const cell = getOwnDataPropertyValue(sheet, address);

        if (cell) {
          columnIndexes.push(columnIndex);
        }
      }

      if (columnIndexes.length === 0) {
        blankGapScanCount += 1;

        if (blankGapScanCount >= MAX_SPARSE_PREVIEW_BLANK_GAP_SCAN) {
          stoppedBeforeEnd = rowIndex < endRow;
          break;
        }

        continue;
      }

      const addedPreviewableRow = addRowIfPreviewable({
        rowIndex,
        columnIndexes,
      });

      if (addedPreviewableRow) {
        blankGapScanCount = 0;

        continue;
      }

      blankGapScanCount += 1;

      if (blankGapScanCount >= MAX_SPARSE_PREVIEW_BLANK_GAP_SCAN) {
        stoppedBeforeEnd = rowIndex < endRow;
        break;
      }
    }

    if (previewableRows.length === 0 && !reachedPreviewBoundary) {
      const fallbackRows = collectSparsePreviewableWorksheetRowsFromOwnCells(sheet, readCellValue, rowLimit);

      if (fallbackRows.previewableRows.length > 0) {
        return {
          previewableRows: fallbackRows.previewableRows,
          reachedPreviewBoundary: fallbackRows.reachedPreviewBoundary,
          stoppedBeforeEnd: fallbackRows.stoppedBeforeEnd,
        };
      }
    }

    return {
      previewableRows,
      reachedPreviewBoundary,
      stoppedBeforeEnd,
    };
  }

  return collectSparsePreviewableWorksheetRowsFromOwnCells(sheet, readCellValue, rowLimit);
}

function worksheetRowsFromMap(rowMap: Map<number, Set<number>>) {
  return Array.from(rowMap.entries())
    .sort(([leftRowIndex], [rightRowIndex]) => leftRowIndex - rightRowIndex)
    .map(([rowIndex, columnIndexes]) => ({
      rowIndex,
      columnIndexes: Array.from(columnIndexes).sort((left, right) => left - right),
    }));
}

function collectPreviewableWorksheetRowsForPreview(
  sheet: XLSX.WorkSheet,
  readCellValue: (rowIndex: number, columnIndex: number) => string,
  rowLimit: number,
): PreviewableWorksheetRowsResult {
  const previewableRows: PreviewableWorksheetRow[] = [];
  let reachedPreviewBoundary = false;

  const addRowIfPreviewable = (worksheetRow: PopulatedWorksheetRow) => {
    const rowValues = readWorksheetRowValues(worksheetRow, readCellValue);

    if (!hasPreviewableValues(rowValues)) {
      return false;
    }

    if (previewableRows.length >= rowLimit) {
      reachedPreviewBoundary = true;

      return true;
    }

    previewableRows.push({
      worksheetRow,
      rowValues,
    });

    return true;
  };

  if (Array.isArray(sheet)) {
    const denseSheet = sheet as DenseWorksheet;
    let rowIndex = 0;
    let blankGapScanCount = 0;
    let stoppedAfterDenseGap = false;

    for (; rowIndex < denseSheet.length && !reachedPreviewBoundary; rowIndex += 1) {
      const denseRow = getOwnDenseWorksheetRow(denseSheet, rowIndex);

      if (!Array.isArray(denseRow)) {
        blankGapScanCount += 1;

        if (blankGapScanCount >= MAX_DENSE_PREVIEW_BLANK_GAP_SCAN) {
          rowIndex += 1;
          stoppedAfterDenseGap = true;
          break;
        }

        continue;
      }

      const columnIndexes = toSortedNumericKeys(denseRow);

      if (columnIndexes.length === 0) {
        blankGapScanCount += 1;

        if (blankGapScanCount >= MAX_DENSE_PREVIEW_BLANK_GAP_SCAN) {
          rowIndex += 1;
          stoppedAfterDenseGap = true;
          break;
        }

        continue;
      }

      const addedPreviewableRow = addRowIfPreviewable({
        rowIndex,
        columnIndexes,
      });

      if (addedPreviewableRow) {
        blankGapScanCount = 0;

        continue;
      }

      blankGapScanCount += 1;

      if (blankGapScanCount >= MAX_DENSE_PREVIEW_BLANK_GAP_SCAN) {
        rowIndex += 1;
        stoppedAfterDenseGap = true;
        break;
      }
    }

    if (!reachedPreviewBoundary && stoppedAfterDenseGap && rowIndex < denseSheet.length) {
      stoppedAfterDenseGap = false;
      let fallbackRowKeyScanCount = 0;
      let fallbackStoppedBeforeEnd = false;

      for (const populatedRowIndex of iterateDenseNumericRowIndexes(denseSheet)) {
        if (populatedRowIndex < rowIndex) {
          continue;
        }

        fallbackRowKeyScanCount += 1;

        if (fallbackRowKeyScanCount > MAX_DENSE_FALLBACK_OWN_ROW_SCAN) {
          fallbackStoppedBeforeEnd = true;
          stoppedAfterDenseGap = true;
          break;
        }

        const denseRow = getOwnDenseWorksheetRow(denseSheet, populatedRowIndex);
        const columnIndexes = Array.isArray(denseRow) ? toSortedNumericKeys(denseRow) : [];

        if (columnIndexes.length === 0) {
          continue;
        }

        addRowIfPreviewable({
          rowIndex: populatedRowIndex,
          columnIndexes,
        });

        if (reachedPreviewBoundary) {
          stoppedAfterDenseGap = true;
          break;
        }
      }

      if (!fallbackStoppedBeforeEnd && !reachedPreviewBoundary) {
        stoppedAfterDenseGap = false;
      }
    }

    return {
      previewableRows,
      reachedPreviewBoundary,
      stoppedBeforeEnd: stoppedAfterDenseGap && rowIndex < denseSheet.length,
    };
  }

  return collectSparsePreviewableWorksheetRowsForPreview(sheet, readCellValue, rowLimit);
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
  options: CollectPreviewableWorksheetRowsOptions = {},
) {
  const previewableRows: PreviewableWorksheetRow[] = [];
  const previewRowLimit = options.rowLimit ?? Number.POSITIVE_INFINITY;
  let reachedPreviewBoundary = false;

  for (const worksheetRow of worksheetRows) {
    const rowValues = readWorksheetRowValues(worksheetRow, readCellValue);

    if (!hasPreviewableValues(rowValues)) {
      continue;
    }

    if (previewableRows.length >= previewRowLimit) {
      reachedPreviewBoundary = true;
      break;
    }

    previewableRows.push({
      worksheetRow,
      rowValues,
    });
  }

  return {
    previewableRows,
    reachedPreviewBoundary,
  };
}

function parseWorkbookRows(binaryContent: ArrayBuffer, options: { materializeConfirmedDataset?: boolean | undefined } = {}) {
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

  const readCellValue = (rowIndex: number, columnIndex: number) => {
    const denseRow = Array.isArray(sheet) ? getOwnDenseWorksheetRow(sheet as DenseWorksheet, rowIndex) : undefined;
    const sparseCellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell =
      Array.isArray(denseRow) && Object.prototype.hasOwnProperty.call(denseRow, String(columnIndex))
        ? denseRow[columnIndex]
        : Object.prototype.hasOwnProperty.call(sheet, sparseCellAddress)
          ? getOwnDataPropertyValue(sheet, sparseCellAddress)
          : undefined;

    if (!cell) {
      return '';
    }

    return cellToPreviewText(cell);
  };

  const sampledPreviewableRows = collectPreviewableWorksheetRowsForPreview(
    sheet,
    readCellValue,
    IMPORT_PREVIEW_SAMPLE_ROW_LIMIT,
  );
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
  const allPreviewableWorksheetRows = options.materializeConfirmedDataset === true
    ? collectPreviewableWorksheetRows(listPopulatedWorksheetRows(sheet), readCellValue).previewableRows
    : sampledPreviewableWorksheetRows;
  const confirmedColumnIndexes = collectWorksheetPreviewColumnIndexes(
    allPreviewableWorksheetRows.map((entry) => entry.worksheetRow),
  );
  const confirmedRows = materializeWorksheetRows(
    allPreviewableWorksheetRows.map((entry) => entry.worksheetRow),
    confirmedColumnIndexes,
    readCellValue,
  );
  const previewStoppedBeforeUnscannedRows =
    sampledPreviewableRows.stoppedBeforeEnd === true && options.materializeConfirmedDataset !== true;
  const totalPreviewableRowCount = previewStoppedBeforeUnscannedRows
    ? sampledPreviewableWorksheetRows.length + 1
    : sampledPreviewableRows.reachedPreviewBoundary && options.materializeConfirmedDataset !== true
      ? sampledPreviewableWorksheetRows.length + 1
      : allPreviewableWorksheetRows.length;

  if (previewRows.length === 0) {
    throw new Error('The first worksheet did not contain any previewable rows.');
  }

  return {
    hasAdditionalPreviewableRows: previewStoppedBeforeUnscannedRows || totalPreviewableRowCount > visiblePreviewRowCount,
    previewRows,
    confirmedRows,
    totalPreviewableRowCount,
    sheetName: firstSheetName,
  };
}

export async function parseImportPreview(input: ImportPreviewParseInput) {
  const startedAt = performance.now();
  const repairSelections = input.repairSelections ?? createDefaultImportRepairSelections();
  let normalizedInput: Omit<TabularPreviewInput, 'durationMs'>;

  if (input.sourceKind === 'excel-file') {
    const workbook = parseWorkbookRows(assertBinary(input), {
      materializeConfirmedDataset: input.materializeConfirmedDataset,
    });
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
      materializeConfirmedDataset: input.materializeConfirmedDataset,
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
