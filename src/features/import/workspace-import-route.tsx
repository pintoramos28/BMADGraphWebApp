import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import {
  importPreviewFailureMessageSchema,
  importPreviewProgressMessageSchema,
  importPreviewSuccessMessageSchema,
} from '../../schemas/worker';
import {
  IMPORT_PREVIEW_BUDGET_MS,
  dispatchImportBenchmarkTimingEvent,
  type ImportBenchmarkTimingEvent,
} from './benchmark-timing';
import { getOwnedImportBenchmarkFixture } from './owned-import-benchmarks';
import { createImportPreviewStore, type ImportPreviewError } from './store';
import type { ImportBenchmarkScenario, ImportPreviewDataset, ImportSourceKind } from './preview-model';

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `import_${Date.now()}`;
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function createImportActivityTracker(now: () => number = () => performance.now()) {
  let disposed = false;
  const benchmarkStartedAtByCorrelation = new Map<string, number>();

  return {
    dispose() {
      disposed = true;
      benchmarkStartedAtByCorrelation.clear();
    },
    clearBenchmark(correlationId?: string) {
      if (correlationId === undefined) {
        benchmarkStartedAtByCorrelation.clear();
        return;
      }

      benchmarkStartedAtByCorrelation.delete(correlationId);
    },
    isActive(activeCorrelationId: string | null, correlationId: string) {
      return !disposed && activeCorrelationId === correlationId;
    },
    markBenchmarkStart(correlationId: string, startedAt: number = now()) {
      if (disposed) {
        return;
      }

      benchmarkStartedAtByCorrelation.set(correlationId, startedAt);
    },
    resolveBenchmarkDuration(correlationId: string, previewDurationMs: number, finishedAt: number = now()) {
      if (disposed) {
        return previewDurationMs;
      }

      const benchmarkStartedAt = benchmarkStartedAtByCorrelation.get(correlationId);
      benchmarkStartedAtByCorrelation.delete(correlationId);

      if (benchmarkStartedAt === undefined) {
        return previewDurationMs;
      }

      return Math.max(previewDurationMs, Math.round(finishedAt - benchmarkStartedAt));
    },
  };
}

const sectionCardStyle = {
  padding: '1rem 1.1rem',
  borderRadius: '1rem',
  background: '#f9f6f1',
  border: '1px solid rgba(31, 42, 54, 0.1)',
} as const;

const hiddenFileInputStyle = {
  position: 'fixed',
  left: '-9999px',
  top: 0,
  width: '1px',
  height: '1px',
  opacity: 0,
  pointerEvents: 'none',
} as const;

type WorkerImportPayload = {
  sourceLabel: string;
  fileName?: string;
  mimeType?: string | null;
  benchmarkScenario?: ImportBenchmarkScenario | null;
  textContent?: string | null;
  binaryContent?: ArrayBuffer | null;
};

const CLEAN_EXCEL_BENCHMARK_SHA256 = '9a3c80dcce51ee6739bc4271b02b722ef5d6e6cdf2057e2251fc820d77b3f8e5';

async function sha256Hex(binaryContent: ArrayBuffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }

  let digest: ArrayBuffer;

  try {
    digest = await crypto.subtle.digest('SHA-256', binaryContent);
  } catch {
    return null;
  }

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function detectOwnedImportBenchmarkScenario({
  sourceKind,
  binaryContent,
}: {
  sourceKind: ImportSourceKind;
  fileName?: string | undefined;
  textContent?: string | null | undefined;
  binaryContent?: ArrayBuffer | null | undefined;
}): Promise<ImportBenchmarkScenario | null> {
  if (sourceKind === 'excel-file' && binaryContent) {
    const digest = await sha256Hex(binaryContent);

    return digest === CLEAN_EXCEL_BENCHMARK_SHA256 ? 'import.clean.excel-preview' : null;
  }

  return null;
}

export function failImportIfActive({
  correlationId,
  importError,
  isActive,
  clearBenchmark,
  clearBudgetTimer,
  disposeWorker,
  failImport,
}: {
  correlationId: string;
  importError: ImportPreviewError;
  isActive: (correlationId: string) => boolean;
  clearBenchmark: (correlationId: string) => void;
  clearBudgetTimer: (correlationId: string) => void;
  disposeWorker: () => void;
  failImport: (error: ImportPreviewError, correlationId: string) => void;
}) {
  if (!isActive(correlationId)) {
    return false;
  }

  clearBenchmark(correlationId);
  clearBudgetTimer(correlationId);
  disposeWorker();
  failImport(importError, correlationId);

  return true;
}

export function failImportFromWorkerCallbackIfCurrent<TWorker>({
  worker,
  activeWorker,
  correlationId,
  detail,
  isActiveImport,
  disposeWorker,
  failImport,
}: {
  worker: TWorker;
  activeWorker: TWorker | null;
  correlationId: string;
  detail: string;
  isActiveImport: (correlationId: string) => boolean;
  disposeWorker?: (worker: TWorker) => void;
  failImport: (correlationId: string, detail: string) => void;
}) {
  if (worker !== activeWorker || !isActiveImport(correlationId)) {
    return false;
  }

  disposeWorker?.(worker);
  failImport(correlationId, detail);

  return true;
}

export function bindWorkerImportFailureCallbacks<TWorker extends Pick<Worker, 'onerror' | 'onmessageerror'>>({
  worker,
  getActiveWorker,
  correlationId,
  isActiveImport,
  disposeWorker,
  failImport,
}: {
  worker: TWorker;
  getActiveWorker: () => TWorker | null;
  correlationId: string;
  isActiveImport: (correlationId: string) => boolean;
  disposeWorker?: (worker: TWorker) => void;
  failImport: (correlationId: string, detail: string) => void;
}) {
  worker.onerror = (event) => {
    failImportFromWorkerCallbackIfCurrent({
      worker,
      activeWorker: getActiveWorker(),
      correlationId,
      detail: event.message || 'The import worker could not finish preparing the preview.',
      isActiveImport,
      ...(disposeWorker ? { disposeWorker } : {}),
      failImport,
    });
    event.preventDefault();
  };
  worker.onmessageerror = () => {
    failImportFromWorkerCallbackIfCurrent({
      worker,
      activeWorker: getActiveWorker(),
      correlationId,
      detail: 'The import worker returned an unreadable preview message.',
      isActiveImport,
      ...(disposeWorker ? { disposeWorker } : {}),
      failImport,
    });
  };

  return worker;
}

export function initializeImportWorker<
  TWorker extends Pick<Worker, 'onmessage' | 'onerror' | 'onmessageerror'>
>({
  createWorker,
  onMessage,
  getActiveWorker,
  correlationId,
  isActiveImport,
  disposeWorker,
  failImport,
}: {
  createWorker: () => TWorker;
  onMessage: TWorker['onmessage'];
  getActiveWorker: () => TWorker | null;
  correlationId: string;
  isActiveImport: (correlationId: string) => boolean;
  disposeWorker?: (worker: TWorker) => void;
  failImport: (correlationId: string, detail: string) => void;
}): TWorker | null {
  let failedDuringInitialization = false;
  const worker = createWorker();
  worker.onmessage = onMessage;

  bindWorkerImportFailureCallbacks({
    worker,
    getActiveWorker: () => getActiveWorker() ?? worker,
    correlationId,
    isActiveImport,
    ...(disposeWorker ? { disposeWorker } : {}),
    failImport: (activeCorrelationId, detail) => {
      failedDuringInitialization = true;
      failImport(activeCorrelationId, detail);
    },
  });

  return failedDuringInitialization ? null : worker;
}

export function ensureImportRouteWorker<TWorker>({
  currentWorker,
  initializeWorker,
  storeWorker,
}: {
  currentWorker: TWorker | null;
  initializeWorker: () => TWorker | null;
  storeWorker: (worker: TWorker) => void;
}) {
  if (currentWorker) {
    return currentWorker;
  }

  const worker = initializeWorker();

  if (worker) {
    storeWorker(worker);
  }

  return worker;
}

export function postWorkerImportFromRoute({
  correlationId,
  sourceKind,
  payload,
  ensureWorker,
  budgetMs,
  armBudgetTimer,
  clearBudgetTimer,
  markBudgetExceeded,
}: {
  correlationId: string;
  sourceKind: ImportSourceKind;
  payload: WorkerImportPayload;
  ensureWorker: (correlationId: string) => Pick<Worker, 'postMessage'> | null;
  budgetMs: number;
  armBudgetTimer: () => void;
  clearBudgetTimer: () => void;
  markBudgetExceeded: () => void;
}) {
  const worker = ensureWorker(correlationId);

  if (!worker) {
    return false;
  }

  const transferList = payload.binaryContent ? [payload.binaryContent] : [];

  postWorkerImportMessageWithBudget({
    worker,
    message: {
      schemaVersion: '1.0.0',
      messageId: `import_preview_${correlationId}`,
      correlationId,
      workspaceVersion: 1,
      type: 'import.preview.request',
      payload: {
        sourceKind,
        ...payload,
      },
    },
    transferList,
    budgetMs,
    armBudgetTimer,
    clearBudgetTimer,
    markBudgetExceeded,
  });

  return true;
}

export function postWorkerImportMessageWithBudget({
  worker,
  message,
  transferList,
  budgetMs,
  armBudgetTimer,
  clearBudgetTimer,
  markBudgetExceeded,
  now = () => performance.now(),
}: {
  worker: Pick<Worker, 'postMessage'>;
  message: {
    schemaVersion: string;
    messageId: string;
    correlationId: string;
    workspaceVersion: number;
    type: 'import.preview.request';
    payload: {
      sourceKind: ImportSourceKind;
    } & WorkerImportPayload;
  };
  transferList: Transferable[];
  budgetMs: number;
  armBudgetTimer: () => void;
  clearBudgetTimer: () => void;
  markBudgetExceeded: () => void;
  now?: () => number;
}) {
  const startedAt = now();
  armBudgetTimer();

  try {
    worker.postMessage(message, transferList);
  } catch (caughtError) {
    clearBudgetTimer();
    throw caughtError;
  }

  if (now() - startedAt >= budgetMs) {
    markBudgetExceeded();
  }
}

export function applyResolvedImportPreviewTiming(preview: ImportPreviewDataset, resolvedDurationMs: number): ImportPreviewDataset {
  return {
    ...preview,
    timing: {
      ...preview.timing,
      durationMs: resolvedDurationMs,
      exceededBudget: preview.timing.exceededBudget || resolvedDurationMs > preview.timing.budgetMs,
    },
  };
}

export function resolveDisplayedBenchmarkScenario(
  preview: ImportPreviewDataset | null,
  timingEvent: ImportBenchmarkTimingEvent | null,
): ImportBenchmarkScenario | null {
  return timingEvent?.scenario ?? preview?.source.benchmarkScenario ?? null;
}

export function toImportPreparationError(
  phase: 'selection' | 'read' | 'benchmark-detection',
  error: unknown,
): ImportPreviewError {
  const detail =
    error instanceof Error
      ? error.message
      : phase === 'selection'
        ? 'The selected file could not be opened.'
        : phase === 'read'
          ? 'The selected file could not be read from local storage.'
          : 'The owned benchmark classification could not be completed.';

  if (phase === 'selection') {
    return {
      code: 'import.preview.selection-failed',
      title: 'File selection could not start',
      detail,
      retryable: true,
    };
  }

  if (phase === 'read') {
    return {
      code: 'import.preview.read-failed',
      title: 'Selected file could not be read',
      detail,
      retryable: true,
    };
  }

  return {
    code: 'import.preview.benchmark-detection-failed',
    title: 'Benchmark verification could not finish',
    detail,
    retryable: true,
  };
}

export function clearActiveImportPreview({
  clearPasteValidationError,
  clearBenchmark,
  clearBudgetTimer,
  disposeWorker,
  resetPreview,
}: {
  clearPasteValidationError: () => void;
  clearBenchmark: () => void;
  clearBudgetTimer: () => void;
  disposeWorker: () => void;
  resetPreview: () => void;
}) {
  clearPasteValidationError();
  clearBenchmark();
  clearBudgetTimer();
  disposeWorker();
  resetPreview();
}

export function readFileWithFileReader<TResult>(
  file: Blob,
  read: (reader: FileReader, file: Blob) => void,
): Promise<TResult> {
  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('Browser file reads are unavailable in this environment.'));
  }

  return new Promise<TResult>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error('The selected file could not be read by the browser.'));
    };
    reader.onabort = () => {
      reject(new Error('The selected file read was canceled before it finished.'));
    };
    reader.onload = () => {
      resolve(reader.result as TResult);
    };

    read(reader, file);
  });
}

export async function readFileText(file: File) {
  if (typeof FileReader !== 'undefined') {
    return readFileWithFileReader<string>(file, (reader, currentFile) => {
      reader.readAsText(currentFile);
    });
  }

  return file.text();
}

export async function readFileArrayBuffer(file: File) {
  if (typeof FileReader !== 'undefined') {
    return readFileWithFileReader<ArrayBuffer>(file, (reader, currentFile) => {
      reader.readAsArrayBuffer(currentFile);
    });
  }

  return file.arrayBuffer();
}

export function describePartialPreviewNotice(preview: Pick<ImportPreviewDataset, 'rowCount' | 'source'>) {
  return preview.source.sourceKind === 'excel-file'
    ? `This workbook preview is showing the first ${preview.rowCount} rows from the first sheet only. Inference summaries below reflect that workbook sample, not the full workbook.`
    : `This delimited import is showing the first ${preview.rowCount} rows only. Row counts and inference summaries below reflect that preview sample, not the full dataset.`;
}

export async function awaitImportBudgetThreshold<T>({
  budgetMs,
  operation,
  isActive,
  onBudgetExceeded,
  schedule,
  clearScheduled,
  now = () => performance.now(),
}: {
  budgetMs: number;
  operation: () => Promise<T> | T;
  isActive: () => boolean;
  onBudgetExceeded: () => void;
  schedule: typeof globalThis.setTimeout;
  clearScheduled: typeof globalThis.clearTimeout;
  now?: () => number;
}) {
  const startedAt = now();
  let budgetTriggered = false;
  let resolveBudget: ((value: { kind: 'budget' }) => void) | null = null;
  const budgetSignal = new Promise<{ kind: 'budget' }>((resolve) => {
    resolveBudget = resolve;
  });

  const markBudgetExceeded = () => {
    if (budgetTriggered) {
      return;
    }

    budgetTriggered = true;

    if (isActive()) {
      onBudgetExceeded();
    }

    resolveBudget?.({ kind: 'budget' });
  };
  const budgetTimer = schedule(markBudgetExceeded, budgetMs);
  const waitForBudgetPaint = () => new Promise((resolve) => schedule(resolve, 0));
  const finalizeBudgetState = async () => {
    if (!budgetTriggered && now() - startedAt >= budgetMs) {
      markBudgetExceeded();
    }

    if (budgetTriggered) {
      // Yield one paint so the visible in-progress state can render before the next import phase continues.
      await waitForBudgetPaint();
    }
  };

  let operationResult: Promise<T>;

  try {
    operationResult = Promise.resolve(operation());
  } catch (caughtError) {
    clearScheduled(budgetTimer);
    await finalizeBudgetState();
    throw caughtError;
  }

  const budgetOutcome = await Promise.race([
    operationResult.then(
      (value) => ({ kind: 'resolved' as const, value }),
      (error) => ({ kind: 'rejected' as const, error }),
    ),
    budgetSignal,
  ])
    .finally(() => {
      clearScheduled(budgetTimer);
    });

  if (budgetOutcome.kind === 'resolved') {
    await finalizeBudgetState();
    return budgetOutcome.value;
  }

  if (budgetOutcome.kind === 'rejected') {
    await finalizeBudgetState();
    throw budgetOutcome.error;
  }

  // Yield one paint so the visible in-progress state can render before the slow read finishes.
  await waitForBudgetPaint();

  return operationResult;
}

export async function runImportBudgetedRead<T>({
  budgetMs,
  readOperation,
  isActive,
  onBudgetExceeded,
  schedule,
  clearScheduled,
  now = () => performance.now(),
}: {
  budgetMs: number;
  readOperation: () => Promise<T>;
  isActive: () => boolean;
  onBudgetExceeded: () => void;
  schedule: typeof globalThis.setTimeout;
  clearScheduled: typeof globalThis.clearTimeout;
  now?: () => number;
}) {
  return awaitImportBudgetThreshold({
    budgetMs,
    operation: readOperation,
    isActive,
    onBudgetExceeded,
    schedule,
    clearScheduled,
    now,
  });
}

export function WorkspaceImportRoute({ workspaceId }: { workspaceId?: string | undefined }) {
  const storeRef = useRef(createImportPreviewStore());
  const activityTrackerRef = useRef(createImportActivityTracker());
  const workerRef = useRef<Worker | null>(null);
  const budgetTimerRef = useRef<number | null>(null);
  const budgetTimerCorrelationRef = useRef<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteValidationError, setPasteValidationError] = useState<string | null>(null);

  const status = useStore(storeRef.current, (state) => state.status);
  const preview = useStore(storeRef.current, (state) => state.preview);
  const progress = useStore(storeRef.current, (state) => state.progress);
  const error = useStore(storeRef.current, (state) => state.error);
  const budgetExceeded = useStore(storeRef.current, (state) => state.budgetExceeded);
  const timingEvent = useStore(storeRef.current, (state) => state.lastTimingEvent);
  const displayedBenchmarkScenario = resolveDisplayedBenchmarkScenario(preview, timingEvent);

  useEffect(() => {
    activityTrackerRef.current = createImportActivityTracker();

    return () => {
      activityTrackerRef.current.dispose();

      if (budgetTimerRef.current !== null) {
        window.clearTimeout(budgetTimerRef.current);
      }

      budgetTimerCorrelationRef.current = null;
      disposeWorker();
      storeRef.current.getState().commands.reset();
    };
  }, []);

  function disposeWorker() {
    if (!workerRef.current) {
      return;
    }

    workerRef.current.onmessage = null;
    workerRef.current.onerror = null;
    workerRef.current.onmessageerror = null;
    workerRef.current.terminate();
    workerRef.current = null;
  }

  function clearBudgetTimer(correlationId?: string) {
    if (budgetTimerRef.current !== null) {
      if (correlationId !== undefined && budgetTimerCorrelationRef.current !== correlationId) {
        return;
      }

      window.clearTimeout(budgetTimerRef.current);
      budgetTimerRef.current = null;
      budgetTimerCorrelationRef.current = null;
    }
  }

  function ensureBudgetTimer(correlationId: string) {
    if (budgetTimerRef.current !== null && budgetTimerCorrelationRef.current === correlationId) {
      return;
    }

    clearBudgetTimer();
    budgetTimerCorrelationRef.current = correlationId;
    budgetTimerRef.current = window.setTimeout(() => {
      if (!isActiveWorkerMessage(correlationId)) {
        return;
      }

      storeRef.current.getState().commands.markBudgetExceeded();
    }, IMPORT_PREVIEW_BUDGET_MS);
  }

  async function readLocalFileWithBudget<T>(correlationId: string, readOperation: () => Promise<T>) {
    return runImportBudgetedRead({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      readOperation,
      isActive: () => isActiveWorkerMessage(correlationId),
      onBudgetExceeded: () => {
        storeRef.current.getState().commands.markBudgetExceeded();
      },
      schedule: window.setTimeout.bind(window),
      clearScheduled: window.clearTimeout.bind(window),
    });
  }

  async function resolveBenchmarkScenarioWithBudget(
    correlationId: string,
    detectionInput: Parameters<typeof detectOwnedImportBenchmarkScenario>[0],
  ) {
    return awaitImportBudgetThreshold({
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      operation: () => detectOwnedImportBenchmarkScenario(detectionInput),
      isActive: () => isActiveWorkerMessage(correlationId),
      onBudgetExceeded: () => {
        storeRef.current.getState().commands.markBudgetExceeded();
      },
      schedule: window.setTimeout.bind(window),
      clearScheduled: window.clearTimeout.bind(window),
    });
  }

  function isActiveWorkerMessage(correlationId: string) {
    return activityTrackerRef.current.isActive(storeRef.current.getState().activeCorrelationId, correlationId);
  }

  function failImportFromWorker(correlationId: string, detail: string) {
    failImportIfActive({
      correlationId,
      importError: {
        code: 'import.preview.worker-failed',
        title: 'Preview could not be prepared',
        detail,
        retryable: true,
      },
      isActive: isActiveWorkerMessage,
      clearBenchmark: (activeCorrelationId) => {
        activityTrackerRef.current.clearBenchmark(activeCorrelationId);
      },
      clearBudgetTimer: (activeCorrelationId) => {
        clearBudgetTimer(activeCorrelationId);
      },
      disposeWorker,
      failImport: (importError, activeCorrelationId) => {
        storeRef.current.getState().commands.failImport(importError, activeCorrelationId);
      },
    });
  }

  function failImportFromRoute(correlationId: string, importError: ImportPreviewError) {
    failImportIfActive({
      correlationId,
      importError,
      isActive: isActiveWorkerMessage,
      clearBenchmark: (activeCorrelationId) => {
        activityTrackerRef.current.clearBenchmark(activeCorrelationId);
      },
      clearBudgetTimer: (activeCorrelationId) => {
        clearBudgetTimer(activeCorrelationId);
      },
      disposeWorker,
      failImport: (errorToApply, activeCorrelationId) => {
        storeRef.current.getState().commands.failImport(errorToApply, activeCorrelationId);
      },
    });
  }

  function ensureWorker(correlationId: string): Worker | null {
    return ensureImportRouteWorker({
      currentWorker: workerRef.current,
      initializeWorker: () =>
        initializeImportWorker({
        createWorker: () =>
          new Worker(new URL('../../workers/import.worker.ts', import.meta.url), {
            type: 'module',
          }),
        onMessage: (event: MessageEvent) => {
          const progressMessage = importPreviewProgressMessageSchema.safeParse(event.data);

          if (progressMessage.success) {
            if (!isActiveWorkerMessage(progressMessage.data.correlationId)) {
              return;
            }

            storeRef.current.getState().commands.updateProgress(progressMessage.data.payload, progressMessage.data.correlationId);
            return;
          }

          const successMessage = importPreviewSuccessMessageSchema.safeParse(event.data);

          if (successMessage.success) {
            if (!isActiveWorkerMessage(successMessage.data.correlationId)) {
              return;
            }

            clearBudgetTimer(successMessage.data.correlationId);
            const benchmarkDurationMs = activityTrackerRef.current.resolveBenchmarkDuration(
              successMessage.data.correlationId,
              successMessage.data.payload.preview.timing.durationMs,
            );
            const resolvedPreview = applyResolvedImportPreviewTiming(
              successMessage.data.payload.preview,
              benchmarkDurationMs,
            );
            const benchmarkEvent = dispatchImportBenchmarkTimingEvent(resolvedPreview);
            storeRef.current
              .getState()
              .commands.resolveImport(resolvedPreview, benchmarkEvent, successMessage.data.correlationId);
            return;
          }

          const failureMessage = importPreviewFailureMessageSchema.safeParse(event.data);

          if (failureMessage.success) {
            if (!isActiveWorkerMessage(failureMessage.data.correlationId)) {
              return;
            }

            activityTrackerRef.current.clearBenchmark(failureMessage.data.correlationId);
            clearBudgetTimer(failureMessage.data.correlationId);
            disposeWorker();
            storeRef.current.getState().commands.failImport(failureMessage.data.payload, failureMessage.data.correlationId);
          }
        },
        getActiveWorker: () => workerRef.current,
        correlationId,
        isActiveImport: isActiveWorkerMessage,
        disposeWorker: (worker) => {
          if (workerRef.current === worker) {
            disposeWorker();
            return;
          }

          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          worker.terminate();
        },
        failImport: failImportFromWorker,
      }),
      storeWorker: (worker) => {
        workerRef.current = worker;
      },
    });
  }

  function beginImport(sourceKind: ImportSourceKind) {
    clearBudgetTimer();
    disposeWorker();
    activityTrackerRef.current.clearBenchmark();
    const correlationId = createCorrelationId();
    storeRef.current.getState().commands.beginImport(correlationId, sourceKind);

    return correlationId;
  }

  function postWorkerImport(
    correlationId: string,
    sourceKind: ImportSourceKind,
    payload: WorkerImportPayload,
  ) {
    postWorkerImportFromRoute({
      correlationId,
      sourceKind,
      payload,
      ensureWorker,
      budgetMs: IMPORT_PREVIEW_BUDGET_MS,
      armBudgetTimer: () => {
        ensureBudgetTimer(correlationId);
      },
      clearBudgetTimer: () => {
        clearBudgetTimer(correlationId);
      },
      markBudgetExceeded: () => {
        if (!isActiveWorkerMessage(correlationId)) {
          return;
        }

        storeRef.current.getState().commands.markBudgetExceeded();
      },
    });
  }

  async function handleFileImport(sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>, file: File | null) {
    if (!file) {
      return;
    }

    setPasteValidationError(null);
    const correlationId = beginImport(sourceKind);
    storeRef.current.getState().commands.updateProgress(
      {
        phase: 'loading',
        message: `Selected ${file.name}. Reading it from the browser.`,
      },
      correlationId,
    );

    if (!isActiveWorkerMessage(correlationId)) {
      return;
    }

    activityTrackerRef.current.markBenchmarkStart(correlationId);
    storeRef.current.getState().commands.updateProgress(
      {
        phase: 'loading',
        message: `Browser accepted ${file.name}. Opening the local file reader.`,
      },
      correlationId,
    );
    let payload: WorkerImportPayload;

    if (sourceKind === 'excel-file') {
      let binaryContent: ArrayBuffer;

      try {
        binaryContent = await readLocalFileWithBudget(correlationId, () => readFileArrayBuffer(file));
      } catch (caughtError) {
        failImportFromRoute(correlationId, toImportPreparationError('read', caughtError));
        return;
      }

      storeRef.current.getState().commands.updateProgress(
        {
          phase: 'loading',
          message: `Read ${file.name}. Verifying workbook metadata.`,
        },
        correlationId,
      );

      if (!isActiveWorkerMessage(correlationId)) {
        return;
      }

      let benchmarkScenario: ImportBenchmarkScenario | null;

      try {
        benchmarkScenario = await resolveBenchmarkScenarioWithBudget(correlationId, {
          sourceKind,
          binaryContent,
        });
      } catch (caughtError) {
        failImportFromRoute(correlationId, toImportPreparationError('benchmark-detection', caughtError));
        return;
      }

      if (!isActiveWorkerMessage(correlationId)) {
        return;
      }

      payload = {
        sourceLabel: 'Local Excel workbook',
        fileName: file.name,
        mimeType: file.type || null,
        benchmarkScenario,
        binaryContent,
      };
    } else {
      let textContent: string;

      try {
        textContent = await readLocalFileWithBudget(correlationId, () => readFileText(file));
      } catch (caughtError) {
        failImportFromRoute(correlationId, toImportPreparationError('read', caughtError));
        return;
      }

      storeRef.current.getState().commands.updateProgress(
        {
          phase: 'loading',
          message: `Read ${file.name}. Preparing the preview worker payload.`,
        },
        correlationId,
      );

      if (!isActiveWorkerMessage(correlationId)) {
        return;
      }

      let benchmarkScenario: ImportBenchmarkScenario | null;

      try {
        benchmarkScenario = await resolveBenchmarkScenarioWithBudget(correlationId, {
          sourceKind,
          textContent,
        });
      } catch (caughtError) {
        failImportFromRoute(correlationId, toImportPreparationError('benchmark-detection', caughtError));
        return;
      }

      if (!isActiveWorkerMessage(correlationId)) {
        return;
      }

      payload = {
        sourceLabel: 'Local CSV file',
        fileName: file.name,
        mimeType: file.type || null,
        benchmarkScenario,
        textContent,
      };
    }

    try {
      storeRef.current.getState().commands.updateProgress(
        {
          phase: 'loading',
          message: `Starting the import worker for ${file.name}.`,
        },
        correlationId,
      );
      postWorkerImport(correlationId, sourceKind, payload);
    } catch (caughtError) {
      failImportFromWorker(
        correlationId,
        caughtError instanceof Error ? caughtError.message : 'The import worker could not start for the selected source.',
      );
    }
  }

  async function handlePasteImport() {
    if (pasteText.trim().length === 0) {
      setPasteValidationError('Paste some tabular data first');
      return;
    }

    setPasteValidationError(null);
    const correlationId = beginImport('pasted-table');
    activityTrackerRef.current.markBenchmarkStart(correlationId);

    let benchmarkScenario: ImportBenchmarkScenario | null;

    try {
      benchmarkScenario = await resolveBenchmarkScenarioWithBudget(correlationId, {
        sourceKind: 'pasted-table',
        textContent: pasteText,
      });
    } catch (caughtError) {
      failImportFromRoute(correlationId, toImportPreparationError('benchmark-detection', caughtError));
      return;
    }

    if (!isActiveWorkerMessage(correlationId)) {
      return;
    }

    try {
      postWorkerImport(correlationId, 'pasted-table', {
        sourceLabel: 'Pasted table',
        mimeType: 'text/plain',
        benchmarkScenario,
        textContent: pasteText,
      });
    } catch (caughtError) {
      failImportFromWorker(
        correlationId,
        caughtError instanceof Error ? caughtError.message : 'The import worker could not start for the pasted table.',
      );
    }
  }

  function handleOwnedBenchmarkImport(sourceKind: Extract<ImportSourceKind, 'csv-file' | 'pasted-table'>) {
    setPasteValidationError(null);
    const fixture = getOwnedImportBenchmarkFixture(sourceKind);
    const correlationId = beginImport(sourceKind);
    activityTrackerRef.current.markBenchmarkStart(correlationId);

    if (sourceKind === 'pasted-table') {
      setPasteText(fixture.textContent);
    }

    try {
      postWorkerImport(correlationId, sourceKind, {
        sourceLabel: fixture.sourceLabel,
        mimeType: fixture.mimeType,
        benchmarkScenario: fixture.benchmarkScenario,
        textContent: fixture.textContent,
        ...(fixture.fileName ? { fileName: fixture.fileName } : {}),
      });
    } catch (caughtError) {
      failImportFromWorker(
        correlationId,
        caughtError instanceof Error ? caughtError.message : 'The BMAD benchmark preview could not start.',
      );
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
        tabIndex={-1}
        style={hiddenFileInputStyle}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0] ?? null;
          await handleFileImport('csv-file', file);
          input.value = '';
        }}
      />
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        tabIndex={-1}
        style={hiddenFileInputStyle}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0] ?? null;
          await handleFileImport('excel-file', file);
          input.value = '';
        }}
      />

      <header style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Import preview workspace</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Start with CSV, Excel, or pasted rows. BMADGraphWebApp prepares a preview-only workspace first so the
          committed workspace stays untouched until later stories add confirmation.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#6f5b45' }}>
          Active route workspace: <strong>{workspaceId ?? 'workspace index'}</strong>
        </p>
      </header>

      <section
        aria-label="Import entrypoints"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
          gap: '1rem',
        }}
      >
        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>CSV file</h3>
          <p style={{ lineHeight: 1.6 }}>
            Choose a local comma-, semicolon-, tab-, or pipe-delimited file through the persistence boundary.
          </p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setPasteValidationError(null);
                csvInputRef.current?.click();
              }}
            >
              Choose CSV file
            </button>
            <button type="button" onClick={() => handleOwnedBenchmarkImport('csv-file')}>
              {getOwnedImportBenchmarkFixture('csv-file').actionLabel}
            </button>
          </div>
        </article>

        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Excel workbook</h3>
          <p style={{ lineHeight: 1.6 }}>Open a local `.xlsx` or `.xls` workbook and preview the first sheet only.</p>
          <button
            type="button"
            onClick={() => {
              setPasteValidationError(null);
              excelInputRef.current?.click();
            }}
          >
            Choose Excel file
          </button>
        </article>

        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Pasted table</h3>
          <label htmlFor="pasted-table-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Paste tabular data
          </label>
          <textarea
            id="pasted-table-input"
            value={pasteText}
            onChange={(event) => {
              setPasteText(event.currentTarget.value);
              setPasteValidationError(null);
            }}
            rows={6}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder={'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18'}
          />
          {pasteValidationError ? (
            <p role="alert" style={{ margin: '0.5rem 0 0', color: '#8a2d1b', lineHeight: 1.5 }}>
              {pasteValidationError}
            </p>
          ) : null}
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            <button type="button" onClick={() => void handlePasteImport()}>
              Preview pasted table
            </button>
            <button type="button" onClick={() => handleOwnedBenchmarkImport('pasted-table')}>
              {getOwnedImportBenchmarkFixture('pasted-table').actionLabel}
            </button>
          </div>
        </article>
      </section>

      <section aria-live="polite" style={sectionCardStyle}>
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Preview status</strong>
        {status === 'idle' ? (
          <span>Pick a source to start a preview-only import.</span>
        ) : null}
        {status === 'parsing' ? (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span>{progress?.message ?? 'Preparing the local preview workspace.'}</span>
            <span>
              {budgetExceeded
                ? `This preview crossed the ${IMPORT_PREVIEW_BUDGET_MS / 1000}s target, so the in-progress state stays visible until parsing finishes.`
                : 'The preview is running in a worker so the shell stays responsive.'}
            </span>
          </div>
        ) : null}
        {status === 'error' && error ? (
          <div role="alert" style={{ display: 'grid', gap: '0.35rem' }}>
            <span>{error.title}</span>
            <span>{error.detail}</span>
          </div>
        ) : null}
        {status === 'ready' && preview ? (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Preview ready. The committed workspace is still unchanged.</span>
            <span>
              {preview.isPartialPreview
                ? `Showing the first ${preview.rowCount} preview rows and ${preview.columnCount} columns, prepared in ${formatDuration(preview.timing.durationMs)}.`
                : `${preview.rowCount} rows, ${preview.columnCount} columns, prepared in ${formatDuration(preview.timing.durationMs)}.`}
            </span>
          </div>
        ) : null}
      </section>

      {preview ? (
        <>
          <section
            style={{
              ...sectionCardStyle,
              background: 'rgba(227, 177, 104, 0.16)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Not yet committed</strong>
            <span>
              This preview lives outside the canonical workspace snapshot. Commit, repair, and semantic confirmation are
              intentionally deferred to later stories.
            </span>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
              gap: '0.75rem',
            }}
          >
            <article style={sectionCardStyle}>
              <strong>Source</strong>
              <div>{preview.source.fileName ?? preview.source.sourceLabel}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Preview rows</strong>
              <div>{preview.rowCount}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Columns</strong>
              <div>{preview.columnCount}</div>
            </article>
            <article style={sectionCardStyle}>
              <strong>Benchmark hook</strong>
              <div>{displayedBenchmarkScenario ?? 'Not a clean benchmark fixture'}</div>
            </article>
          </section>

          {preview.isPartialPreview ? (
            <section
              style={{
                ...sectionCardStyle,
                background: 'rgba(31, 42, 54, 0.05)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Partial preview</strong>
              <span>{describePartialPreviewNotice(preview)}</span>
            </section>
          ) : null}

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Assumptions</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
                gap: '0.75rem',
              }}
            >
              {preview.assumptions.map((assumption) => (
                <article key={assumption.assumptionId} style={sectionCardStyle}>
                  <strong>{assumption.label}</strong>
                  <div style={{ marginTop: '0.35rem' }}>{assumption.value}</div>
                  <div style={{ marginTop: '0.35rem', color: '#6f5b45' }}>Confidence: {assumption.confidence}</div>
                  {assumption.details ? <div style={{ marginTop: '0.35rem' }}>{assumption.details}</div> : null}
                </article>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Uncertainty</h3>
            {preview.uncertainties.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                {preview.uncertainties.map((uncertainty) => (
                  <li key={uncertainty.uncertaintyId}>
                    {uncertainty.message}
                    {uncertainty.columnId ? ` (${uncertainty.columnId})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6 }}>No column-level uncertainty was detected in the preview sample.</p>
            )}
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Column inventory</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th align="left">Column</th>
                    <th align="left">Inference</th>
                    <th align="left">Confidence</th>
                    <th align="left">Sample values</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => (
                    <tr key={column.columnId}>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.sourceName}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.inferredType}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.confidence}</td>
                      <td style={{ padding: '0.45rem 0.25rem' }}>{column.sampleValues.join(', ') || 'No sample values'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: 0 }}>Sample rows</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column.columnId} align="left">
                        {column.sourceName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row) => (
                    <tr key={row.rowId}>
                      {row.cells.map((cell) => (
                        <td key={`${row.rowId}_${cell.columnId}`} style={{ padding: '0.45rem 0.25rem' }}>
                          {cell.value || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                clearActiveImportPreview({
                  clearPasteValidationError: () => {
                    setPasteValidationError(null);
                  },
                  clearBenchmark: () => {
                    activityTrackerRef.current.clearBenchmark();
                  },
                  clearBudgetTimer: () => {
                    clearBudgetTimer();
                  },
                  disposeWorker,
                  resetPreview: () => {
                    storeRef.current.getState().commands.reset();
                  },
                });
              }}
            >
              Clear preview
            </button>
            <span style={{ alignSelf: 'center', color: '#6f5b45' }}>
              Commit remains intentionally unavailable in Story 2.1.
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}
