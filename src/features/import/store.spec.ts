import { describe, expect, it } from 'vitest';

import { createWorkspaceKernelStore } from '../../stores/workspace-kernel';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import { createImportBenchmarkTimingEvent } from './benchmark-timing';
import type { ImportRepairSelections } from './preview-model';
import { createImportPreviewStore } from './store';

function createPreview(
  previewId: string,
  repairSelections: ImportRepairSelections = {
    delimiter: null,
    headerSelection: null,
    columnTypeOverrides: {},
    missingValuePolicy: null,
    additionalColumnsAcknowledgement: null,
  },
) {
  return {
    previewId,
    source: {
      sourceKind: 'csv-file' as const,
      sourceLabel: 'Local CSV file',
      fileName: `${previewId}.csv`,
      mimeType: 'text/csv',
      sheetName: null,
      benchmarkScenario: 'import.clean.csv-preview' as const,
    },
    rowCount: 2,
    isPartialPreview: false,
    columnCount: 2,
    columns: [],
    sampleRows: [],
    assumptions: [],
    uncertainties: [],
    issues: [],
    repairSelections,
    timing: {
      durationMs: 740,
      budgetMs: 5000,
      exceededBudget: false,
    },
  };
}

describe('createImportPreviewStore', () => {
  it('ignores stale worker updates after a newer import starts or the preview is cleared', () => {
    const previewStore = createImportPreviewStore();
    const stalePreview = createPreview('preview_csv_stale');
    const staleTimingEvent = createImportBenchmarkTimingEvent(stalePreview, () => '2026-04-20T10:00:00.000Z');

    previewStore.getState().commands.beginImport('import_001', 'csv-file');
    previewStore.getState().commands.beginImport('import_002', 'excel-file');
    previewStore.getState().commands.updateProgress(
      {
        phase: 'parsing',
        message: 'Stale CSV progress',
      },
      'import_001',
    );
    previewStore.getState().commands.resolveImport(stalePreview, staleTimingEvent, 'import_001');

    expect(previewStore.getState().status).toBe('parsing');
    expect(previewStore.getState().activeCorrelationId).toBe('import_002');
    expect(previewStore.getState().progress).toMatchObject({
      message: 'Preparing the local preview workspace.',
    });
    expect(previewStore.getState().preview).toBeNull();

    previewStore.getState().commands.reset();
    previewStore.getState().commands.failImport(
      {
        code: 'import.preview.failed',
        title: 'Stale import failed',
        detail: 'This failure should be ignored after reset.',
        retryable: true,
      },
      'import_002',
    );

    expect(previewStore.getState().status).toBe('idle');
    expect(previewStore.getState().error).toBeNull();
  });

  it('keeps preview state separate from the committed workspace kernel', () => {
    const kernelStore = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: structuredClone(workspaceLedgerFixture),
    });
    const initialSnapshot = structuredClone(kernelStore.getState().snapshot);
    const initialLedger = structuredClone(kernelStore.getState().ledger);
    const previewStore = createImportPreviewStore();
    const preview = createPreview('preview_csv');

    previewStore.getState().commands.beginImport('import_001', 'csv-file');
    previewStore.getState().commands.resolveImport(
      preview,
      createImportBenchmarkTimingEvent(preview, () => '2026-04-20T10:00:00.000Z'),
    );

    expect(previewStore.getState().selectors.status()).toBe('ready');
    expect(previewStore.getState().selectors.preview()).toMatchObject({
      previewId: 'preview_csv',
    });
    expect(kernelStore.getState().snapshot).toEqual(initialSnapshot);
    expect(kernelStore.getState().ledger).toEqual(initialLedger);
  });

  it('restores the prior preview when a started file import is canceled', () => {
    const previewStore = createImportPreviewStore();
    const readyPreview = createPreview('preview_csv', {
      delimiter: ';',
      headerSelection: 'first-row-header',
      columnTypeOverrides: {},
      missingValuePolicy: 'mark-empty',
      additionalColumnsAcknowledgement: null,
    });

    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-20T10:00:00.000Z'),
    );
    previewStore.getState().commands.beginImport('import_003', 'excel-file');
    previewStore.getState().commands.markBudgetExceeded();

    expect(previewStore.getState().status).toBe('parsing');
    expect(previewStore.getState().preview).toBeNull();

    previewStore.getState().commands.cancelImport('import_003');

    expect(previewStore.getState().status).toBe('ready');
    expect(previewStore.getState().preview).toMatchObject({
      previewId: 'preview_csv',
    });
    expect(previewStore.getState().repairSelections).toEqual(readyPreview.repairSelections);
    expect(previewStore.getState().budgetExceeded).toBe(false);
    expect(previewStore.getState().activeCorrelationId).toBeNull();
  });

  it('restores the committed preview marker when a newer import is canceled', () => {
    const previewStore = createImportPreviewStore();
    const readyPreview = createPreview('preview_csv');

    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-20T10:00:00.000Z'),
    );
    previewStore.getState().commands.markCommitted('preview_csv');
    previewStore.getState().commands.beginImport('import_004', 'excel-file');
    previewStore.getState().commands.cancelImport('import_004');

    expect(previewStore.getState()).toMatchObject({
      status: 'ready',
      preview: {
        previewId: 'preview_csv',
      },
      lastCommittedPreviewId: 'preview_csv',
    });
  });

  it('treats a fresh re-import of identical data as uncommitted until it is confirmed again', () => {
    const previewStore = createImportPreviewStore();
    const readyPreview = createPreview('preview_csv');

    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-22T09:00:00.000Z'),
    );
    previewStore.getState().commands.markCommitted('preview_csv');
    previewStore.getState().commands.beginImport('import_005', 'csv-file');
    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-22T09:05:00.000Z'),
      'import_005',
    );

    expect(previewStore.getState()).toMatchObject({
      status: 'ready',
      preview: {
        previewId: 'preview_csv',
      },
      lastCommittedPreviewId: null,
    });
  });

  it('keeps the active preview visible when an uncorrelated picker-start failure is reported', () => {
    const previewStore = createImportPreviewStore();
    const readyPreview = createPreview('preview_csv');

    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-22T09:00:00.000Z'),
    );

    previewStore.getState().commands.failImport({
      code: 'import.preview.selection-failed',
      title: 'File selection could not start',
      detail: 'picker blocked',
      retryable: true,
    });

    expect(previewStore.getState()).toMatchObject({
      status: 'error',
      activeCorrelationId: null,
      preview: readyPreview,
      preservedPreview: null,
      error: {
        code: 'import.preview.selection-failed',
        title: 'File selection could not start',
        detail: 'picker blocked',
        retryable: true,
      },
    });
  });

  it('restores the last valid preview when a repair replay fails', () => {
    const previewStore = createImportPreviewStore();
    const readyPreview = createPreview('preview_csv', {
      delimiter: ',',
      headerSelection: 'first-row-header',
      columnTypeOverrides: {
        col_1: 'numeric',
      },
      missingValuePolicy: 'mark-empty',
      additionalColumnsAcknowledgement: null,
    });

    previewStore.getState().commands.resolveImport(
      readyPreview,
      createImportBenchmarkTimingEvent(readyPreview, () => '2026-04-22T09:00:00.000Z'),
    );
    previewStore.getState().commands.beginImport('import_006', 'csv-file', {
      preserveRepairSelections: true,
    });
    previewStore.getState().commands.setRepairSelections({
      delimiter: ';',
      headerSelection: 'first-row-data',
      columnTypeOverrides: {
        col_1: 'text',
      },
      missingValuePolicy: 'drop-invalid-rows',
      additionalColumnsAcknowledgement: null,
    });
    previewStore.getState().commands.failImport(
      {
        code: 'import.preview.repair-failed',
        title: 'Repair replay failed',
        detail: 'Worker parse aborted.',
        retryable: true,
      },
      'import_006',
    );

    expect(previewStore.getState()).toMatchObject({
      status: 'error',
      activeCorrelationId: null,
      preview: readyPreview,
      preservedPreview: null,
      repairSelections: readyPreview.repairSelections,
      error: {
        code: 'import.preview.repair-failed',
        title: 'Repair replay failed',
        detail: 'Worker parse aborted.',
        retryable: true,
      },
    });
  });

  it('tracks repair selections and source payloads for worker-backed reparses', () => {
    const previewStore = createImportPreviewStore();

    previewStore.getState().commands.setSourceRequest({
      sourceKind: 'csv-file',
      sourceLabel: 'Local CSV file',
      fileName: 'dirty.csv',
      mimeType: 'text/csv',
      benchmarkScenario: 'import.dirty.type-repair',
      textContent: 'Sample,Reading\nA-1,42.5\nA-2,not recorded',
      repairSelections: {
        delimiter: null,
        headerSelection: null,
        columnTypeOverrides: {},
        missingValuePolicy: null,
      },
    });
    previewStore.getState().commands.setRepairSelections({
      delimiter: ',',
      headerSelection: 'first-row-header',
      columnTypeOverrides: {
        col_2: 'numeric',
      },
      missingValuePolicy: 'mark-empty',
    });

    expect(previewStore.getState().sourceRequest).toMatchObject({
      sourceKind: 'csv-file',
      benchmarkScenario: 'import.dirty.type-repair',
    });
    expect(previewStore.getState().repairSelections).toMatchObject({
      delimiter: ',',
      headerSelection: 'first-row-header',
      columnTypeOverrides: {
        col_2: 'numeric',
      },
      missingValuePolicy: 'mark-empty',
    });
  });
});
