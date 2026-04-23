import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildImportPreviewDataset } from './normalize-preview';

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(preview.assumptions.find((assumption) => assumption.category === 'header')?.value).toContain(
      'Treating the first row as headers',
    );
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
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_type_col_2',
          severity: 'blocking',
        }),
      ]),
    );
    expect(preview.repairSelections).toMatchObject({
      delimiter: null,
      headerSelection: null,
      missingValuePolicy: null,
    });
  });

  it('marks Excel imports as delimiter-free workbook previews', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'clean-sample.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sheetName: 'Readings',
      benchmarkScenario: 'import.clean.excel-preview',
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
    expect(preview.isPartialPreview).toBe(false);
    expect(preview.issues).toEqual([]);
  });

  it('leaves arbitrary imports untagged when they are not owned clean benchmark fixtures', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'customer-upload.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
      ],
      durationMs: 620,
    });

    expect(preview.source.benchmarkScenario).toBeNull();
  });

  it('requires explicit delimiter confirmation for the dirty delimiter benchmark scenario', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'import.dirty.delimiter-repair.csv',
      mimeType: 'text/csv',
      benchmarkScenario: 'import.dirty.delimiter-repair',
      delimiter: ';',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
      ],
      durationMs: 620,
    });

    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_delimiter_confirmation',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('does not force delimiter confirmation for ordinary non-comma delimited files', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'semicolon.csv',
      mimeType: 'text/csv',
      delimiter: ';',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
      ],
      durationMs: 620,
    });

    expect(preview.issues.find((issue) => issue.issueId === 'issue_import_delimiter_confirmation')).toBeUndefined();
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.confidence).toBe('high');
  });

  it('does not force delimiter confirmation for ordinary pasted-table imports', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      delimiter: '\t',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', ''],
      ],
      durationMs: 620,
    });

    expect(preview.issues.find((issue) => issue.issueId === 'issue_import_delimiter_confirmation')).toBeUndefined();
  });

  it('requires explicit header confirmation when duplicate header names are detected', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'import.dirty.header-repair.csv',
      mimeType: 'text/csv',
      benchmarkScenario: 'import.dirty.header-repair',
      delimiter: ',',
      rows: [
        ['Value', 'Value'],
        ['A-1', '42.5'],
      ],
      durationMs: 620,
    });

    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_header_confirmation',
          severity: 'blocking',
          diagnostics: expect.objectContaining({
            duplicateHeaders: ['Value'],
          }),
        }),
      ]),
    );
  });

  it('applies a missing-value policy by dropping incomplete rows after a type confirmation', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'mixed.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', 'not recorded'],
        ['A-3', '51.0'],
      ],
      durationMs: 620,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
        },
        missingValuePolicy: 'drop-invalid-rows',
      },
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.sampleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowId: 'row_1',
        }),
      ]),
    );
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_missing_value_policy_applied',
          severity: 'info',
        }),
      ]),
    );
  });

  it('generates distinct preview ids for repair runs that preserve the same shape but change parsing decisions', () => {
    const textPreview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'ambiguous.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', 'not recorded'],
      ],
      durationMs: 620,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'text',
        },
        missingValuePolicy: 'mark-empty',
      },
    });
    const numericPreview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'ambiguous.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', 'not recorded'],
      ],
      durationMs: 620,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
        },
        missingValuePolicy: 'mark-empty',
      },
    });

    expect(textPreview.rowCount).toBe(numericPreview.rowCount);
    expect(textPreview.columnCount).toBe(numericPreview.columnCount);
    expect(textPreview.previewId).not.toBe(numericPreview.previewId);
  });

  it('stamps import issues with the time they were actually detected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T15:45:30.000Z'));

    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'import.dirty.type-repair.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', 'uncertain'],
        ['A-3', '43.8'],
      ],
      durationMs: 620,
    });

    expect(preview.issues[0]?.detectedAt).toBe('2026-04-22T15:45:30.000Z');
  });

  it('flags capped delimited previews as partial instead of presenting them as full datasets', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 200,
      rows: [
        ['Sample', 'Reading'],
        ...Array.from({ length: 201 }, (_, index) => [`A-${index + 1}`, `${index + 1}`]),
      ],
      durationMs: 1800,
    });

    expect(preview.isPartialPreview).toBe(true);
    expect(preview.rowCount).toBe(200);
  });

  it('computes confirmed schema and blocking repair issues from the full repaired rows, not only the visible preview rows', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'late-schema-shift.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 2,
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', '44.1'],
      ],
      fullRows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', '44.1'],
        ['A-3', 'not recorded'],
      ],
      durationMs: 410,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.isPartialPreview).toBe(true);
    expect(preview.columns.find((column) => column.sourceName === 'Reading')?.inferredType).toBe('mixed');
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_type_col_2',
          severity: 'blocking',
        }),
      ]),
    );
    expect(preview.confirmedDataset?.rowCount).toBe(3);
    expect(preview.confirmedDataset?.rows).toHaveLength(3);
  });

  it('changes the preview identity when non-visible confirmed rows change beneath the same visible sample', () => {
    const baseInput = {
      sourceKind: 'csv-file' as const,
      sourceLabel: 'Local CSV file',
      fileName: 'stable-visible-sample.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 2,
      rows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', '44.1'],
      ],
      durationMs: 410,
    };
    const firstPreview = buildImportPreviewDataset({
      ...baseInput,
      fullRows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', '44.1'],
        ['A-3', '43.8'],
      ],
    });
    const secondPreview = buildImportPreviewDataset({
      ...baseInput,
      fullRows: [
        ['Sample', 'Reading'],
        ['A-1', '42.5'],
        ['A-2', '44.1'],
        ['A-3', '99.9'],
      ],
    });

    expect(firstPreview.sampleRows).toEqual(secondPreview.sampleRows);
    expect(firstPreview.previewId).not.toBe(secondPreview.previewId);
    expect(firstPreview.confirmedDataset?.fingerprint).not.toBe(secondPreview.confirmedDataset?.fingerprint);
  });

  it('clears the late-column blocking issue after the user acknowledges the additional confirmed columns', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'late-columns.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 1,
      rows: [
        ['Sample'],
        ['A-1'],
      ],
      fullRows: [
        ['Sample'],
        ['A-1'],
        ['A-2', '44.1'],
      ],
      durationMs: 410,
    });
    const acknowledgementToken = String(
      preview.issues.find((issue) => issue.issueId === 'issue_import_additional_columns_confirmation')?.diagnostics?.[
        'acknowledgementToken'
      ] ?? '',
    );
    const acknowledgedPreview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'late-columns.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 1,
      rows: [
        ['Sample'],
        ['A-1'],
      ],
      fullRows: [
        ['Sample'],
        ['A-1'],
        ['A-2', '44.1'],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: null,
        headerSelection: null,
        columnTypeOverrides: {},
        missingValuePolicy: null,
        additionalColumnsAcknowledgement: acknowledgementToken,
      },
    });

    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_additional_columns_confirmation',
          severity: 'blocking',
        }),
      ]),
    );
    expect(
      acknowledgedPreview.issues.find((issue) => issue.issueId === 'issue_import_additional_columns_confirmation'),
    ).toBeUndefined();
  });

  it('blocks confirmation when additional columns only appear in buffered preview rows beyond the visible row window', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'late-columns-buffered.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 1,
      rows: [
        ['Sample'],
        ['A-1'],
        ['A-2', '44.1'],
      ],
      fullRows: [
        ['Sample'],
        ['A-1'],
        ['A-2', '44.1'],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: null,
        additionalColumnsAcknowledgement: null,
      },
    });

    expect(preview.columns).toHaveLength(1);
    expect(preview.sampleRows).toEqual([
      expect.objectContaining({
        cells: [{ columnId: 'col_1', value: 'A-1' }],
      }),
    ]);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_additional_columns_confirmation',
          severity: 'blocking',
          diagnostics: expect.objectContaining({
            additionalColumns: ['Column 2'],
            additionalColumnIndexes: [2],
            visibleColumnCount: 1,
            confirmedColumnCount: 2,
          }),
        }),
      ]),
    );
  });

  it('rejects previews that normalize to zero body rows', () => {
    expect(() =>
      buildImportPreviewDataset({
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'header-only.csv',
        mimeType: 'text/csv',
        delimiter: ',',
        rows: [['Sample', 'Reading']],
        durationMs: 410,
      }),
    ).toThrow('The selected source did not contain any previewable data rows after normalization.');
  });

  it('keeps the preview open and blocks confirmation when dropping invalid rows would remove every row', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'all-invalid.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading'],
        ['A-1', 'bad'],
        ['A-2', ''],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
        },
        missingValuePolicy: 'drop-invalid-rows',
      },
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.confirmedDataset?.rowCount).toBe(0);
    expect(preview.confirmedDataset?.rows).toEqual([]);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_missing_value_policy_empty-result',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('keeps the visible preview aligned to later importable rows when drop-invalid removes the initial preview slice', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'later-valid-rows.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 2,
      rows: [
        ['Sample', 'Reading'],
        ['A-1', 'bad'],
        ['A-2', ''],
      ],
      fullRows: [
        ['Sample', 'Reading'],
        ['A-1', 'bad'],
        ['A-2', ''],
        ['A-3', '51.0'],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
        },
        missingValuePolicy: 'drop-invalid-rows',
      },
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.sampleRows).toEqual([
      expect.objectContaining({
        cells: [
          expect.objectContaining({ value: 'A-3' }),
          expect.objectContaining({ value: '51.0' }),
        ],
      }),
    ]);
    expect(preview.confirmedDataset?.rowCount).toBe(1);
    expect(preview.confirmedDataset?.rows).toEqual([
      expect.objectContaining({
        col_1: 'A-3',
        col_2: '51.0',
      }),
    ]);
  });

  it('counts every missing and malformed value across the confirmed schema and drops short rows with trailing missing cells', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'schema-quality.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rowLimit: 2,
      rows: [
        ['Sample', 'Reading', 'MeasuredAt'],
        ['A-1', '42.5'],
        ['A-2', '', 'bad-date'],
      ],
      fullRows: [
        ['Sample', 'Reading', 'MeasuredAt'],
        ['A-1', '42.5'],
        ['A-2', '', 'bad-date'],
        ['A-3', '51.0', '2026-04-19'],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
          col_3: 'date',
        },
        missingValuePolicy: 'drop-invalid-rows',
      },
    });

    expect(preview.sampleRows).toEqual([
      expect.objectContaining({
        cells: [
          expect.objectContaining({ value: 'A-3' }),
          expect.objectContaining({ value: '51.0' }),
          expect.objectContaining({ value: '2026-04-19' }),
        ],
      }),
    ]);
    expect(preview.confirmedDataset?.rowCount).toBe(1);
    expect(preview.confirmedDataset?.rows).toEqual([
      expect.objectContaining({
        col_1: 'A-3',
        col_2: '51.0',
        col_3: '2026-04-19',
      }),
    ]);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_missing_value_policy_applied',
          diagnostics: expect.objectContaining({
            missingValueCount: 2,
            malformedValueCount: 1,
            affectedRowCount: 2,
          }),
        }),
      ]),
    );
  });

  it('clears mixed-type confirmation when dropping invalid rows removes the only mixed row from the confirmed dataset', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'mixed-cleared-by-policy.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [
        ['Sample', 'Reading', 'Status'],
        ['A-1', '42.5', 'ready'],
        ['A-2', 'bad', ''],
        ['A-3', '51.0', 'queued'],
      ],
      durationMs: 410,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'drop-invalid-rows',
      },
    });

    expect(preview.columns.find((column) => column.sourceName === 'Reading')?.inferredType).toBe('numeric');
    expect(preview.issues.find((issue) => issue.issueId === 'issue_import_type_col_2')).toBeUndefined();
    expect(preview.confirmedDataset?.rows).toEqual([
      expect.objectContaining({
        col_1: 'A-1',
        col_2: '42.5',
        col_3: 'ready',
      }),
      expect.objectContaining({
        col_1: 'A-3',
        col_2: '51.0',
        col_3: 'queued',
      }),
    ]);
  });

  it('keeps single-row header selections in a recoverable blocking preview state instead of throwing', () => {
    const preview = buildImportPreviewDataset({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'single-row.csv',
      mimeType: 'text/csv',
      delimiter: ',',
      rows: [['Sample', 'Reading']],
      durationMs: 410,
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: null,
      },
    });

    expect(preview.rowCount).toBe(0);
    expect(preview.columnCount).toBe(2);
    expect(preview.confirmedDataset?.rowCount).toBe(0);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_header_confirmation',
          severity: 'blocking',
          diagnostics: expect.objectContaining({
            bodyRowCount: 0,
          }),
        }),
      ]),
    );
  });
});
