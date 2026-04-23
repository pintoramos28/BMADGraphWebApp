import Papa, { type ParseResult, type ParseStepResult, type Parser } from 'papaparse';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { IMPORT_PREVIEW_ROW_LIMIT, parseImportPreview } from './parse-import-preview';

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('xlsx');
  vi.resetModules();
});

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
    expect(preview.confirmedDataset).toBeUndefined();
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
      benchmarkScenario: 'import.clean.excel-preview',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.source.sheetName).toBe('Readings');
    expect(preview.source.benchmarkScenario).toBe('import.clean.excel-preview');
    expect(preview.rowCount).toBe(2);
  });

  it('caps workbook previews to the preview row window', async () => {
    const workbook = XLSX.utils.book_new();
    const bodyRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 25 }, (_, index) => [
      `A-${index + 1}`,
      `${index + 1}`,
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([['Sample', 'Reading'], ...bodyRows]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Readings');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'large.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('keeps confirmed-import metadata aligned to the preview semantics when the preview is partial', async () => {
    const bodyRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 25 }, (_, index) =>
      index === IMPORT_PREVIEW_ROW_LIMIT + 24
        ? `A-${index + 1},${index + 1},late-notes`
        : `A-${index + 1},${index + 1}`,
    );
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent: ['Sample,Reading', ...bodyRows].join('\n'),
      materializeConfirmedDataset: true,
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
    expect(preview.confirmedDataset).toMatchObject({
      rowCount: IMPORT_PREVIEW_ROW_LIMIT + 25,
      columnCount: 3,
    });
    expect(preview.confirmedDataset?.fingerprint).not.toBe(`preview:${preview.previewId}`);
    expect(preview.confirmedDataset?.rows).toHaveLength(IMPORT_PREVIEW_ROW_LIMIT + 25);
  });

  it('aborts CSV preview sampling once the preview boundary is established before collecting the full confirmed dataset', async () => {
    const csvRows = ['Sample,Reading'];

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 25; index += 1) {
      csvRows.push(`A-${index + 1},${index + 1}`);
    }

    const csvText = csvRows.join('\n');
    let parseCallCount = 0;
    let firstPassStepCount = 0;

    vi.doMock('papaparse', async () => {
      const actual = await vi.importActual<typeof import('papaparse')>('papaparse');

      return {
        ...actual,
        default: {
          ...actual.default,
          parse: vi.fn(
            (
              input: string,
              config: {
                step?: (result: ParseStepResult<string[]>, parser: Parser) => void;
                complete?: (result: ParseResult<string[]>) => void;
              },
            ) => {
            parseCallCount += 1;
            let aborted = false;
            const parser = {
              abort() {
                aborted = true;
              },
            };
            const rows = input.split('\n').map((line) => line.split(','));

            for (const row of rows) {
              if (aborted) {
                break;
              }

              if (parseCallCount === 1) {
                firstPassStepCount += 1;

                if (firstPassStepCount > IMPORT_PREVIEW_ROW_LIMIT + 2) {
                  throw new Error('preview parsing read past the preview boundary');
                }
              }

              config.step?.(
                {
                  data: row,
                  errors: [],
                  meta: {
                    delimiter: ',',
                  },
                },
                parser,
              );
            }

            config.complete?.({
              data: [],
              errors: [],
              meta: {
                delimiter: ',',
              },
            });
            },
          ),
        },
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent: csvText,
      materializeConfirmedDataset: true,
    });

    expect(parseCallCount).toBe(2);
    expect(firstPassStepCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 2);
    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.confirmedDataset?.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 25);
  });

  it('keeps Excel preview rendering bounded while carrying the full confirmed dataset rows', async () => {
    const workbook = XLSX.utils.book_new();
    const bodyRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 25 }, (_, index) => [
      `A-${index + 1}`,
      `${index + 1}`,
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([['Sample', 'Reading'], ...bodyRows]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Readings');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'large-confirmed.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
      materializeConfirmedDataset: true,
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
    expect(preview.confirmedDataset?.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 25);
    expect(preview.confirmedDataset?.rows).toHaveLength(IMPORT_PREVIEW_ROW_LIMIT + 25);
  });

  it('establishes the workbook preview boundary before reading late rows for the confirmed dataset', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;
    const createTrackedRow = (rowIndex: number, cells: Array<XLSX.CellObject | undefined>) =>
      new Proxy(cells, {
        get(target, property, receiver) {
          if (typeof property === 'string' && /^\d+$/.test(property) && Reflect.has(target, property)) {
            if (rowIndex === 0 && leftHeaderRow) {
              establishedPreviewBoundary = true;
            }

            if (rowIndex !== 0) {
              leftHeaderRow = true;
            }

            if (rowIndex >= IMPORT_PREVIEW_ROW_LIMIT + 2 && !establishedPreviewBoundary) {
              throw new Error('late workbook rows were read before the preview boundary was established');
            }
          }

          return Reflect.get(target, property, receiver);
        },
      });

    let leftHeaderRow = false;
    let establishedPreviewBoundary = false;
    denseSheet[0] = createTrackedRow(0, [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ]);

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 25; index += 1) {
      denseSheet[index + 1] = createTrackedRow(index + 1, [
        { t: 's', v: `A-${index + 1}`, w: `A-${index + 1}` },
        { t: 'n', v: index + 1, w: `${index + 1}` },
      ]);
    }

    Object.assign(denseSheet, {
      '!ref': `A1:B${IMPORT_PREVIEW_ROW_LIMIT + 26}`,
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['Tracked'],
          Sheets: {
            Tracked: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'tracked.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(establishedPreviewBoundary).toBe(true);
    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.confirmedDataset?.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 25);
  });

  it('defers confirmed dataset materialization until an explicit confirm-time parse requests it', async () => {
    const bodyRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 25 }, (_, index) => `A-${index + 1},${index + 1}`);
    const input = {
      sourceKind: 'csv-file' as const,
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent: ['Sample,Reading', ...bodyRows].join('\n'),
    };

    const previewOnly = await parseImportPreview(input);
    const materialized = await parseImportPreview({
      ...input,
      materializeConfirmedDataset: true,
    });

    expect(previewOnly.confirmedDataset).toBeUndefined();
    expect(materialized.confirmedDataset).toMatchObject({
      rowCount: IMPORT_PREVIEW_ROW_LIMIT + 25,
      columnCount: 2,
    });
    expect(materialized.previewId).toBe(previewOnly.previewId);
  });

  it('detects partial Excel previews from populated rows even when the workbook is sparse', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['Sample', 'Reading']]);

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 25; index += 1) {
      XLSX.utils.sheet_add_aoa(
        sheet,
        [[`A-${index + 1}`, `${index + 1}`]],
        {
          origin: `A${2 + index * 2}`,
        },
      );
    }

    XLSX.utils.book_append_sheet(workbook, sheet, 'Readings');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('iterates Excel previews over populated worksheet rows instead of scanning blank !ref rows', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;
    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[400] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];
    denseSheet[800] = [
      { t: 's', v: 'A-2', w: 'A-2' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500000',
    });

    let blankRowReads = 0;
    const sparseSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property) && !Reflect.has(target, property)) {
          blankRowReads += 1;

          if (blankRowReads > 20) {
            throw new Error('scanned blank worksheet rows');
          }
        }

        return Reflect.get(target, property, receiver);
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['Sparse'],
          Sheets: {
            Sparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(2);
    expect(blankRowReads).toBeLessThanOrEqual(20);
  });

  it('bounds sparse Excel previews to sampled populated columns instead of the full min-to-max range', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([]);

    XLSX.utils.sheet_add_aoa(sheet, [['Sample']], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(sheet, [['FarReading']], { origin: 'ZZ1' });
    XLSX.utils.sheet_add_aoa(sheet, [['A-1']], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(sheet, [[42.5]], { origin: 'ZZ2' });

    XLSX.utils.book_append_sheet(workbook, sheet, 'SparseColumns');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'sparse-columns.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.columnCount).toBe(2);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'FarReading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('rejects a blank first worksheet instead of surfacing an empty preview', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, {} as XLSX.WorkSheet, 'Blank');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Sample', 'Reading'],
        ['A-1', 42.5],
      ]),
      'Readings',
    );

    await expect(
      parseImportPreview({
        sourceKind: 'excel-file',
        sourceLabel: 'Local Excel workbook',
        fileName: 'blank-first.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        binaryContent: XLSX.write(workbook, {
          bookType: 'xlsx',
          type: 'array',
        }) as ArrayBuffer,
      }),
    ).rejects.toThrow('The first worksheet did not contain any previewable rows.');
  });

  it('parses pasted tables with automatic delimiter detection', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      benchmarkScenario: 'import.clean.paste-preview',
      textContent: 'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18',
    });

    expect(preview.source.benchmarkScenario).toBe('import.clean.paste-preview');
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Tab');
  });

  it.each([
    {
      expectedDelimiter: 'Semicolon (;)',
      textContent: 'Sample;Notes;Reading\nA-1;"north, plant, east wing";42.5',
    },
    {
      expectedDelimiter: 'Tab',
      textContent: 'Sample\tNotes\tReading\nA-1\t"north, plant, east wing"\t42.5',
    },
    {
      expectedDelimiter: 'Pipe (|)',
      textContent: 'Sample|Notes|Reading\nA-1|"north, plant, east wing"|42.5',
    },
  ])(
    'keeps quote-wrapped separators from overriding %s detection',
    async ({ expectedDelimiter, textContent }) => {
      const preview = await parseImportPreview({
        sourceKind: 'pasted-table',
        sourceLabel: 'Pasted table',
        mimeType: 'text/plain',
        textContent,
      });

      expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe(expectedDelimiter);
      expect(preview.rowCount).toBe(1);
    },
  );

  it('keeps delimiter detection stable across quoted multiline cells', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'multiline-notes.csv',
      mimeType: 'text/csv',
      textContent: [
        'Sample;Notes;Reading',
        'A-1;"alpha',
        'bravo, charlie',
        'delta, echo',
        'foxtrot";42.5',
      ].join('\n'),
    });

    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Semicolon (;)');
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Notes', 'Reading']);
    expect(preview.rowCount).toBe(1);
  });

  it('does not let leading prose punctuation override a short table without repeated delimiter evidence', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: [
        'Analyst, review',
        'Escalation, backlog',
        'Sample\tReading\tMeasuredAt\tUnits',
      ].join('\n'),
    });

    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Tab');
    expect(preview.columnCount).toBe(4);
    expect(preview.rowCount).toBe(2);
  });

  it('keeps sampled delimiter override from outranking a short competing table signal', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: [
        'Analyst, review',
        'Escalation, backlog',
        'Follow-up, queued',
        'Sample\tReading\tMeasuredAt',
        'A-1\t42.5\t2026-04-18',
      ].join('\n'),
    });

    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Tab');
  });

  it('ignores delimiter-only sampled rows when inferring a delimiter override', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: [',,', ',,', ',,', 'Sample\tReading\tMeasuredAt', 'A-1\t42.5\t2026-04-18'].join('\n'),
    });

    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.value).toBe('Tab');
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading', 'MeasuredAt']);
    expect(preview.rowCount).toBe(1);
  });

  it('does not tag arbitrary delimited imports as clean benchmark scenarios without an ownership hint', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'customer-upload.csv',
      mimeType: 'text/csv',
      textContent: 'Sample,Reading\nA-1,42.5',
    });

    expect(preview.source.benchmarkScenario).toBeNull();
  });

  it('requires explicit delimiter confirmation when CSV auto-detection sees conflicting delimiter signals', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'ambiguous-delimiter.csv',
      mimeType: 'text/csv',
      textContent: ['Sample;Reading', 'A-1;42.5', 'Sample,Reading', 'A-2,41.0'].join('\n'),
    });

    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_delimiter_confirmation',
          severity: 'blocking',
        }),
      ]),
    );
    expect(preview.assumptions.find((assumption) => assumption.category === 'delimiter')?.confidence).toBe('medium');
  });

  it('keeps CSV delimiter ambiguity blocked even when auto-detection collapses the parse to one column', async () => {
    vi.doMock('papaparse', async () => {
      const actual = await vi.importActual<typeof import('papaparse')>('papaparse');

      return {
        ...actual,
        default: {
          ...actual.default,
          parse: vi.fn(
            (
              _input: string,
              config: {
                step?: (result: ParseStepResult<string[]>, parser: Parser) => void;
                complete?: (result: ParseResult<string[]>) => void;
              },
            ) => {
              const parser = {
                abort() {},
              };
              const rows = [['Sample;Reading'], ['A-1;42.5'], ['Sample,Reading'], ['A-2,41.0']];

              for (const row of rows) {
                config.step?.(
                  {
                    data: row,
                    errors: [],
                    meta: {
                      delimiter: ',',
                    },
                  },
                  parser,
                );
              }

              config.complete?.({
                data: [],
                errors: [],
                meta: {
                  delimiter: ',',
                },
              });
            },
          ),
        },
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');
    const preview = await parseMockedImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'ambiguous-one-column.csv',
      mimeType: 'text/csv',
      textContent: ['Sample;Reading', 'A-1;42.5', 'Sample,Reading', 'A-2,41.0'].join('\n'),
    });

    expect(preview.columnCount).toBe(1);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_delimiter_confirmation',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('keeps pasted-table delimiter ambiguity behind the repair gate', async () => {
    vi.doMock('papaparse', async () => {
      const actual = await vi.importActual<typeof import('papaparse')>('papaparse');

      return {
        ...actual,
        default: {
          ...actual.default,
          parse: vi.fn(
            (
              _input: string,
              config: {
                step?: (result: ParseStepResult<string[]>, parser: Parser) => void;
                complete?: (result: ParseResult<string[]>) => void;
              },
            ) => {
              const parser = {
                abort() {},
              };
              const rows = [['Sample;Reading'], ['A-1;42.5'], ['Sample,Reading'], ['A-2,41.0']];

              for (const row of rows) {
                config.step?.(
                  {
                    data: row,
                    errors: [],
                    meta: {
                      delimiter: ',',
                    },
                  },
                  parser,
                );
              }

              config.complete?.({
                data: [],
                errors: [],
                meta: {
                  delimiter: ',',
                },
              });
            },
          ),
        },
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');
    const preview = await parseMockedImportPreview({
      sourceKind: 'pasted-table',
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
      textContent: ['Sample;Reading', 'A-1;42.5', 'Sample,Reading', 'A-2,41.0'].join('\n'),
    });

    expect(preview.columnCount).toBe(1);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_import_delimiter_confirmation',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it.each([
    {
      sourceKind: 'csv-file' as const,
      sourceLabel: 'Local CSV file',
      fileName: 'single-column.csv',
      mimeType: 'text/csv',
    },
    {
      sourceKind: 'pasted-table' as const,
      sourceLabel: 'Pasted table',
      mimeType: 'text/plain',
    },
  ])('accepts valid single-column %s input despite Papa delimiter warnings', async (input) => {
    const preview = await parseImportPreview({
      ...input,
      textContent: ['Sample', 'A-1', 'A-2'].join('\n'),
    });

    expect(preview.columnCount).toBe(1);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample']);
    expect(preview.rowCount).toBe(2);
    expect(preview.sampleRows.map((row) => row.cells[0]?.value)).toEqual(['A-1', 'A-2']);
  });

  it('treats repeated delimiter-symbol cell values as previewable data instead of dropping the row', async () => {
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'symbols.csv',
      mimeType: 'text/csv',
      textContent: ['Marker,Status', '"||",";;"', '"|",";"'].join('\n'),
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.sampleRows.map((row) => row.cells.map((cell) => cell.value))).toEqual([
      ['||', ';;'],
      ['|', ';'],
    ]);
  });

  it('uses bounded Papa Parse row stepping for delimited preview imports', async () => {
    const parseSpy = vi.spyOn(Papa, 'parse');
    const rows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 25 }, (_, index) => `A-${index + 1},${index + 1}`);
    const textContent = ['Sample,Reading', ...rows].join('\n');

    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent,
    });

    expect(parseSpy).toHaveBeenCalledWith(
      textContent,
      expect.objectContaining({
        preview: 0,
        skipEmptyLines: 'greedy',
        step: expect.any(Function),
      }),
    );
    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('keeps scanning delimited rows until previewable rows are sampled', async () => {
    const leadingDelimiterRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 10 }, () => ',,').join('\n');
    const preview = await parseImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'delayed-data.csv',
      mimeType: 'text/csv',
      textContent: `${leadingDelimiterRows}\nSample,Reading,MeasuredAt\nA-1,42.5,2026-04-18\nA-2,44.1,2026-04-19`,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading', 'MeasuredAt']);
  });

  it('keeps scanning workbook rows until previewable rows are sampled', async () => {
    const workbook = XLSX.utils.book_new();
    const blankLeadingRows = Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 10 }, () => ['', '']);
    const sheet = XLSX.utils.aoa_to_sheet([
      ...blankLeadingRows,
      ['Sample', 'Reading'],
      ['A-1', 42.5],
      ['A-2', 44.1],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Readings');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'leading-blank-values.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
  });

  it('limits Excel preview columns to the rows that can actually render', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['Sample']]);

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT; index += 1) {
      XLSX.utils.sheet_add_aoa(sheet, [[`A-${index + 1}`]], {
        origin: `A${index + 2}`,
      });
    }

    XLSX.utils.sheet_add_aoa(sheet, [[`A-${IMPORT_PREVIEW_ROW_LIMIT + 1}`]], {
      origin: `A${IMPORT_PREVIEW_ROW_LIMIT + 2}`,
    });
    XLSX.utils.sheet_add_aoa(sheet, [[42.5]], {
      origin: `ZZ${IMPORT_PREVIEW_ROW_LIMIT + 2}`,
    });
    XLSX.utils.book_append_sheet(workbook, sheet, 'VisibleColumnsOnly');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'visible-columns-only.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.isPartialPreview).toBe(true);
    expect(preview.columnCount).toBe(1);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1']);
  });

  it('keeps no-header workbook lookahead rows from adding empty visible columns', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(
      Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT }, (_, index) => [`${index + 1}`]),
    );

    XLSX.utils.sheet_add_aoa(sheet, [[`${IMPORT_PREVIEW_ROW_LIMIT + 1}`]], {
      origin: `A${IMPORT_PREVIEW_ROW_LIMIT + 1}`,
    });
    XLSX.utils.sheet_add_aoa(sheet, [[42.5]], {
      origin: `ZZ${IMPORT_PREVIEW_ROW_LIMIT + 1}`,
    });
    XLSX.utils.book_append_sheet(workbook, sheet, 'NoHeaderLookahead');

    const preview = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'no-header-lookahead.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(preview.isPartialPreview).toBe(true);
    expect(preview.columnCount).toBe(1);
    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Column 1']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['1']);
  });
});
