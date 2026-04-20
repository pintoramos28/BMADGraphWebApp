import { describe, expect, it } from 'vitest';

import { createWorkspaceKernelStore } from '../../stores/workspace-kernel';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import { createImportBenchmarkTimingEvent } from './benchmark-timing';
import { createImportPreviewStore } from './store';

describe('createImportPreviewStore', () => {
  it('keeps preview state separate from the committed workspace kernel', () => {
    const kernelStore = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const initialSnapshot = structuredClone(kernelStore.getState().snapshot);
    const initialLedger = structuredClone(kernelStore.getState().ledger);
    const previewStore = createImportPreviewStore();

    previewStore.getState().commands.beginImport('import_001', 'csv-file');
    previewStore.getState().commands.resolveImport(
      {
        previewId: 'preview_csv',
        source: {
          sourceKind: 'csv-file',
          sourceLabel: 'Local CSV file',
          fileName: 'preview.csv',
          mimeType: 'text/csv',
          sheetName: null,
          benchmarkScenario: 'import.clean.csv-preview',
        },
        rowCount: 2,
        columnCount: 2,
        columns: [
          {
            columnId: 'col_1',
            sourceName: 'Sample',
            sampleValues: ['A-1'],
            inferredType: 'text',
            confidence: 'high',
            nonEmptyCount: 2,
            nullCount: 0,
          },
          {
            columnId: 'col_2',
            sourceName: 'Reading',
            sampleValues: ['42.5'],
            inferredType: 'numeric',
            confidence: 'high',
            nonEmptyCount: 2,
            nullCount: 0,
          },
        ],
        sampleRows: [
          {
            rowId: 'row_1',
            cells: [
              {
                columnId: 'col_1',
                value: 'A-1',
              },
              {
                columnId: 'col_2',
                value: '42.5',
              },
            ],
          },
        ],
        assumptions: [
          {
            assumptionId: 'assumption_delimiter',
            category: 'delimiter',
            label: 'Delimiter handling',
            value: 'Comma (,)',
            confidence: 'high',
          },
        ],
        uncertainties: [],
        timing: {
          durationMs: 740,
          budgetMs: 5000,
          exceededBudget: false,
        },
      },
      createImportBenchmarkTimingEvent(
        {
          previewId: 'preview_csv',
          source: {
            sourceKind: 'csv-file',
            sourceLabel: 'Local CSV file',
            fileName: 'preview.csv',
            mimeType: 'text/csv',
            sheetName: null,
            benchmarkScenario: 'import.clean.csv-preview',
          },
          rowCount: 2,
          columnCount: 2,
          columns: [],
          sampleRows: [],
          assumptions: [],
          uncertainties: [],
          timing: {
            durationMs: 740,
            budgetMs: 5000,
            exceededBudget: false,
          },
        },
        () => '2026-04-20T10:00:00.000Z',
      ),
    );

    expect(previewStore.getState().selectors.status()).toBe('ready');
    expect(previewStore.getState().selectors.preview()).toMatchObject({
      previewId: 'preview_csv',
    });
    expect(kernelStore.getState().snapshot).toEqual(initialSnapshot);
    expect(kernelStore.getState().ledger).toEqual(initialLedger);
  });
});
