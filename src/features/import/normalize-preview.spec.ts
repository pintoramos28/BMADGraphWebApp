import { describe, expect, it } from 'vitest';

import { buildImportPreviewDataset } from './normalize-preview';

describe('buildImportPreviewDataset', () => {
  it('surfaces delimiter, header, numeric, date, and uncertainty assumptions for CSV preview data', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'clean-sample.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading', 'MeasuredAt', 'Comment'],
        ['A-1', '42.5', '2026-04-18', 'stable'],
        ['A-2', '51.0', '2026-04-19', 'stable'],
        ['A-3', 'text', '2026-04-20', 'review'],
      ],
      durationMs: 1432,
    });

    expect(preview.assumptions.map((assumption) => assumption.category)).toEqual([
      'delimiter',
      'header',
      'numeric',
      'date',
      'uncertainty',
    ]);
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Comma (,)');
    expect(preview.assumptions.find((assumption) => assumption.category === 'header')?.value).toContain('Detected');
    expect(preview.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: 'Reading',
          inferredType: 'mixed',
        }),
        expect.objectContaining({
          sourceName: 'MeasuredAt',
          inferredType: 'date',
        }),
      ]),
    );
    expect(preview.uncertainties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'uncertainty',
          columnId: 'col_2',
        }),
      ]),
    );
  });

  it('marks Excel imports as delimiter-free workbook previews', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'clean-sample.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sheetName: 'Readings',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
      ],
      durationMs: 980,
    });

    expect(preview.source.sheetName).toBe('Readings');
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toContain(
      'Workbook cells do not rely on a delimiter',
    );
    expect(preview.source.benchmarkScenario).toBe('import.clean.excel-preview');
  });
});
