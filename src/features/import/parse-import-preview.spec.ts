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

                if (firstPassStepCount > IMPORT_PREVIEW_ROW_LIMIT + 3) {
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

    const previewOnly = await parseMockedImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent: csvText,
    });

    expect(parseCallCount).toBe(1);
    expect(firstPassStepCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 3);
    expect(previewOnly.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(previewOnly.isPartialPreview).toBe(true);
    expect(previewOnly.confirmedDataset).toBeUndefined();

    parseCallCount = 0;
    firstPassStepCount = 0;

    const preview = await parseMockedImportPreview({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'large.csv',
      mimeType: 'text/csv',
      textContent: csvText,
      materializeConfirmedDataset: true,
    });

    expect(parseCallCount).toBe(2);
    expect(firstPassStepCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 3);
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

    const previewOnly = await parseImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'large-confirmed.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

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

    expect(previewOnly.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(previewOnly.isPartialPreview).toBe(true);
    expect(previewOnly.confirmedDataset).toBeUndefined();
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

            if (rowIndex > IMPORT_PREVIEW_ROW_LIMIT + 2 && !establishedPreviewBoundary) {
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

  it('does not enumerate full workbook row metadata during preview-only parsing', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;
    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 25; index += 1) {
      denseSheet[index + 1] = [
        { t: 's', v: `A-${index + 1}`, w: `A-${index + 1}` },
        { t: 'n', v: index + 1, w: `${index + 1}` },
      ];
    }

    Object.assign(denseSheet, {
      '!ref': `A1:B${IMPORT_PREVIEW_ROW_LIMIT + 26}`,
    });

    const metadataGuardedSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      ownKeys() {
        throw new Error('scanned full workbook row metadata before preview boundary');
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['Tracked'],
          Sheets: {
            Tracked: metadataGuardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'tracked-preview-only.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.confirmedDataset).toBeUndefined();
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
    expect(materialized.previewId).not.toBe(previewOnly.previewId);
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

  it('ignores accessor-backed sparse worksheet cells after own-property checks', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
    };
    Object.defineProperty(sparseSheet, 'B1', {
      enumerable: true,
      get() {
        throw new Error('accessor sparse header cell was read');
      },
    });
    Object.defineProperty(sparseSheet, 'B2', {
      enumerable: true,
      get() {
        throw new Error('accessor sparse data cell was read');
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['AccessorSparse'],
          Sheets: {
            AccessorSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'accessor-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1']);
    expect(preview.confirmedDataset?.rows[0]).toEqual({ col_1: 'A-1' });
  });

  it('does not mark a small sparse workbook partial when the leading grid captures the complete sheet', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['SmallSparse'],
          Sheets: {
            SmallSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'small-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.isPartialPreview).toBe(false);
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

  it('bounds dense sparse Excel previews over high row-index gaps before the preview boundary', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[250_000] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[500_000] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B1000000',
    });

    let rowPresenceChecks = 0;
    const sparseDenseSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      has(target, property) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          rowPresenceChecks += 1;

          if (rowPresenceChecks > 20) {
            throw new Error('scanned high-index blank worksheet row gaps');
          }
        }

        return Reflect.has(target, property);
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['SparseDense'],
          Sheets: {
            SparseDense: sparseDenseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'sparse-dense.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(rowPresenceChecks).toBeLessThanOrEqual(20);
  });

  it('does not mark dense workbook previews partial when sparse fallback exhausts all later row keys', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];
    denseSheet.length = 100;

    Object.assign(denseSheet, {
      '!ref': 'A1:B100',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['ExhaustedGap'],
          Sheets: {
            ExhaustedGap: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'exhausted-dense-gap.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.isPartialPreview).toBe(false);
  });

  it('treats present-but-empty dense workbook rows as a bounded preview gap', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    let emptyRowReads = 0;
    let ownKeyEnumerationCount = 0;
    const emptyRowGuardedSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      get(target, property, receiver) {
        if (
          typeof property === 'string'
          && /^\d+$/.test(property)
          && Array.isArray(Reflect.get(target, property, receiver))
          && (Reflect.get(target, property, receiver) as unknown[]).length === 0
        ) {
          emptyRowReads += 1;

          if (emptyRowReads > 20) {
            throw new Error('scanned too many present-but-empty dense worksheet rows');
          }
        }

        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        ownKeyEnumerationCount += 1;
        return Reflect.ownKeys(target);
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['EmptyRows'],
          Sheets: {
            EmptyRows: emptyRowGuardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'present-empty-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(2);
    expect(emptyRowReads).toBeLessThanOrEqual(20);
    expect(ownKeyEnumerationCount).toBeLessThanOrEqual(1);
  });

  it('bounds dense rows with blank cell objects before confirm fallback recovery', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [
        { t: 's', v: '', w: '' },
        { t: 's', v: '', w: '' },
      ];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    const primaryBlankRowDescriptorReads = new Set<string>();
    let fallbackStarted = false;
    const blankCellObjectGuardedSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      ownKeys(target) {
        fallbackStarted = true;

        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, property) {
        if (
          !fallbackStarted
          && typeof property === 'string'
          && /^\d+$/.test(property)
          && Number(property) >= 2
          && Number(property) < 250
        ) {
          primaryBlankRowDescriptorReads.add(property);

          if (primaryBlankRowDescriptorReads.size > 20) {
            throw new Error('scanned too many dense rows with blank cell objects before fallback');
          }
        }

        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['BlankCellObjects'],
          Sheets: {
            BlankCellObjects: blankCellObjectGuardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'blank-cell-object-gap.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.sampleRows.map((row) => row.cells.map((cell) => cell.value))).toEqual([
      ['A-1', '42.5'],
      ['Late', '44.1'],
    ]);
    expect(primaryBlankRowDescriptorReads.size).toBeLessThanOrEqual(20);
  });

  it('does not sort every dense worksheet row key after a preview-time gap', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    const objectKeysSpy = vi.spyOn(Object, 'keys');

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['DenseGap'],
          Sheets: {
            DenseGap: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'dense-gap.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(2);
    expect(objectKeysSpy).not.toHaveBeenCalledWith(denseSheet);
  });

  it('bounds dense fallback row-key processing after a preview-time gap', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    for (let rowIndex = 1_000; rowIndex < 10_000; rowIndex += 1) {
      denseSheet[rowIndex] = [
        { t: 's', v: `Trailing-${rowIndex}`, w: `Trailing-${rowIndex}` },
      ];
    }

    Object.assign(denseSheet, {
      '!ref': 'A1:B10000',
    });

    let denseRowReads = 0;
    const guardedSheet = new Proxy(denseSheet as typeof denseSheet & XLSX.WorkSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property) && Reflect.has(target, property)) {
          denseRowReads += 1;

          if (denseRowReads > 800) {
            throw new Error('processed too many dense row keys before confirmation');
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
          SheetNames: ['BoundedDenseFallback'],
          Sheets: {
            BoundedDenseFallback: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'bounded-dense-fallback.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(preview.sampleRows[1]?.cells.map((cell) => cell.value)).toEqual(['Late', '44.1']);
    expect(denseRowReads).toBeLessThanOrEqual(800);
  });

  it('does not spend dense fallback row-key budget on rows already scanned before the gap', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    for (let rowIndex = 0; rowIndex < 1_500; rowIndex += 10) {
      denseSheet[rowIndex] = [
        { t: 's', v: rowIndex === 0 ? 'Sample' : `A-${rowIndex}`, w: rowIndex === 0 ? 'Sample' : `A-${rowIndex}` },
        { t: rowIndex === 0 ? 's' : 'n', v: rowIndex === 0 ? 'Reading' : rowIndex, w: rowIndex === 0 ? 'Reading' : String(rowIndex) },
      ];
    }

    for (let rowIndex = 1_501; rowIndex < 1_530; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[1_700] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B1701',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['DenseFallbackPreGapBudget'],
          Sheets: {
            DenseFallbackPreGapBudget: denseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'dense-fallback-pre-gap-budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows.length).toBeGreaterThan(0);
  });

  it('does not mark dense workbook previews partial for trailing present-but-empty rows with no later data', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 100; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    Object.assign(denseSheet, {
      '!ref': 'A1:B100',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['TrailingEmptyRows'],
          Sheets: {
            TrailingEmptyRows: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'trailing-empty-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.isPartialPreview).toBe(false);
  });

  it('ignores inherited dense worksheet row properties during sparse fallback enumeration', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;
    const inheritedRows = {
      400: [
        { t: 's', v: 'Polluted', w: 'Polluted' },
        { t: 'n', v: 999, w: '999' },
      ],
    };

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];
    denseSheet.length = 500;
    Object.setPrototypeOf(denseSheet, inheritedRows);

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['PollutedRows'],
          Sheets: {
            PollutedRows: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'polluted-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.sampleRows).toEqual([
      expect.objectContaining({
        cells: [
          expect.objectContaining({ value: 'A-1' }),
          expect.objectContaining({ value: '42.5' }),
        ],
      }),
    ]);
  });

  it('preserves dense workbook preview rows after present-empty row gaps', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['EmptyRows'],
          Sheets: {
            EmptyRows: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'present-empty-preview.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.isPartialPreview).toBe(false);
    expect(preview.confirmedDataset).toBeUndefined();
  });

  it('does not reject dense workbooks whose first previewable row appears after present-empty gaps', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    for (let rowIndex = 0; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['EmptyRows'],
          Sheets: {
            EmptyRows: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'present-empty-late-only.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['Late', '44.1']);
  });

  it('preserves later dense workbook rows after present-empty row gaps during confirm materialization', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;

    denseSheet[0] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[1] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];

    for (let rowIndex = 2; rowIndex < 250; rowIndex += 1) {
      denseSheet[rowIndex] = [];
    }

    denseSheet[400] = [
      { t: 's', v: 'Late', w: 'Late' },
      { t: 'n', v: 44.1, w: '44.1' },
    ];

    Object.assign(denseSheet, {
      '!ref': 'A1:B500',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['EmptyRows'],
          Sheets: {
            EmptyRows: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'present-empty-confirm.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.confirmedDataset?.rowCount).toBe(2);
    expect(preview.confirmedDataset?.rows).toEqual([
      expect.objectContaining({ col_1: 'A-1', col_2: '42.5' }),
      expect.objectContaining({ col_1: 'Late', col_2: '44.1' }),
    ]);
  });

  it('reports exact workbook previewable row counts at the sample boundary', async () => {
    let fullPreviewableRowCount: number | undefined;

    vi.doMock('./normalize-preview', async () => {
      const actual = await vi.importActual<typeof import('./normalize-preview')>('./normalize-preview');

      return {
        ...actual,
        buildImportPreviewDataset: vi.fn((input: Parameters<typeof actual.buildImportPreviewDataset>[0]) => {
          fullPreviewableRowCount = input.fullPreviewableRowCount;

          return actual.buildImportPreviewDataset(input);
        }),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(
      Array.from({ length: IMPORT_PREVIEW_ROW_LIMIT + 2 }, (_, index) => [`Row-${index + 1}`]),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, 'ExactBoundary');

    await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'exact-boundary.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      }) as ArrayBuffer,
    });

    expect(fullPreviewableRowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT + 2);
  });

  it('keeps sparse workbook preview parsing bounded before confirm materialization', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B1000',
    };

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 100; index += 1) {
      const rowNumber = index + 1;
      sparseSheet[`A${rowNumber}`] = { t: 's', v: `A-${rowNumber}`, w: `A-${rowNumber}` };
      sparseSheet[`B${rowNumber}`] = { t: 'n', v: rowNumber, w: `${rowNumber}` };
    }

    let decodedCellCount = 0;

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
        utils: {
          ...actual.utils,
          decode_cell: vi.fn((cellAddress: string) => {
            decodedCellCount += 1;

            return actual.utils.decode_cell(cellAddress);
          }),
        },
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'large-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(IMPORT_PREVIEW_ROW_LIMIT);
    expect(preview.isPartialPreview).toBe(true);
    expect(decodedCellCount).toBeLessThan((IMPORT_PREVIEW_ROW_LIMIT + 100) * 2);
  });

  it('samples sparse workbook preview rows deterministically before applying the preview boundary', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B1000',
    };

    for (let index = 0; index < IMPORT_PREVIEW_ROW_LIMIT + 25; index += 1) {
      const rowNumber = 500 + index;
      sparseSheet[`A${rowNumber}`] = { t: 's', v: `Late-${index + 1}`, w: `Late-${index + 1}` };
      sparseSheet[`B${rowNumber}`] = { t: 'n', v: rowNumber, w: `${rowNumber}` };
    }

    sparseSheet.A1 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B1 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A2 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B2 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['OutOfOrderSparse'],
          Sheets: {
            OutOfOrderSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'out-of-order-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('does not enumerate sparse worksheet keys before the preview boundary when !ref is available', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
      '!ref': `A1:B${IMPORT_PREVIEW_ROW_LIMIT + 100}`,
    };
    const guardedSheet = new Proxy(sparseSheet, {
      ownKeys() {
        throw new Error('enumerated sparse worksheet keys before preview boundary');
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['Sparse'],
          Sheets: {
            Sparse: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'bounded-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('ignores inherited dense worksheet row properties during the primary preview scan', async () => {
    const denseSheet = [] as Array<Array<XLSX.CellObject | undefined> | undefined>;
    const inheritedRows = {
      0: [
        { t: 's', v: 'Polluted', w: 'Polluted' },
        { t: 's', v: 'Inherited', w: 'Inherited' },
      ],
    };

    denseSheet[1] = [
      { t: 's', v: 'Sample', w: 'Sample' },
      { t: 's', v: 'Reading', w: 'Reading' },
    ];
    denseSheet[2] = [
      { t: 's', v: 'A-1', w: 'A-1' },
      { t: 'n', v: 42.5, w: '42.5' },
    ];
    Object.setPrototypeOf(denseSheet, inheritedRows);
    Object.assign(denseSheet, {
      '!ref': 'A1:B3',
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['PollutedPrimary'],
          Sheets: {
            PollutedPrimary: denseSheet as typeof denseSheet & XLSX.WorkSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'polluted-primary.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('ignores malformed sparse cell addresses with unsafe column indexes', async () => {
    const unsafeAddress = 'AAAAAAAAAAAAAAAAAAAA1';
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
      [unsafeAddress]: { t: 's', v: 'Unsafe', w: 'Unsafe' },
      '!ref': 'A1:B2',
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['UnsafeSparse'],
          Sheets: {
            UnsafeSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'unsafe-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.confirmedDataset).toMatchObject({
      columnCount: 2,
      rowCount: 1,
    });
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

  it('does not scan inflated sparse worksheet blank ranges before the preview boundary', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      ZZ1: { t: 's', v: 'FarReading', w: 'FarReading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      ZZ2: { t: 'n', v: 42.5, w: '42.5' },
      '!ref': 'A1:ZZ100000',
    };
    let blankCellReads = 0;
    const guardedSheet = new Proxy(sparseSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^[A-Z]+\d+$/.test(property) && !Reflect.has(target, property)) {
          blankCellReads += 1;

          if (blankCellReads > 20) {
            throw new Error('scanned inflated blank worksheet cells');
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
            Sparse: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'inflated-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columnCount).toBe(2);
    expect(blankCellReads).toBeLessThanOrEqual(20);
  });

  it('treats present-empty sparse workbook rows as a bounded preview gap', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B100000',
    };

    for (let rowNumber = 1; rowNumber <= 250; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`B${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    let populatedCellReads = 0;
    const guardedSheet = new Proxy(sparseSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^[A-Z]+\d+$/.test(property) && Reflect.has(target, property)) {
          populatedCellReads += 1;

          if (populatedCellReads > 200) {
            throw new Error('scanned too many present-empty sparse worksheet rows');
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
          SheetNames: ['PresentEmptySparse'],
          Sheets: {
            PresentEmptySparse: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    await expect(
      parseMockedImportPreview({
        sourceKind: 'excel-file',
        sourceLabel: 'Local Excel workbook',
        fileName: 'present-empty-sparse.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        binaryContent: new ArrayBuffer(8),
      }),
    ).rejects.toThrow('The first worksheet did not contain any previewable rows.');

    expect(populatedCellReads).toBeLessThanOrEqual(200);
  });

  it('recovers sparse workbook previews whose first populated rows appear after a leading blank !ref gap', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A50: { t: 's', v: 'Sample', w: 'Sample' },
      B50: { t: 's', v: 'Reading', w: 'Reading' },
      A51: { t: 's', v: 'A-1', w: 'A-1' },
      B51: { t: 'n', v: 42.5, w: '42.5' },
      '!ref': 'A1:B100000',
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['LeadingBlankSparse'],
          Sheets: {
            LeadingBlankSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'leading-blank-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('recovers sparse workbook previews after leading present-empty rows without full key scans', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B100000',
    };

    for (let rowNumber = 1; rowNumber <= 25; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`B${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    sparseSheet.A50 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B50 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A51 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B51 = { t: 'n', v: 42.5, w: '42.5' };

    let populatedCellReads = 0;
    const guardedSheet = new Proxy(sparseSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^[A-Z]+\d+$/.test(property) && Reflect.has(target, property)) {
          populatedCellReads += 1;

          if (populatedCellReads > 200) {
            throw new Error('scanned too many sparse cells while recovering leading present-empty rows');
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
          SheetNames: ['LeadingPresentEmptySparse'],
          Sheets: {
            LeadingPresentEmptySparse: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'leading-present-empty-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(populatedCellReads).toBeLessThanOrEqual(200);
  });

  it('counts sparse fallback leading styled rows instead of styled cells before later data', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:D100000',
    };

    for (let rowNumber = 1; rowNumber <= 30; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`B${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`C${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`D${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    sparseSheet.A50 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B50 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A51 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B51 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['StyledLeadingRows'],
          Sheets: {
            StyledLeadingRows: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'styled-leading-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('does not spend sparse fallback own-cell budget on malformed keys or leading present-empty cells', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B100000',
    };

    for (let index = 0; index < 512; index += 1) {
      sparseSheet[`NOT_A_CELL_${index}`] = { t: 's', v: 'ignored', w: 'ignored' };
    }

    for (let rowNumber = 1; rowNumber <= 30; rowNumber += 1) {
      for (let columnIndex = 0; columnIndex < 150; columnIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
        sparseSheet[address] = { t: 's', v: '', w: '' };
      }
    }

    sparseSheet.A50 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B50 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A51 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B51 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['MalformedAndStyledLeadingRows'],
          Sheets: {
            MalformedAndStyledLeadingRows: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'malformed-and-styled-leading-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('counts malformed sparse worksheet own keys toward the fallback scan budget before parsing addresses', async () => {
    const sparseSheet: XLSX.WorkSheet = {};

    for (let index = 0; index < 20_000; index += 1) {
      sparseSheet[`NOT_A_CELL_${index}`] = { t: 's', v: 'ignored', w: 'ignored' };
    }

    sparseSheet.A5000 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B5000 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A5001 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B5001 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['MalformedKeys'],
          Sheets: {
            MalformedKeys: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    await expect(parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'malformed-sparse-keys.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    })).rejects.toThrow('The first worksheet did not contain any previewable rows.');
  });

  it('bounds sparse own-cell fallback key processing before confirmation', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B100000',
    };

    for (let rowNumber = 1; rowNumber <= 25; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
      sparseSheet[`B${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    sparseSheet.A50 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B50 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A51 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B51 = { t: 'n', v: 42.5, w: '42.5' };

    for (let rowNumber = 500; rowNumber < 10_000; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: `Trailing-${rowNumber}`, w: `Trailing-${rowNumber}` };
    }

    let sparseCellReads = 0;
    const guardedSheet = new Proxy(sparseSheet, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^[A-Z]+\d+$/.test(property) && Reflect.has(target, property)) {
          sparseCellReads += 1;

          if (sparseCellReads > 1_200) {
            throw new Error('processed too many sparse own cells before confirmation');
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
          SheetNames: ['BoundedSparseFallback'],
          Sheets: {
            BoundedSparseFallback: guardedSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'bounded-sparse-fallback.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(sparseCellReads).toBeLessThanOrEqual(1_200);
  });

  it('does not build and sort every sparse own-cell key during fallback preview recovery', async () => {
    const sparseSheet: XLSX.WorkSheet = {};

    for (let rowNumber = 1; rowNumber <= 20_000; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    sparseSheet.A25000 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B25000 = { t: 's', v: 'Reading', w: 'Reading' };
    const objectKeys = vi.spyOn(Object, 'keys');

    objectKeys.mockImplementation((value: object) => {
      if (value === sparseSheet) {
        throw new Error('sparse fallback enumerated all worksheet keys at once');
      }

      return Reflect.ownKeys(value)
        .filter((key): key is string => typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key));
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['OwnCellBudget'],
          Sheets: {
            OwnCellBudget: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    await expect(parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'sparse-own-cell-budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    })).rejects.toThrow('The first worksheet did not contain any previewable rows.');
  });

  it('does not scan every sparse own-cell key before evaluating bounded fallback candidates', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
    };

    for (let rowIndex = 10_000; rowIndex < 40_000; rowIndex += 1) {
      Object.defineProperty(sparseSheet, `A${rowIndex}`, {
        enumerable: true,
        get() {
          throw new Error('sparse fallback scanned too many worksheet keys');
        },
      });
    }

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['BoundedOwnKeyScan'],
          Sheets: {
            BoundedOwnKeyScan: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'bounded-own-key-scan.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('uses bounded own-cell fallback when a stale short sparse ref omits later real cells', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B1',
      A1: { t: 's', v: '', w: '' },
      B1: { t: 's', v: '', w: '' },
      A25: { t: 's', v: 'Sample', w: 'Sample' },
      B25: { t: 's', v: 'Reading', w: 'Reading' },
      A26: { t: 's', v: 'A-1', w: 'A-1' },
      B26: { t: 'n', v: 42.5, w: '42.5' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['StaleShortRef'],
          Sheets: {
            StaleShortRef: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'stale-short-ref.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('materializes sparse workbook cells outside a stale short ref when the ref also has preview rows', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
      A50: { t: 's', v: 'A-2', w: 'A-2' },
      B50: { t: 'n', v: 44.1, w: '44.1' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['StaleShortRefWithPreviewRows'],
          Sheets: {
            StaleShortRefWithPreviewRows: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'stale-short-ref-confirm.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(preview.sampleRows.map((row) => row.cells.map((cell) => cell.value))).toEqual([['A-1', '42.5']]);
    expect(preview.confirmedDataset?.rowCount).toBe(2);
    expect(preview.confirmedDataset?.rows.map((row) => Object.values(row))).toEqual([
      ['A-1', '42.5'],
      ['A-2', '44.1'],
    ]);
  });

  it('scans sparse own keys after an empty leading grid probe finds data outside the probe', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:B100000',
      A500: { t: 's', v: 'Sample', w: 'Sample' },
      B500: { t: 's', v: 'Reading', w: 'Reading' },
      A501: { t: 's', v: 'A-1', w: 'A-1' },
      B501: { t: 'n', v: 42.5, w: '42.5' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['OutsideLeadingGridProbe'],
          Sheets: {
            OutsideLeadingGridProbe: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'outside-leading-grid-probe.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('scans sparse own keys after a styled leading grid probe finds only empty cells', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:ZZ100000',
      A1: { t: 's', v: '', w: '' },
      A500: { t: 's', v: 'Sample', w: 'Sample' },
      B500: { t: 's', v: 'Reading', w: 'Reading' },
      A501: { t: 's', v: 'A-1', w: 'A-1' },
      B501: { t: 'n', v: 42.5, w: '42.5' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['StyledLeadingGridProbe'],
          Sheets: {
            StyledLeadingGridProbe: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'styled-leading-grid-probe.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('uses sparse own-key fallback after a full leading grid of styled empty rows', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:ZZ100000',
    };

    for (let rowNumber = 1; rowNumber <= 60; rowNumber += 1) {
      sparseSheet[`A${rowNumber}`] = { t: 's', v: '', w: '' };
    }

    sparseSheet.A500 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B500 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A501 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B501 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['FullStyledLeadingGridProbe'],
          Sheets: {
            FullStyledLeadingGridProbe: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'full-styled-leading-grid-probe.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('clears sparse fallback partial state after fully scanning styled-leading own keys', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      '!ref': 'A1:ZZ100000',
      A1: { t: 's', v: '', w: '' },
      A500: { t: 's', v: 'Sample', w: 'Sample' },
      B500: { t: 's', v: 'Reading', w: 'Reading' },
      A501: { t: 's', v: 'A-1', w: 'A-1' },
      B501: { t: 'n', v: 42.5, w: '42.5' },
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['StyledLeadingCompleteOwnKeys'],
          Sheets: {
            StyledLeadingCompleteOwnKeys: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'styled-leading-complete-own-keys.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.isPartialPreview).toBe(false);
  });

  it('validates sparse own-cell addresses before reading cell values during confirmed materialization', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
    };

    Object.defineProperty(sparseSheet, 'NOT_A_CELL', {
      enumerable: true,
      get() {
        throw new Error('malformed sparse key was read before address validation');
      },
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['AccessorBackedMalformedSparseKeys'],
          Sheets: {
            AccessorBackedMalformedSparseKeys: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'accessor-backed-malformed-sparse-keys.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
      materializeConfirmedDataset: true,
    });

    expect(preview.confirmedDataset?.rowCount).toBe(1);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('orders sparse own-cell fallback rows before applying the own-cell scan cap', async () => {
    const sparseSheet: XLSX.WorkSheet = {};

    for (let rowIndex = 20_000; rowIndex >= 2_000; rowIndex -= 1) {
      sparseSheet[`A${rowIndex}`] = { t: 's', v: `Late-${rowIndex}`, w: `Late-${rowIndex}` };
      sparseSheet[`B${rowIndex}`] = { t: 'n', v: rowIndex, w: `${rowIndex}` };
    }

    sparseSheet.A1 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B1 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A2 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B2 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['OwnCellOrder'],
          Sheets: {
            OwnCellOrder: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'own-cell-order.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
    expect(preview.isPartialPreview).toBe(true);
  });

  it('counts sparse own-cell fallback leading empty rows by row before applying cell scan caps', async () => {
    const sparseSheet: XLSX.WorkSheet = {};

    for (let rowIndex = 1; rowIndex <= 30; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < 600; columnIndex += 1) {
        sparseSheet[XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex })] = { t: 's', v: '', w: '' };
      }
    }

    sparseSheet.A40 = { t: 's', v: 'Sample', w: 'Sample' };
    sparseSheet.B40 = { t: 's', v: 'Reading', w: 'Reading' };
    sparseSheet.A41 = { t: 's', v: 'A-1', w: 'A-1' };
    sparseSheet.B41 = { t: 'n', v: 42.5, w: '42.5' };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['WideLeadingEmptyRows'],
          Sheets: {
            WideLeadingEmptyRows: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'wide-leading-empty-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
    expect(preview.sampleRows[0]?.cells.map((cell) => cell.value)).toEqual(['A-1', '42.5']);
  });

  it('rejects non-canonical sparse cell keys consistently during discovery and reads', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      a1: { t: 's', v: 'Sample', w: 'Sample' },
      b1: { t: 's', v: 'Reading', w: 'Reading' },
      '$A$2': { t: 's', v: 'A-1', w: 'A-1' },
      '$B$2': { t: 'n', v: 42.5, w: '42.5' },
      '!ref': 'A1:B2',
    };

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['NonCanonicalSparseKeys'],
          Sheets: {
            NonCanonicalSparseKeys: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    await expect(parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'non-canonical-sparse-keys.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    })).rejects.toThrow('The first worksheet did not contain any previewable rows.');
  });

  it('ignores inherited dense-row properties when reading sparse worksheet cells', async () => {
    const sparseSheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'Sample', w: 'Sample' },
      B1: { t: 's', v: 'Reading', w: 'Reading' },
      A2: { t: 's', v: 'A-1', w: 'A-1' },
      B2: { t: 'n', v: 42.5, w: '42.5' },
      '!ref': 'A1:B2',
    };
    Object.setPrototypeOf(sparseSheet, {
      1: [
        { t: 's', v: 'Polluted', w: 'Polluted' },
        { t: 'n', v: 999, w: '999' },
      ],
    });

    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

      return {
        ...actual,
        read: vi.fn(() => ({
          SheetNames: ['PollutedSparse'],
          Sheets: {
            PollutedSparse: sparseSheet,
          },
        })),
      };
    });

    const { parseImportPreview: parseMockedImportPreview } = await import('./parse-import-preview');

    const preview = await parseMockedImportPreview({
      sourceKind: 'excel-file',
      sourceLabel: 'Local Excel workbook',
      fileName: 'polluted-sparse.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryContent: new ArrayBuffer(8),
    });

    expect(preview.columns.map((column) => column.sourceName)).toEqual(['Sample', 'Reading']);
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
