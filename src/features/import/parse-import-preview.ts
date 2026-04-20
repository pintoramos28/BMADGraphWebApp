import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import type { ImportSourceKind } from './preview-model';
import { buildImportPreviewDataset, type TabularPreviewInput } from './normalize-preview';

export interface ImportPreviewParseInput {
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string;
  mimeType?: string | null;
  textContent?: string | null;
  binaryContent?: ArrayBuffer | null;
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

function parseDelimitedRows(textContent: string) {
  const parsed = Papa.parse<string[]>(textContent, {
    delimiter: '',
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? 'The tabular text could not be parsed.');
  }

  const rows = parsed.data
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((value) => (value === undefined || value === null ? '' : String(value))));

  return {
    delimiter: parsed.meta.delimiter || null,
    rows,
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

  const rows = XLSX.utils
    .sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    })
    .map((row) => (Array.isArray(row) ? row.map((value) => String(value ?? '')) : []));

  return {
    rows,
    sheetName: firstSheetName,
  };
}

export async function parseImportPreview(input: ImportPreviewParseInput) {
  const startedAt = performance.now();
  let normalizedInput: Omit<TabularPreviewInput, 'durationMs'>;

  if (input.sourceKind === 'excel-file') {
    const workbook = parseWorkbookRows(assertBinary(input));
    normalizedInput = {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      sheetName: workbook.sheetName,
      rows: workbook.rows,
    };
  } else {
    const delimited = parseDelimitedRows(assertText(input));
    normalizedInput = {
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      delimiter: delimited.delimiter,
      rows: delimited.rows,
    };
  }

  const durationMs = performance.now() - startedAt;

  return buildImportPreviewDataset({
    ...normalizedInput,
    durationMs,
  });
}
