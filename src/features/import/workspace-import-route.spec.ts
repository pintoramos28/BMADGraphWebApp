import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMPORT_PREVIEW_BUDGET_MS } from './benchmark-timing';
import type { ImportPreviewDataset } from './preview-model';
import { createImportPreviewStore } from './store';
import {
  CONFIRMATION_MATERIALIZATION_TIMEOUT_MESSAGE,
  CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE,
  failImportIfActive,
  bindWorkerImportFailureCallbacks,
  commitConfirmedImportToKernel,
  failImportFromWorkerCallbackIfCurrent,
  ensureImportRouteWorker,
  initializeImportWorker,
  applyResolvedImportPreviewTiming,
  awaitImportBudgetThreshold,
  clearActiveImportPreview,
  clearAbortControllerIfCurrent,
  createImportActivityTracker,
  createReplayableSourceRequest,
  isConfirmTimePreviewStillCurrent,
  createWorkerPayloadFromReplayableSourceRequest,
  detectOwnedImportBenchmarkScenario,
  describePartialPreviewNotice,
  getImportEntrypointPersistenceBlockedMessage,
  postWorkerImportFromRoute,
  postWorkerImportMessageWithBudget,
  readFileArrayBuffer,
  readFileText,
  readFileWithFileReader,
  rememberPreviewReplayContext,
  resolveDisplayedBenchmarkScenario,
  runImportBudgetedRead,
  shouldShowRejectImportAction,
  toImportPreparationError,
  validateSourceFileHandleMatchesPreview,
  isConfirmMaterializationRecoveryError,
  isImportEntrypointPersistenceBlocked,
  isRejectImportPersistenceBlocked,
  shouldSurfaceConfirmTimePreviewForAcknowledgement,
} from './workspace-import-route';
import { createWorkspaceKernelStore, createImportWorkspaceSnapshot } from '../../stores/workspace-kernel';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cleanCsvFixtureText = fs.readFileSync(
  path.join(repoRoot, '_bmad-output', 'benchmarks', 'benchmark_set_clean', 'csv', 'import.clean.csv-preview.csv'),
  'utf8',
);
const cleanExcelFixtureBuffer = fs.readFileSync(
  path.join(repoRoot, '_bmad-output', 'benchmarks', 'benchmark_set_clean', 'excel', 'import.clean.excel-preview.xlsx'),
);
const dirtyDelimiterFixtureText = fs.readFileSync(
  path.join(repoRoot, '_bmad-output', 'benchmarks', 'benchmark_set_dirty', 'csv', 'import.dirty.delimiter-repair.csv'),
  'utf8',
);
const dirtyTypeFixtureText = fs.readFileSync(
  path.join(repoRoot, '_bmad-output', 'benchmarks', 'benchmark_set_dirty', 'csv', 'import.dirty.type-repair.csv'),
  'utf8',
);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('describePartialPreviewNotice', () => {
  it('reads text files through FileReader when the browser API is available', async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      readAsText(file: Blob) {
        void file.text().then((value) => {
          this.result = value;
          this.onload?.();
        });
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    const file = new File([cleanCsvFixtureText], 'sample.csv', {
      type: 'text/csv',
    });

    await expect(readFileText(file)).resolves.toContain('Sample,Reading,MeasuredAt');
  });

  it('reads binary files through FileReader when the browser API is available', async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      readAsArrayBuffer(file: Blob) {
        void file.arrayBuffer().then((value) => {
          this.result = value;
          this.onload?.();
        });
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    const file = new File([cleanExcelFixtureBuffer], 'sample.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await expect(readFileArrayBuffer(file)).resolves.toMatchObject({
      byteLength: cleanExcelFixtureBuffer.byteLength,
    });
  });

  it('surfaces FileReader failures as read errors', async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      error = new DOMException('mock read failed');
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      readAsText() {
        this.onerror?.();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    await expect(
      readFileWithFileReader<string>(new Blob(['sample']), (reader, file) => {
        reader.readAsText(file);
      }),
    ).rejects.toThrow('mock read failed');
  });

  it('uses workbook-specific copy for capped Excel previews', () => {
    expect(
      describePartialPreviewNotice({
        rowCount: 200,
        source: {
          sourceKind: 'excel-file',
          sourceLabel: 'Local Excel workbook',
          fileName: 'sparse.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sheetName: 'Readings',
          benchmarkScenario: 'import.clean.excel-preview',
        },
      }),
    ).toContain('This workbook preview is showing the first 200 rows from the first sheet only.');
  });

  it('uses delimited-copy wording for CSV and pasted previews', () => {
    expect(
      describePartialPreviewNotice({
        rowCount: 200,
        source: {
          sourceKind: 'csv-file',
          sourceLabel: 'Local CSV file',
          fileName: 'large.csv',
          mimeType: 'text/csv',
          sheetName: null,
          benchmarkScenario: 'import.clean.csv-preview',
        },
      }),
    ).toContain('This delimited import is showing the first 200 rows only.');
  });

  it('marks the AC3 budget as exceeded while a clean CSV fixture read is still pending', async () => {
    vi.useFakeTimers();

    const file = new File([cleanCsvFixtureText], 'import.clean.csv-preview.csv', {
      type: 'text/csv',
    });
    let budgetExceeded = false;

    const pendingRead = awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () =>
        new Promise<string>((resolve) => {
          globalThis.setTimeout(async () => {
            resolve(await File.prototype.text.call(file));
          }, IMPORT_PREVIEW_BUDGET_MS + 1_500);
        }),
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
    });

    await vi.advanceTimersByTimeAsync(IMPORT_PREVIEW_BUDGET_MS);

    expect(budgetExceeded).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);

    await expect(pendingRead).resolves.toContain('Sample,Reading,MeasuredAt');
  });

  it('marks the AC3 budget as exceeded while a clean Excel fixture read is still pending', async () => {
    vi.useFakeTimers();

    const file = new File([cleanExcelFixtureBuffer], 'import.clean.excel-preview.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    let budgetExceeded = false;

    const pendingRead = awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () =>
        new Promise<ArrayBuffer>((resolve) => {
          globalThis.setTimeout(async () => {
            resolve(await File.prototype.arrayBuffer.call(file));
          }, IMPORT_PREVIEW_BUDGET_MS + 1_500);
        }),
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
    });

    await vi.advanceTimersByTimeAsync(IMPORT_PREVIEW_BUDGET_MS);

    expect(budgetExceeded).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);

    await expect(pendingRead).resolves.toMatchObject({
      byteLength: cleanExcelFixtureBuffer.byteLength,
    });
  });

  it('marks the AC3 budget as exceeded while owned benchmark verification is still pending', async () => {
    vi.useFakeTimers();

    let budgetExceeded = false;

    const pendingVerification = awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () =>
        new Promise<null>((resolve) => {
          globalThis.setTimeout(() => {
            resolve(null);
          }, IMPORT_PREVIEW_BUDGET_MS + 1_500);
        }),
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
    });

    await vi.advanceTimersByTimeAsync(IMPORT_PREVIEW_BUDGET_MS);

    expect(budgetExceeded).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);

    await expect(pendingVerification).resolves.toBeNull();
  });

  it('marks the AC3 budget as exceeded when verification only finishes after synchronous over-budget work', async () => {
    vi.useFakeTimers();

    let budgetExceeded = false;
    let nowValue = 0;

    const pendingVerification = awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () => {
        nowValue = IMPORT_PREVIEW_BUDGET_MS + 250;

        return 'import.clean.csv-preview' as const;
      },
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
      now: () => nowValue,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(budgetExceeded).toBe(true);
    await expect(pendingVerification).resolves.toBe('import.clean.csv-preview');
  });

  it('keeps the AC3 over-budget state visible when synchronous over-budget work rejects', async () => {
    vi.useFakeTimers();

    let budgetExceeded = false;
    let nowValue = 0;

    const pendingVerification = awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () => {
        nowValue = IMPORT_PREVIEW_BUDGET_MS + 250;

        throw new Error('benchmark verification failed');
      },
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
      now: () => nowValue,
    });
    const rejectedVerification = pendingVerification.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(0);

    expect(budgetExceeded).toBe(true);
    await expect(rejectedVerification).resolves.toMatchObject({
      message: 'benchmark verification failed',
    });
  });

  it('starts the local-read budget before invoking synchronous file APIs', async () => {
    vi.useFakeTimers();

    let budgetExceeded = false;
    let nowValue = 0;

    const pendingRead = runImportBudgetedRead({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      readOperation: () => {
        nowValue = IMPORT_PREVIEW_BUDGET_MS + 250;

        return Promise.resolve('Sample,Reading,MeasuredAt');
      },
      isActive: () => true,
      onBudgetExceeded: () => {
        budgetExceeded = true;
      },
      schedule: globalThis.setTimeout,
      clearScheduled: globalThis.clearTimeout,
      now: () => nowValue,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(budgetExceeded).toBe(true);
    await expect(pendingRead).resolves.toBe('Sample,Reading,MeasuredAt');
  });
});

describe('detectOwnedImportBenchmarkScenario', () => {
  it('tags only the owned clean Excel fixture through standard import detection', async () => {
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'excel-file',
        fileName: 'renamed-clean-fixture.xlsx',
        binaryContent: cleanExcelFixtureBuffer.buffer.slice(
          cleanExcelFixtureBuffer.byteOffset,
          cleanExcelFixtureBuffer.byteOffset + cleanExcelFixtureBuffer.byteLength,
        ),
      }),
    ).resolves.toBe('import.clean.excel-preview');
  });

  it('tags only the owned clean CSV fixture through standard text import detection', async () => {
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'csv-file',
        fileName: 'import.clean.csv-preview.csv',
        textContent: cleanCsvFixtureText,
      }),
    ).resolves.toBe('import.clean.csv-preview');
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'pasted-table',
        textContent: 'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18\nA-2\t44.1\t2026-04-19\nA-3\t43.8\t2026-04-20',
      }),
    ).resolves.toBeNull();
  });

  it('tags the owned dirty CSV fixtures through the standard import path', async () => {
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'csv-file',
        fileName: 'import.dirty.delimiter-repair.csv',
        textContent: dirtyDelimiterFixtureText,
      }),
    ).resolves.toBe('import.dirty.delimiter-repair');
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'csv-file',
        fileName: 'import.dirty.type-repair.csv',
        textContent: dirtyTypeFixtureText,
      }),
    ).resolves.toBe('import.dirty.type-repair');
  });

  it('leaves arbitrary imports untagged when the owned fixture proof is incomplete', async () => {
    const mismatchedExcelFixtureBuffer = cleanExcelFixtureBuffer.subarray();
    mismatchedExcelFixtureBuffer[0] = mismatchedExcelFixtureBuffer[0] === 0 ? 1 : 0;

    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'csv-file',
        fileName: 'renamed-clean-fixture.csv',
        textContent: cleanCsvFixtureText,
      }),
    ).resolves.toBeNull();
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'csv-file',
        fileName: 'import.clean.csv-preview.csv',
        textContent: 'Sample,Reading,MeasuredAt\nA-1,99.0,2026-04-18',
      }),
    ).resolves.toBeNull();
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'excel-file',
        fileName: 'import.clean.excel-preview.xlsx',
        binaryContent: mismatchedExcelFixtureBuffer.buffer.slice(
          mismatchedExcelFixtureBuffer.byteOffset,
          mismatchedExcelFixtureBuffer.byteOffset + mismatchedExcelFixtureBuffer.byteLength,
        ),
      }),
    ).resolves.toBeNull();
    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'pasted-table',
        textContent: 'Sample\tReading\nA-1\t42.5',
      }),
    ).resolves.toBeNull();
  });

  it('falls back to a non-benchmark Excel classification when digest verification rejects', async () => {
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValue(new Error('digest unavailable'));

    await expect(
      detectOwnedImportBenchmarkScenario({
        sourceKind: 'excel-file',
        binaryContent: cleanExcelFixtureBuffer.buffer.slice(
          cleanExcelFixtureBuffer.byteOffset,
          cleanExcelFixtureBuffer.byteOffset + cleanExcelFixtureBuffer.byteLength,
        ),
      }),
    ).resolves.toBeNull();
  });
});

describe('failImportIfActive', () => {
  it('ignores stale route-side failures without tearing down the active import worker', () => {
    const clearBenchmark = vi.fn();
    const clearBudgetTimer = vi.fn();
    const disposeWorker = vi.fn();
    const failImport = vi.fn();

    const handled = failImportIfActive({
      correlationId: 'stale-import',
      importError: {
        code: 'import.preview.read-failed',
        title: 'Selected file could not be read',
        detail: 'stale failure',
        retryable: true,
      },
      isActive: () => false,
      clearBenchmark,
      clearBudgetTimer,
      disposeWorker,
      failImport,
    });

    expect(handled).toBe(false);
    expect(clearBenchmark).not.toHaveBeenCalled();
    expect(clearBudgetTimer).not.toHaveBeenCalled();
    expect(disposeWorker).not.toHaveBeenCalled();
    expect(failImport).not.toHaveBeenCalled();
  });

  it('applies teardown for the active import failure only', () => {
    const clearBenchmark = vi.fn();
    const clearBudgetTimer = vi.fn();
    const disposeWorker = vi.fn();
    const failImport = vi.fn();
    const importError = {
      code: 'import.preview.read-failed',
      title: 'Selected file could not be read',
      detail: 'active failure',
      retryable: true,
    };

    const handled = failImportIfActive({
      correlationId: 'active-import',
      importError,
      isActive: (correlationId) => correlationId === 'active-import',
      clearBenchmark,
      clearBudgetTimer,
      disposeWorker,
      failImport,
    });

    expect(handled).toBe(true);
    expect(clearBenchmark).toHaveBeenCalledWith('active-import');
    expect(clearBudgetTimer).toHaveBeenCalledWith('active-import');
    expect(disposeWorker).toHaveBeenCalledOnce();
    expect(failImport).toHaveBeenCalledWith(importError, 'active-import');
  });
});

describe('failImportFromWorkerCallbackIfCurrent', () => {
  it('ignores a late worker callback after a newer worker replaces the active import', () => {
    const staleWorker = { label: 'stale-worker' };
    const activeWorker = { label: 'active-worker' };
    const failImport = vi.fn();

    const handled = failImportFromWorkerCallbackIfCurrent({
      worker: staleWorker,
      activeWorker,
      correlationId: 'stale-import',
      detail: 'late worker error',
      isActiveImport: () => true,
      failImport,
    });

    expect(handled).toBe(false);
    expect(failImport).not.toHaveBeenCalled();
  });

  it('fails the bound import only when the callback still belongs to the active worker and request', () => {
    const worker = { label: 'active-worker' };
    const failImport = vi.fn();

    const handled = failImportFromWorkerCallbackIfCurrent({
      worker,
      activeWorker: worker,
      correlationId: 'active-import',
      detail: 'worker could not finish',
      isActiveImport: (correlationId) => correlationId === 'active-import',
      failImport,
    });

    expect(handled).toBe(true);
    expect(failImport).toHaveBeenCalledWith('active-import', 'worker could not finish');
  });
});

describe('bindWorkerImportFailureCallbacks', () => {
  function createMockWorkerFailureTarget() {
    return {
      onerror: null,
      onmessageerror: null,
    } as unknown as Pick<Worker, 'onerror' | 'onmessageerror'>;
  }

  function createBoundImportFailureHarness() {
    const store = createImportPreviewStore();
    const staleWorker = createMockWorkerFailureTarget();
    const activeWorker = createMockWorkerFailureTarget();
    let currentWorker: Pick<Worker, 'onerror' | 'onmessageerror'> | null = staleWorker;

    const failImport = (correlationId: string, detail: string) => {
      store.getState().commands.failImport(
        {
          code: 'import.preview.worker-failed',
          title: 'Preview could not be prepared',
          detail,
          retryable: true,
        },
        correlationId,
      );
    };

    store.getState().commands.beginImport('stale-import', 'csv-file');
    bindWorkerImportFailureCallbacks({
      worker: staleWorker,
      getActiveWorker: () => currentWorker,
      correlationId: 'stale-import',
      isActiveImport: (correlationId) => store.getState().activeCorrelationId === correlationId,
      failImport,
    });

    store.getState().commands.beginImport('active-import', 'csv-file');
    currentWorker = activeWorker;
    bindWorkerImportFailureCallbacks({
      worker: activeWorker,
      getActiveWorker: () => currentWorker,
      correlationId: 'active-import',
      isActiveImport: (correlationId) => store.getState().activeCorrelationId === correlationId,
      failImport,
    });

    return {
      store,
      staleWorker,
      activeWorker,
    };
  }

  it('keeps the active parsing import intact when a stale worker onerror fires after replacement', () => {
    const { store, staleWorker } = createBoundImportFailureHarness();
    const preventDefault = vi.fn();
    const onerror = staleWorker.onerror;

    onerror?.call(
      {} as AbstractWorker,
      {
        message: 'stale worker error',
        preventDefault,
      } as unknown as ErrorEvent,
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      status: 'parsing',
      activeCorrelationId: 'active-import',
      error: null,
    });
  });

  it('keeps the active parsing import intact when a stale worker onmessageerror fires after replacement', () => {
    const { store, staleWorker, activeWorker } = createBoundImportFailureHarness();
    const staleMessageError = staleWorker.onmessageerror;
    const activeMessageError = activeWorker.onmessageerror;

    staleMessageError?.call({} as Worker, {} as MessageEvent);

    expect(store.getState()).toMatchObject({
      status: 'parsing',
      activeCorrelationId: 'active-import',
      error: null,
    });

    activeMessageError?.call({} as Worker, {} as MessageEvent);

    expect(store.getState()).toMatchObject({
      status: 'error',
      activeCorrelationId: null,
      error: {
        code: 'import.preview.worker-failed',
        title: 'Preview could not be prepared',
        detail: 'The import worker returned an unreadable preview message.',
        retryable: true,
      },
    });
  });
});

describe('initializeImportWorker', () => {
  it('binds worker failure callbacks during initialization so bootstrap failures fail the active import', () => {
    const preventDefault = vi.fn();
    const failImport = vi.fn();
    let onmessage: Worker['onmessage'] = null;
    let onmessageerror: Worker['onmessageerror'] = null;
    let onerror: Worker['onerror'] = null;

    const worker = {
      get onmessage() {
        return onmessage;
      },
      set onmessage(handler) {
        onmessage = handler;
      },
      get onmessageerror() {
        return onmessageerror;
      },
      set onmessageerror(handler) {
        onmessageerror = handler;
      },
      get onerror() {
        return onerror;
      },
      set onerror(handler) {
        onerror = handler;
        handler?.call(
          {} as AbstractWorker,
          {
            message: 'bootstrap failure',
            preventDefault,
          } as unknown as ErrorEvent,
        );
      },
    } satisfies Pick<Worker, 'onmessage' | 'onerror' | 'onmessageerror'>;

    const initializedWorker = initializeImportWorker({
      createWorker: () => worker,
      onMessage: vi.fn(),
      getActiveWorker: () => null,
      correlationId: 'bootstrap-import',
      isActiveImport: (correlationId) => correlationId === 'bootstrap-import',
      failImport,
    });

    expect(initializedWorker).toBeNull();
    expect(typeof worker.onmessage).toBe('function');
    expect(typeof worker.onmessageerror).toBe('function');
    expect(typeof worker.onerror).toBe('function');
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(failImport).toHaveBeenCalledWith('bootstrap-import', 'bootstrap failure');
  });

  it('tears down a worker that fails before the route stores it as active', () => {
    const preventDefault = vi.fn();
    const failImport = vi.fn();
    const disposeWorker = vi.fn();
    let onmessage: Worker['onmessage'] = null;
    let onmessageerror: Worker['onmessageerror'] = null;
    let onerror: Worker['onerror'] = null;

    const worker = {
      get onmessage() {
        return onmessage;
      },
      set onmessage(handler) {
        onmessage = handler;
      },
      get onmessageerror() {
        return onmessageerror;
      },
      set onmessageerror(handler) {
        onmessageerror = handler;
      },
      get onerror() {
        return onerror;
      },
      set onerror(handler) {
        onerror = handler;
        handler?.call(
          {} as AbstractWorker,
          {
            message: 'bootstrap failure',
            preventDefault,
          } as unknown as ErrorEvent,
        );
      },
      terminate: vi.fn(),
    } satisfies Pick<Worker, 'onmessage' | 'onerror' | 'onmessageerror' | 'terminate'>;

    const initializedWorker = initializeImportWorker({
      createWorker: () => worker,
      onMessage: vi.fn(),
      getActiveWorker: () => null,
      correlationId: 'bootstrap-import',
      isActiveImport: (correlationId) => correlationId === 'bootstrap-import',
      disposeWorker,
      failImport,
    });

    expect(initializedWorker).toBeNull();
    expect(disposeWorker).toHaveBeenCalledWith(worker);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(failImport).toHaveBeenCalledWith('bootstrap-import', 'bootstrap failure');
  });
});

describe('route worker import flow', () => {
  it('does not retain or post to a worker that fails during synchronous bootstrap', () => {
    const preventDefault = vi.fn();
    const failImport = vi.fn();
    const disposeWorker = vi.fn();
    const armBudgetTimer = vi.fn();
    const clearBudgetTimer = vi.fn();
    const markBudgetExceeded = vi.fn();
    let activeWorker: (Pick<Worker, 'postMessage' | 'onmessage' | 'onerror' | 'onmessageerror'> & {
      terminate: ReturnType<typeof vi.fn>;
    }) | null = null;
    let onmessage: Worker['onmessage'] = null;
    let onmessageerror: Worker['onmessageerror'] = null;
    let onerror: Worker['onerror'] = null;

    const worker = {
      postMessage: vi.fn(),
      get onmessage() {
        return onmessage;
      },
      set onmessage(handler) {
        onmessage = handler;
      },
      get onmessageerror() {
        return onmessageerror;
      },
      set onmessageerror(handler) {
        onmessageerror = handler;
      },
      get onerror() {
        return onerror;
      },
      set onerror(handler) {
        onerror = handler;
        handler?.call(
          {} as AbstractWorker,
          {
            message: 'bootstrap failure',
            preventDefault,
          } as unknown as ErrorEvent,
        );
      },
      terminate: vi.fn(),
    } satisfies Pick<Worker, 'postMessage' | 'onmessage' | 'onerror' | 'onmessageerror' | 'terminate'>;

    const ensureWorker = (correlationId: string) =>
      ensureImportRouteWorker({
        currentWorker: activeWorker,
        initializeWorker: () =>
          initializeImportWorker({
            createWorker: () => worker,
            onMessage: vi.fn(),
            getActiveWorker: () => activeWorker,
            correlationId,
            isActiveImport: (activeCorrelationId) => activeCorrelationId === correlationId,
            disposeWorker,
            failImport,
          }),
        storeWorker: (initializedWorker) => {
          activeWorker = initializedWorker;
        },
      });

    const didPost = postWorkerImportFromRoute({
      correlationId: 'bootstrap-import',
      sourceKind: 'csv-file',
      payload: {
        sourceLabel: 'Local CSV file',
        textContent: 'Sample,Reading\nA-1,42.5',
      },
      ensureWorker,
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      armBudgetTimer,
      clearBudgetTimer,
      markBudgetExceeded,
    });

    expect(didPost).toBe(false);
    expect(activeWorker).toBeNull();
    expect(disposeWorker).toHaveBeenCalledWith(worker);
    expect(failImport).toHaveBeenCalledWith('bootstrap-import', 'bootstrap failure');
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(armBudgetTimer).not.toHaveBeenCalled();
    expect(clearBudgetTimer).not.toHaveBeenCalled();
    expect(markBudgetExceeded).not.toHaveBeenCalled();
  });
});

describe('createImportActivityTracker', () => {
  it('invalidates in-flight imports after the route is disposed', () => {
    const tracker = createImportActivityTracker(() => 1_000);

    expect(tracker.isActive('import_001', 'import_001')).toBe(true);

    tracker.dispose();

    expect(tracker.isActive('import_001', 'import_001')).toBe(false);
    expect(tracker.resolveBenchmarkDuration('import_001', 700, 1_500)).toBe(700);
  });

  it('extends benchmark durations to include local file-read time', () => {
    const tracker = createImportActivityTracker(() => 1_000);
    tracker.markBenchmarkStart('import_001');

    expect(tracker.resolveBenchmarkDuration('import_001', 900, 2_650)).toBe(1650);
  });
});

describe('rememberPreviewReplayContext', () => {
  it('caches a replay source for a newly surfaced confirm-time blocker preview', () => {
    const contexts = new Map();
    const sourceRequest = createReplayableSourceRequest({
      sourceKind: 'csv-file',
      payload: {
        sourceLabel: 'Local CSV file',
        fileName: 'blocking.csv',
        mimeType: 'text/csv',
      },
      localFile: new File(['Sample,Reading\nA-1,'], 'blocking.csv', {
        type: 'text/csv',
      }),
    });

    rememberPreviewReplayContext({
      contexts,
      previewId: 'preview_confirm_time_blocker',
      sourceRequest,
      pendingLocalImportSelection: {
        sourceKind: 'csv-file',
        fileName: 'blocking.csv',
      },
    });

    expect(contexts.get('preview_confirm_time_blocker')).toMatchObject({
      sourceRequest,
      pendingLocalImportSelection: {
        sourceKind: 'csv-file',
        fileName: 'blocking.csv',
      },
    });
  });
});

describe('isConfirmTimePreviewStillCurrent', () => {
  it('rejects confirm-time previews materialized for a stale visible preview', () => {
    expect(isConfirmTimePreviewStillCurrent({
      expectedPreviewId: 'preview_original',
      visiblePreviewId: 'preview_newer',
    })).toBe(false);
  });

  it('allows confirm-time previews while the expected preview is still visible', () => {
    expect(isConfirmTimePreviewStillCurrent({
      expectedPreviewId: 'preview_original',
      visiblePreviewId: 'preview_original',
    })).toBe(true);
  });
});

describe('confirm-time recovery affordances', () => {
  it('keeps Reject Import available while confirm-time materialization is pending', () => {
    expect(shouldShowRejectImportAction({
      previewCommitted: false,
      confirmPersistencePending: false,
    })).toBe(true);
  });

  it('hides Reject Import once confirm persistence is in flight', () => {
    expect(shouldShowRejectImportAction({
      previewCommitted: false,
      confirmPersistencePending: true,
    })).toBe(false);
  });

  it('blocks stale Reject handlers synchronously after confirm persistence starts', () => {
    expect(isRejectImportPersistenceBlocked({
      previewId: 'preview_confirming',
      pendingPreviewId: 'preview_confirming',
    })).toBe(true);
    expect(isRejectImportPersistenceBlocked({
      previewId: 'preview_other',
      pendingPreviewId: 'preview_confirming',
    })).toBe(false);
  });

  it('blocks stale import entrypoint handlers synchronously after confirm persistence starts', () => {
    expect(isImportEntrypointPersistenceBlocked({
      pendingPreviewId: 'preview_confirming',
    })).toBe(true);
    expect(isImportEntrypointPersistenceBlocked({
      pendingPreviewId: null,
      confirmationPendingPreviewId: 'preview_confirming',
    })).toBe(true);
    expect(isImportEntrypointPersistenceBlocked({
      pendingPreviewId: null,
    })).toBe(false);
    expect(CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE).toContain('validating or saving');
  });

  it('provides visible entrypoint lock copy while confirm persistence is pending', () => {
    expect(getImportEntrypointPersistenceBlockedMessage({
      pendingPreviewId: 'preview_confirming',
    })).toBe(CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE);
    expect(getImportEntrypointPersistenceBlockedMessage({
      pendingPreviewId: null,
      confirmationPendingPreviewId: 'preview_confirming',
    })).toBe(CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE);
    expect(getImportEntrypointPersistenceBlockedMessage({
      pendingPreviewId: null,
    })).toBeNull();
  });

  it('requires acknowledgement when confirm-time materialization discovers rows after a complete preview', () => {
    const visiblePreview = {
      previewId: 'preview_sparse_stale_ref',
      rowCount: 1,
      columnCount: 2,
      isPartialPreview: false,
    } as ImportPreviewDataset;
    const confirmedPreview = {
      ...visiblePreview,
      previewId: 'preview_sparse_stale_ref_confirmed',
      rowCount: 2,
      isPartialPreview: true,
    } as ImportPreviewDataset;

    expect(shouldSurfaceConfirmTimePreviewForAcknowledgement({
      visiblePreview,
      confirmedPreview,
    })).toBe(true);
    expect(shouldSurfaceConfirmTimePreviewForAcknowledgement({
      visiblePreview: {
        ...visiblePreview,
        isPartialPreview: true,
      },
      confirmedPreview,
    })).toBe(false);
  });

  it('does not show Reject Import after the preview has committed', () => {
    expect(shouldShowRejectImportAction({ previewCommitted: true })).toBe(false);
  });

  it('preserves confirm-time materialization timeout errors as user-recoverable action copy', () => {
    expect(isConfirmMaterializationRecoveryError(new Error(CONFIRMATION_MATERIALIZATION_TIMEOUT_MESSAGE))).toBe(true);
    expect(isConfirmMaterializationRecoveryError(new Error('other failure'))).toBe(false);
  });

  it('does not let a stale confirm flow clear a newer source-validation abort controller', () => {
    const staleController = new AbortController();
    const newerController = new AbortController();
    const ref = {
      current: newerController,
    };

    expect(clearAbortControllerIfCurrent(ref, staleController)).toBe(false);
    expect(ref.current).toBe(newerController);
    expect(clearAbortControllerIfCurrent(ref, newerController)).toBe(true);
    expect(ref.current).toBeNull();
  });
});

describe('createWorkerPayloadFromReplayableSourceRequest', () => {
  it('re-reads local Excel files for repair reruns instead of depending on a retained transferred buffer', async () => {
    const localFile = new File([cleanExcelFixtureBuffer], 'repair.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const initialTransferredBuffer = cleanExcelFixtureBuffer.buffer.slice(
      cleanExcelFixtureBuffer.byteOffset,
      cleanExcelFixtureBuffer.byteOffset + cleanExcelFixtureBuffer.byteLength,
    );
    const readBinaryFile = vi
      .fn<((file: File) => Promise<ArrayBuffer>)>()
      .mockResolvedValue(cleanExcelFixtureBuffer.buffer.slice(
        cleanExcelFixtureBuffer.byteOffset,
        cleanExcelFixtureBuffer.byteOffset + cleanExcelFixtureBuffer.byteLength,
      ));
    const replayableRequest = createReplayableSourceRequest({
      sourceKind: 'excel-file',
      payload: {
        sourceLabel: 'Local Excel workbook',
        fileName: 'repair.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        binaryContent: initialTransferredBuffer,
      },
      localFile,
    });

    const repairedPayload = await createWorkerPayloadFromReplayableSourceRequest(
      replayableRequest,
      {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: null,
        additionalColumnsAcknowledgement: null,
      },
      {
        readBinaryFile,
      },
    );

    expect(readBinaryFile).toHaveBeenCalledOnce();
    expect(readBinaryFile).toHaveBeenCalledWith(localFile);
    expect(repairedPayload.binaryContent).toBeDefined();
    expect(repairedPayload.binaryContent).not.toBe(initialTransferredBuffer);
    expect(repairedPayload.binaryContent?.byteLength).toBe(cleanExcelFixtureBuffer.byteLength);
  });

  it('rejects local-file payload creation when confirm materialization is canceled during the source read', async () => {
    const localFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
    });
    const abortController = new AbortController();
    const replayableRequest = createReplayableSourceRequest({
      sourceKind: 'csv-file',
      payload: {
        sourceLabel: 'Local CSV file',
        fileName: 'source.csv',
        mimeType: 'text/csv',
      },
      localFile,
    });

    await expect(createWorkerPayloadFromReplayableSourceRequest(
      replayableRequest,
      {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: null,
        additionalColumnsAcknowledgement: null,
      },
      {
        async readTextFile() {
          abortController.abort();

          return 'Sample,Reading\nA-1,42.5';
        },
        signal: abortController.signal,
      },
    )).rejects.toThrow('confirm-time import pass was canceled');
  });
});

describe('validateSourceFileHandleMatchesPreview', () => {
  it('fails closed when a local source handle no longer matches the previewed file bytes', async () => {
    const previewedFile = new File(['previewed'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const changedFile = new File(['changed!'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const replayableRequest = createReplayableSourceRequest({
      sourceKind: 'csv-file',
      payload: {
        sourceLabel: 'Local CSV file',
        fileName: 'source.csv',
        mimeType: 'text/csv',
      },
      localFile: previewedFile,
    });

    await expect(validateSourceFileHandleMatchesPreview(replayableRequest, {
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      handle: {
        name: 'source.csv',
        async getFile() {
          return changedFile;
        },
        async createWritable() {
          return {
            async write() {},
            async close() {},
          };
        },
      },
    })).rejects.toThrow('changed after preview');
  });

  it('passes cancellation through local source-handle validation before preview byte reads', async () => {
    const previewedFile = new File(['previewed'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const liveFile = new File(['previewed'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const abortController = new AbortController();
    const previewArrayBuffer = vi.spyOn(previewedFile, 'arrayBuffer');
    const replayableRequest = createReplayableSourceRequest({
      sourceKind: 'csv-file',
      payload: {
        sourceLabel: 'Local CSV file',
        fileName: 'source.csv',
        mimeType: 'text/csv',
      },
      localFile: previewedFile,
    });

    vi.spyOn(liveFile, 'arrayBuffer').mockImplementation(async () => {
      abortController.abort();

      return new File(['previewed'], 'source.csv').arrayBuffer();
    });

    await expect(validateSourceFileHandleMatchesPreview(replayableRequest, {
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      handle: {
        name: 'source.csv',
        async getFile() {
          return liveFile;
        },
        async createWritable() {
          return {
            async write() {},
            async close() {},
          };
        },
      },
    }, abortController.signal)).rejects.toThrow('source-file validation was canceled');
    expect(previewArrayBuffer).not.toHaveBeenCalled();
  });
});

describe('applyResolvedImportPreviewTiming', () => {
  it('writes end-to-end readiness timing back into the resolved preview payload', () => {
    const resolvedPreview = applyResolvedImportPreviewTiming(
      {
        previewId: 'preview_csv',
        source: {
          sourceKind: 'csv-file',
          sourceLabel: 'Local CSV file',
          fileName: 'import.clean.csv-preview.csv',
          mimeType: 'text/csv',
          sheetName: null,
          benchmarkScenario: 'import.clean.csv-preview',
        },
        rowCount: 2,
        isPartialPreview: false,
        columnCount: 2,
        columns: [],
        sampleRows: [],
        assumptions: [],
        uncertainties: [],
        issues: [],
        repairSelections: {
          delimiter: null,
          headerSelection: null,
          columnTypeOverrides: {},
          missingValuePolicy: null,
        },
        timing: {
          durationMs: 900,
          budgetMs: IMPORT_PREVIEW_BUDGET_MS,
          exceededBudget: false,
        },
      },
      6_250,
    );

    expect(resolvedPreview.timing.durationMs).toBe(6_250);
    expect(resolvedPreview.timing.exceededBudget).toBe(true);
  });
});

describe('resolveDisplayedBenchmarkScenario', () => {
  it('uses the preview benchmark scenario when it was already verified upstream', () => {
    expect(
      resolveDisplayedBenchmarkScenario(
        {
          previewId: 'preview_csv',
          source: {
            sourceKind: 'csv-file',
            sourceLabel: 'Local CSV file',
            fileName: 'import.clean.csv-preview.csv',
            mimeType: 'text/csv',
            sheetName: null,
            benchmarkScenario: 'import.clean.csv-preview',
          },
          rowCount: 3,
          isPartialPreview: false,
          columnCount: 3,
          columns: [],
          sampleRows: [],
          assumptions: [],
          uncertainties: [],
          issues: [],
          repairSelections: {
            delimiter: null,
            headerSelection: null,
            columnTypeOverrides: {},
            missingValuePolicy: null,
          },
          timing: {
            durationMs: 420,
            budgetMs: IMPORT_PREVIEW_BUDGET_MS,
            exceededBudget: false,
          },
        },
        null,
      ),
    ).toBe('import.clean.csv-preview');
  });

  it('does not recover a clean benchmark label from matching preview rows alone', () => {
    expect(
      resolveDisplayedBenchmarkScenario(
        {
          previewId: 'preview_csv',
          source: {
            sourceKind: 'csv-file',
            sourceLabel: 'Local CSV file',
            fileName: 'customer-upload.csv',
            mimeType: 'text/csv',
            sheetName: null,
            benchmarkScenario: null,
          },
          rowCount: 3,
          isPartialPreview: false,
          columnCount: 3,
          columns: [
            {
              columnId: 'col_1',
              sourceName: 'Sample',
              sampleValues: ['A-1', 'A-2', 'A-3'],
              inferredType: 'text',
              confidence: 'high',
              nonEmptyCount: 3,
              nullCount: 0,
            },
            {
              columnId: 'col_2',
              sourceName: 'Reading',
              sampleValues: ['42.5', '44.1', '43.8'],
              inferredType: 'numeric',
              confidence: 'high',
              nonEmptyCount: 3,
              nullCount: 0,
            },
            {
              columnId: 'col_3',
              sourceName: 'MeasuredAt',
              sampleValues: ['2026-04-18', '2026-04-19', '2026-04-20'],
              inferredType: 'date',
              confidence: 'high',
              nonEmptyCount: 3,
              nullCount: 0,
            },
          ],
          sampleRows: [
            {
              rowId: 'row_1',
              cells: [
                { columnId: 'col_1', value: 'A-1' },
                { columnId: 'col_2', value: '42.5' },
                { columnId: 'col_3', value: '2026-04-18' },
              ],
            },
            {
              rowId: 'row_2',
              cells: [
                { columnId: 'col_1', value: 'A-2' },
                { columnId: 'col_2', value: '44.1' },
                { columnId: 'col_3', value: '2026-04-19' },
              ],
            },
            {
              rowId: 'row_3',
              cells: [
                { columnId: 'col_1', value: 'A-3' },
                { columnId: 'col_2', value: '43.8' },
                { columnId: 'col_3', value: '2026-04-20' },
              ],
            },
          ],
          assumptions: [],
          uncertainties: [],
          issues: [],
          repairSelections: {
            delimiter: null,
            headerSelection: null,
            columnTypeOverrides: {},
            missingValuePolicy: null,
          },
          timing: {
            durationMs: 420,
            budgetMs: IMPORT_PREVIEW_BUDGET_MS,
            exceededBudget: false,
          },
        },
        null,
      ),
    ).toBeNull();
  });
});

describe('toImportPreparationError', () => {
  it('separates picker startup failures from later file preparation failures', () => {
    expect(toImportPreparationError('selection', new Error('picker blocked'))).toMatchObject({
      code: 'import.preview.selection-failed',
      title: 'File selection could not start',
      detail: 'picker blocked',
    });
    expect(toImportPreparationError('read', new Error('filesystem read failed'))).toMatchObject({
      code: 'import.preview.read-failed',
      title: 'Selected file could not be read',
      detail: 'filesystem read failed',
    });
    expect(toImportPreparationError('benchmark-detection', new Error('digest timeout'))).toMatchObject({
      code: 'import.preview.benchmark-detection-failed',
      title: 'Benchmark verification could not finish',
      detail: 'digest timeout',
    });
  });
});

describe('clearActiveImportPreview', () => {
  it('resets route state and terminates the active worker when the preview is cleared', () => {
    const clearPasteValidationError = vi.fn();
    const clearBenchmark = vi.fn();
    const clearBudgetTimer = vi.fn();
    const disposeWorker = vi.fn();
    const resetPreview = vi.fn();

    clearActiveImportPreview({
      clearPasteValidationError,
      clearBenchmark,
      clearBudgetTimer,
      disposeWorker,
      resetPreview,
    });

    expect(clearPasteValidationError).toHaveBeenCalledOnce();
    expect(clearBenchmark).toHaveBeenCalledOnce();
    expect(clearBudgetTimer).toHaveBeenCalledOnce();
    expect(disposeWorker).toHaveBeenCalledOnce();
    expect(resetPreview).toHaveBeenCalledOnce();
  });
});

describe('postWorkerImportMessageWithBudget', () => {
  it('arms the budget before postMessage and marks over-budget synchronous clone time', () => {
    let nowValue = 0;
    const armBudgetTimer = vi.fn();
    const clearBudgetTimer = vi.fn();
    const markBudgetExceeded = vi.fn();
    const postMessage = vi.fn(() => {
      nowValue = IMPORT_PREVIEW_BUDGET_MS + 250;
    });
    const worker = {
      postMessage,
    } as Pick<Worker, 'postMessage'>;

    postWorkerImportMessageWithBudget({
      worker,
      message: {
        schemaVersion: '1.0.0',
        messageId: 'import_preview_active-import',
        correlationId: 'active-import',
        workspaceVersion: 1,
        type: 'import.preview.request',
        payload: {
          sourceKind: 'pasted-table',
          sourceLabel: 'Pasted table',
          textContent: 'Sample\tReading',
        },
      },
      transferList: [],
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      armBudgetTimer,
      clearBudgetTimer,
      markBudgetExceeded,
      now: () => nowValue,
    });

    expect(armBudgetTimer.mock.invocationCallOrder[0]).toBeDefined();
    expect(postMessage.mock.invocationCallOrder[0]).toBeDefined();
    expect(armBudgetTimer.mock.invocationCallOrder[0]!).toBeLessThan(postMessage.mock.invocationCallOrder[0]!);
    expect(clearBudgetTimer).not.toHaveBeenCalled();
    expect(markBudgetExceeded).toHaveBeenCalledOnce();
  });
});

describe('commitConfirmedImportToKernel', () => {
  it('rolls back the kernel mutation when persistence fails', async () => {
    vi.stubGlobal('indexedDB', {});

    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_demo_confirm'),
      ledger: [],
    });
    const initialSnapshot = kernelStore.getState().selectors.persistedWorkspace();
    const initialLedger = structuredClone(kernelStore.getState().ledger);
    const preview: ImportPreviewDataset = {
      previewId: 'preview_confirm',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'repair.csv',
        mimeType: 'text/csv',
        sheetName: null,
        benchmarkScenario: null,
      },
      rowCount: 2,
      isPartialPreview: true,
      columnCount: 2,
      columns: [
        {
          columnId: 'column_sample',
          sourceName: 'Sample',
          sampleValues: ['A-1', 'A-2'],
          inferredType: 'text',
          confidence: 'high',
          nonEmptyCount: 2,
          nullCount: 0,
        },
        {
          columnId: 'column_reading',
          sourceName: 'Reading',
          sampleValues: ['42.5', '44.1'],
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
            { columnId: 'column_sample', value: 'A-1' },
            { columnId: 'column_reading', value: '42.5' },
          ],
        },
        {
          rowId: 'row_2',
          cells: [
            { columnId: 'column_sample', value: 'A-2' },
            { columnId: 'column_reading', value: '44.1' },
          ],
        },
      ],
      assumptions: [],
      uncertainties: [],
      issues: [],
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'mark-empty',
      },
      confirmedDataset: {
        rowCount: 2,
        columnCount: 2,
        fingerprint: 'import:confirmed-dataset-for-rollback',
        columns: [
          {
            columnId: 'column_sample',
            sourceName: 'Sample',
            dataType: 'string',
          },
          {
            columnId: 'column_reading',
            sourceName: 'Reading',
            dataType: 'number',
          },
        ],
        rows: [
          {
            column_sample: 'A-1',
            column_reading: '42.5',
          },
          {
            column_sample: 'A-2',
            column_reading: '44.1',
          },
        ],
      },
      timing: {
        durationMs: 320,
        budgetMs: IMPORT_PREVIEW_BUDGET_MS,
        exceededBudget: false,
      },
    };

    await expect(
      commitConfirmedImportToKernel({
        kernelStore,
        preview,
        confirmationToken: 'confirm_token',
        saveWorkspace: async () => {
          throw new Error('indexeddb write failed');
        },
      }),
    ).rejects.toThrow('indexeddb write failed');

    expect(kernelStore.getState().selectors.persistedWorkspace()).toEqual(initialSnapshot);
    expect(kernelStore.getState().ledger).toEqual(initialLedger);
  });

  it('rolls back only the failed confirmed import when later kernel mutations land before persistence fails', async () => {
    vi.stubGlobal('indexedDB', {});

    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_demo_confirm_concurrent_rollback'),
      ledger: [],
    });
    const preview: ImportPreviewDataset = {
      previewId: 'preview_confirm_concurrent_rollback',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'repair.csv',
        mimeType: 'text/csv',
        sheetName: null,
        benchmarkScenario: null,
      },
      rowCount: 2,
      isPartialPreview: true,
      columnCount: 2,
      columns: [
        {
          columnId: 'column_sample',
          sourceName: 'Sample',
          sampleValues: ['A-1', 'A-2'],
          inferredType: 'text',
          confidence: 'high',
          nonEmptyCount: 2,
          nullCount: 0,
        },
        {
          columnId: 'column_reading',
          sourceName: 'Reading',
          sampleValues: ['42.5', '44.1'],
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
            { columnId: 'column_sample', value: 'A-1' },
            { columnId: 'column_reading', value: '42.5' },
          ],
        },
        {
          rowId: 'row_2',
          cells: [
            { columnId: 'column_sample', value: 'A-2' },
            { columnId: 'column_reading', value: '44.1' },
          ],
        },
      ],
      assumptions: [],
      uncertainties: [],
      issues: [],
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'mark-empty',
      },
      confirmedDataset: {
        rowCount: 2,
        columnCount: 2,
        fingerprint: 'import:confirmed-dataset-for-concurrent-rollback',
        columns: [
          {
            columnId: 'column_sample',
            sourceName: 'Sample',
            dataType: 'string',
          },
          {
            columnId: 'column_reading',
            sourceName: 'Reading',
            dataType: 'number',
          },
        ],
        rows: [
          {
            column_sample: 'A-1',
            column_reading: '42.5',
          },
          {
            column_sample: 'A-2',
            column_reading: '44.1',
          },
        ],
      },
      timing: {
        durationMs: 320,
        budgetMs: IMPORT_PREVIEW_BUDGET_MS,
        exceededBudget: false,
      },
    };

    await expect(
      commitConfirmedImportToKernel({
        kernelStore,
        preview,
        confirmationToken: 'confirm_token_concurrent_rollback',
        saveWorkspace: async (store) => {
          store.getState().commands.updateTelemetrySnapshot(
            {
              status: 'idle',
              offlineQueueDepth: 0,
              lastGraphRenderMs: 321,
            },
            {
              actorId: 'test',
              correlationId: 'telemetry_update_after_confirm',
              occurredAt: '2026-04-23T12:05:00.000Z',
            },
          );
          throw new Error('indexeddb write failed');
        },
      }),
    ).rejects.toThrow('indexeddb write failed');

    expect(
      kernelStore.getState().snapshot.datasets.some((dataset) => dataset.datasetId === 'dataset_import_confirm_token_concurrent_rollback'),
    ).toBe(false);
    expect(kernelStore.getState().snapshot.telemetrySnapshot.lastGraphRenderMs).toBe(321);
    expect(kernelStore.getState().ledger.at(-1)).toEqual(
      expect.objectContaining({
        type: 'import.confirmation-rolled-back',
      }),
    );
  });

  it('keeps the confirmed import in the kernel when persistence succeeds', async () => {
    vi.stubGlobal('indexedDB', {});

    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_demo_confirm_success'),
      ledger: [],
    });
    const preview: ImportPreviewDataset = {
      previewId: 'preview_confirm_success',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'repair.csv',
        mimeType: 'text/csv',
        sheetName: null,
        benchmarkScenario: null,
      },
      rowCount: 2,
      isPartialPreview: false,
      columnCount: 2,
      columns: [
        {
          columnId: 'column_sample',
          sourceName: 'Sample',
          sampleValues: ['A-1', 'A-2'],
          inferredType: 'text',
          confidence: 'high',
          nonEmptyCount: 2,
          nullCount: 0,
        },
        {
          columnId: 'column_reading',
          sourceName: 'Reading',
          sampleValues: ['42.5', '44.1'],
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
            { columnId: 'column_sample', value: 'A-1' },
            { columnId: 'column_reading', value: '42.5' },
          ],
        },
      ],
      assumptions: [],
      uncertainties: [],
      issues: [],
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'mark-empty',
      },
      confirmedDataset: {
        rowCount: 2,
        columnCount: 2,
        fingerprint: 'import:confirmed-dataset',
        columns: [
          {
            columnId: 'column_sample',
            sourceName: 'Sample',
            dataType: 'string',
          },
          {
            columnId: 'column_reading',
            sourceName: 'Reading',
            dataType: 'number',
          },
        ],
        rows: [
          {
            column_sample: 'A-1',
            column_reading: '42.5',
          },
          {
            column_sample: 'A-2',
            column_reading: '44.1',
          },
        ],
      },
      timing: {
        durationMs: 320,
        budgetMs: IMPORT_PREVIEW_BUDGET_MS,
        exceededBudget: false,
      },
    };
    const sourceFileHandle = {
      name: 'repair.csv',
      async getFile() {
        return new File(['Sample,Reading\nA-1,42.5'], 'repair.csv', {
          type: 'text/csv',
        });
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const validatedSourceFileHandle = {
      handle: sourceFileHandle,
      fileName: 'repair.csv',
      fileSize: 24,
      fileLastModified: 1713830400000,
      fileSha256: 'validated-source-digest',
    };

    await expect(
      commitConfirmedImportToKernel({
        kernelStore,
        preview,
        confirmationToken: 'confirm_token_success',
        sourceFileHandle: validatedSourceFileHandle,
        saveWorkspace: async (store, datasetFileHandles, requiredDatasetFileHandleDatasetIds) => {
          expect(requiredDatasetFileHandleDatasetIds).toEqual(['dataset_import_confirm_token_success']);

          if (datasetFileHandles) {
            store.getState().commands.replaceDatasetFileHandles(datasetFileHandles);
          }
        },
      }),
    ).resolves.toBeUndefined();

    expect(kernelStore.getState().snapshot.datasets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          datasetId: 'dataset_import_confirm_token_success',
          rows: [
            {
              column_sample: 'A-1',
              column_reading: '42.5',
            },
            {
              column_sample: 'A-2',
              column_reading: '44.1',
            },
          ],
          sourceFile: {
            fileName: 'repair.csv',
            fileHandleToken: 'dataset.dataset_import_confirm_token_success.source-file',
          },
        }),
      ]),
    );
    expect(kernelStore.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_import_confirm_token_success',
        fileName: 'repair.csv',
        fileHandleToken: 'dataset.dataset_import_confirm_token_success.source-file',
        fileSize: 24,
        fileLastModified: 1713830400000,
        fileSha256: 'validated-source-digest',
        handle: sourceFileHandle,
      }),
    ]);
  });

  it('fails closed when the preview is missing confirmed dataset metadata', async () => {
    vi.stubGlobal('indexedDB', {});

    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_demo_confirm_missing_confirmed_dataset'),
      ledger: [],
    });
    const initialSnapshot = kernelStore.getState().selectors.persistedWorkspace();
    const initialLedger = structuredClone(kernelStore.getState().ledger);
    const preview: ImportPreviewDataset = {
      previewId: 'preview_confirm_missing_confirmed_dataset',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'repair.csv',
        mimeType: 'text/csv',
        sheetName: null,
        benchmarkScenario: null,
      },
      rowCount: 1,
      isPartialPreview: true,
      columnCount: 2,
      columns: [
        {
          columnId: 'column_sample',
          sourceName: 'Sample',
          sampleValues: ['A-1'],
          inferredType: 'text',
          confidence: 'high',
          nonEmptyCount: 1,
          nullCount: 0,
        },
        {
          columnId: 'column_reading',
          sourceName: 'Reading',
          sampleValues: ['42.5'],
          inferredType: 'numeric',
          confidence: 'high',
          nonEmptyCount: 1,
          nullCount: 0,
        },
      ],
      sampleRows: [
        {
          rowId: 'row_1',
          cells: [
            { columnId: 'column_sample', value: 'A-1' },
            { columnId: 'column_reading', value: '42.5' },
          ],
        },
      ],
      assumptions: [],
      uncertainties: [],
      issues: [],
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'mark-empty',
      },
      timing: {
        durationMs: 320,
        budgetMs: IMPORT_PREVIEW_BUDGET_MS,
        exceededBudget: false,
      },
    };

    await expect(
      commitConfirmedImportToKernel({
        kernelStore,
        preview,
        confirmationToken: 'confirm_missing_confirmed_dataset',
      }),
    ).rejects.toThrow('Confirmed import dataset metadata is required before committing the import.');

    expect(kernelStore.getState().selectors.persistedWorkspace()).toEqual(initialSnapshot);
    expect(kernelStore.getState().ledger).toEqual(initialLedger);
  });

  it('rejects confirmation when durable persistence is unavailable', async () => {
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_demo_confirm_requires_persistence'),
      ledger: [],
    });
    const initialSnapshot = kernelStore.getState().selectors.persistedWorkspace();
    const initialLedger = structuredClone(kernelStore.getState().ledger);
    const preview: ImportPreviewDataset = {
      previewId: 'preview_confirm_requires_persistence',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'repair.csv',
        mimeType: 'text/csv',
        sheetName: null,
        benchmarkScenario: null,
      },
      rowCount: 1,
      isPartialPreview: false,
      columnCount: 2,
      columns: [
        {
          columnId: 'column_sample',
          sourceName: 'Sample',
          sampleValues: ['A-1'],
          inferredType: 'text',
          confidence: 'high',
          nonEmptyCount: 1,
          nullCount: 0,
        },
        {
          columnId: 'column_reading',
          sourceName: 'Reading',
          sampleValues: ['42.5'],
          inferredType: 'numeric',
          confidence: 'high',
          nonEmptyCount: 1,
          nullCount: 0,
        },
      ],
      sampleRows: [
        {
          rowId: 'row_1',
          cells: [
            { columnId: 'column_sample', value: 'A-1' },
            { columnId: 'column_reading', value: '42.5' },
          ],
        },
      ],
      assumptions: [],
      uncertainties: [],
      issues: [],
      repairSelections: {
        delimiter: null,
        headerSelection: 'first-row-header',
        columnTypeOverrides: {},
        missingValuePolicy: 'mark-empty',
      },
      confirmedDataset: {
        rowCount: 1,
        columnCount: 2,
        fingerprint: 'import:confirmed-dataset',
        columns: [
          {
            columnId: 'column_sample',
            sourceName: 'Sample',
            dataType: 'string',
          },
          {
            columnId: 'column_reading',
            sourceName: 'Reading',
            dataType: 'number',
          },
        ],
        rows: [
          {
            column_sample: 'A-1',
            column_reading: '42.5',
          },
        ],
      },
      timing: {
        durationMs: 320,
        budgetMs: IMPORT_PREVIEW_BUDGET_MS,
        exceededBudget: false,
      },
    };

    await expect(
      commitConfirmedImportToKernel({
        kernelStore,
        preview,
        confirmationToken: 'confirm_requires_persistence',
        persistenceAvailable: false,
      }),
    ).rejects.toThrow('Confirmed imports require persistent browser storage.');

    expect(kernelStore.getState().selectors.persistedWorkspace()).toEqual(initialSnapshot);
    expect(kernelStore.getState().ledger).toEqual(initialLedger);
  });
});
