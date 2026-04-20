import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { parseImportPreview } from './parse-import-preview';

describe('parseImportPreview', () => {
  it('parses CSV text into a normalized preview dataset', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'clean.csv',
      mimeType: 'text/csv',
      textContent: 'Sample,Reading,MeasuredAt\nA-1,42.5,2026-04-18\nA-2,44.1,2026-04-19',
    });

    expect(preview.source.fileName).toBe('clean.csv');
    expect(preview.rowCount).toBe(2);
    expect(preview.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: 'Reading',
          inferredType: 'numeric',
        }),
        expect.objectContaining({
          sourceName: 'MeasuredAt',
          inferredType: 'date',
        }),
      ]),
    );
  });

  it('parses Excel ArrayBuffers into a normalized preview dataset', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Sample', 'Reading'],
      ['A-1', 42.5],
      ['A-2', 44.1],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Readings');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'clean.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.source.sheetName).toBe('Readings');
    expect(preview.source.benchmarkScenario).toBe('import.clean.excel-preview');
    expect(preview.rowCount).toBe(2);
  });

  it('parses pasted tables with automatic delimiter detection', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: 'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18',
    });

    expect(preview.source.benchmarkScenario).toBe('import.clean.paste-preview');
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Tab');
  });
});
