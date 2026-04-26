import { startTransition, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import {
  importPreviewRequestMessageSchema,
  importPreviewFailureMessageSchema,
  importPreviewProgressMessageSchema,
  importPreviewSuccessMessageSchema,
} from '../../schemas/worker';
import { WORKSPACE_SAVE_PERSISTENCE_TIMEOUT_MS, saveWorkspaceKernel } from '../workspace-persistence';
import {
  IndexedDbWorkspaceStorage,
  createWorkspaceRepository,
  type PersistedDatasetFileHandle,
} from '../../services/persistence';
import {
  BrowserLocalImportFileAccess,
  LocalImportSourceValidationError,
  type LocalImportSelection,
  type ValidatedLocalImportSourceFileHandle,
  validateLocalImportFileHandleMatchesPreview,
} from '../../services/persistence/fs-access/local-import-files';
import type { WorkspaceFileHandle } from '../../services/persistence/fs-access/portable-workspace-files';
import {
  IMPORT_BOOTSTRAP_DATASET_ID,
  type WorkspaceKernelStore,
} from '../../stores/workspace-kernel';
import {
  IMPORT_PREVIEW_BUDGET_MS,
  dispatchImportBenchmarkTimingEvent,
  type ImportBenchmarkTimingEvent,
} from './benchmark-timing';
import {
  createConfirmedImportRepairSelections,
  createImportedGraphId,
  createConfirmedImportSource,
  createImportedDatasetFromPreview,
  summarizeImportIssues,
} from './confirm-import';
import { hasMaterializedConfirmedDataset } from './preview-model';
import { detectOwnedTextImportBenchmarkScenario, getOwnedImportBenchmarkFixture } from './owned-import-benchmarks';
import { createImportPreviewStore, type ImportPreviewError } from './store';
import {
  type ImportBenchmarkScenario,
  type ImportHeaderSelection,
  type ImportMissingValuePolicy,
  type ImportPreviewDataset,
  type ImportRepairDelimiter,
  type ImportRepairSelections,
  type ImportSourceKind,
} from './preview-model';

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `import_${Date.now()}`;
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function isConfirmTimePreviewStillCurrent({
  expectedPreviewId,
  visiblePreviewId,
}: {
  expectedPreviewId: string;
  visiblePreviewId: string | null | undefined;
}) {
  return visiblePreviewId === expectedPreviewId;
}

export const CONFIRMATION_MATERIALIZATION_TIMEOUT_MS = Math.max(IMPORT_PREVIEW_BUDGET_MS * 6, 30_000);
export const CONFIRMATION_MATERIALIZATION_TIMEOUT_MESSAGE =
  'The confirm-time import worker did not respond. Reject this preview or try Confirm Import again.';
export const CONFIRMATION_PERSISTENCE_TIMEOUT_MS = WORKSPACE_SAVE_PERSISTENCE_TIMEOUT_MS;
export const CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE =
  'Confirm Import is already validating or saving this dataset. Wait for it to finish before starting another import.';

export function isConfirmMaterializationRecoveryError(error: unknown): error is Error {
  return error instanceof Error && error.message === CONFIRMATION_MATERIALIZATION_TIMEOUT_MESSAGE;
}

export function shouldShowRejectImportAction({
  previewCommitted,
  confirmPersistencePending = false,
}: {
  previewCommitted: boolean;
  confirmPersistencePending?: boolean | undefined;
}) {
  return !previewCommitted && !confirmPersistencePending;
}

export function isRejectImportPersistenceBlocked({
  previewId,
  pendingPreviewId,
}: {
  previewId: string;
  pendingPreviewId: string | null;
}) {
  return pendingPreviewId === previewId;
}

export function isImportEntrypointPersistenceBlocked({
  pendingPreviewId,
  confirmationPendingPreviewId = null,
}: {
  pendingPreviewId: string | null;
  confirmationPendingPreviewId?: string | null | undefined;
}) {
  return pendingPreviewId !== null || confirmationPendingPreviewId !== null;
}

export function getImportEntrypointPersistenceBlockedMessage({
  pendingPreviewId,
  confirmationPendingPreviewId = null,
}: {
  pendingPreviewId: string | null;
  confirmationPendingPreviewId?: string | null | undefined;
}) {
  return isImportEntrypointPersistenceBlocked({ pendingPreviewId, confirmationPendingPreviewId })
    ? CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE
    : null;
}

export function shouldSurfaceConfirmTimePreviewForAcknowledgement({
  visiblePreview,
  confirmedPreview,
}: {
  visiblePreview: ImportPreviewDataset;
  confirmedPreview: ImportPreviewDataset;
}) {
  return !visiblePreview.isPartialPreview
    && (
      confirmedPreview.isPartialPreview
      || confirmedPreview.rowCount > visiblePreview.rowCount
      || confirmedPreview.columnCount > visiblePreview.columnCount
    );
}

export function clearAbortControllerIfCurrent(
  ref: { current: AbortController | null },
  controller: AbortController | null,
) {
  if (controller !== null && ref.current === controller) {
    ref.current = null;
    return true;
  }

  return false;
}

function formatHeaderSelection(selection: ImportHeaderSelection) {
  return selection === 'first-row-header' ? 'Treat the first row as headers' : 'Treat the first row as data';
}

function formatMissingValuePolicy(policy: ImportMissingValuePolicy) {
  return policy === 'drop-invalid-rows'
    ? 'Exclude rows with missing or malformed values'
    : 'Keep rows and mark missing or malformed cells as empty';
}

function cloneBinaryContent(binaryContent: ArrayBuffer | null | undefined) {
  return binaryContent ? binaryContent.slice(0) : null;
}

function describeRepairIssueTone(severity: ImportPreviewDataset['issues'][number]['severity']) {
  if (severity === 'blocking') {
    return {
      background: 'rgba(177, 56, 31, 0.12)',
      border: '1px solid rgba(177, 56, 31, 0.25)',
      label: 'Blocking',
    };
  }

  if (severity === 'warning') {
    return {
      background: 'rgba(227, 177, 104, 0.18)',
      border: '1px solid rgba(227, 177, 104, 0.3)',
      label: 'Warning',
    };
  }

  return {
    background: 'rgba(31, 42, 54, 0.06)',
    border: '1px solid rgba(31, 42, 54, 0.12)',
    label: 'Info',
  };
}

export async function commitConfirmedImportToKernel({
  kernelStore,
  preview,
  confirmationToken,
  sourceFileHandle,
  actorId = 'workspace-import-route',
  occurredAt = new Date().toISOString(),
  persistenceAvailable = typeof indexedDB !== 'undefined',
  saveWorkspace = async (
    store: WorkspaceKernelStore,
    datasetFileHandles?: PersistedDatasetFileHandle[],
    requiredDatasetFileHandleDatasetIds?: string[],
  ) => {
    await saveWorkspaceKernel({
      repository: createWorkspaceRepository(new IndexedDbWorkspaceStorage()),
      kernelStore: store,
      persistenceTimeoutMs: CONFIRMATION_PERSISTENCE_TIMEOUT_MS,
      ...(datasetFileHandles ? { datasetFileHandles } : {}),
      requireDatasetFileHandles: datasetFileHandles !== undefined,
      ...(requiredDatasetFileHandleDatasetIds ? { requiredDatasetFileHandleDatasetIds } : {}),
    });
  },
}: {
  kernelStore: WorkspaceKernelStore;
  preview: ImportPreviewDataset;
  confirmationToken: string;
  sourceFileHandle?: ValidatedLocalImportSourceFileHandle | undefined;
  actorId?: string | undefined;
  occurredAt?: string | undefined;
  persistenceAvailable?: boolean | undefined;
  saveWorkspace?:
    | ((
      kernelStore: WorkspaceKernelStore,
      datasetFileHandles?: PersistedDatasetFileHandle[],
      requiredDatasetFileHandleDatasetIds?: string[],
    ) => Promise<unknown>)
    | undefined;
}) {
  if (!persistenceAvailable) {
    throw new Error('Confirmed imports require persistent browser storage.');
  }

  const currentState = kernelStore.getState();
  const rollbackSnapshot = currentState.selectors.persistedWorkspace();
  const rollbackLedger = structuredClone(currentState.ledger);
  const rollbackDatasetFileHandles = currentState.selectors.datasetFileHandles();
  const rollbackActiveGraphId = currentState.selectors.activeGraphId();
  const rollbackReferenceGraphId = currentState.selectors.referenceGraphId();
  const dataset = createImportedDatasetFromPreview(preview, confirmationToken, {
    ...(sourceFileHandle
      ? {
          sourceFile: {
            fileName: preview.source.fileName ?? preview.source.sourceLabel,
            fileHandleToken: `dataset.dataset_import_${confirmationToken}.source-file`,
          },
        }
      : {}),
  });
  const nextDatasetFileHandles = sourceFileHandle
    ? [
        ...rollbackDatasetFileHandles.filter((entry) => entry.datasetId !== dataset.datasetId),
        {
          datasetId: dataset.datasetId,
          fileName: dataset.sourceFile!.fileName,
          fileHandleToken: dataset.sourceFile!.fileHandleToken,
          fileSize: sourceFileHandle.fileSize,
          fileLastModified: sourceFileHandle.fileLastModified,
          fileSha256: sourceFileHandle.fileSha256,
          handle: sourceFileHandle.handle,
        } satisfies PersistedDatasetFileHandle,
      ]
    : undefined;

  currentState.commands.confirmImport({
    previewId: preview.previewId,
    graphId: createImportedGraphId(confirmationToken),
    source: createConfirmedImportSource(preview),
    repairSelections: createConfirmedImportRepairSelections(preview),
    dataset,
    issues: preview.issues,
    actorId,
    correlationId: `confirm_${confirmationToken}`,
    occurredAt,
  });
  const confirmedWorkspaceVersion = kernelStore.getState().workspaceVersion;
  const canonicalIssueIds = preview.issues.map((issue) => `${issue.issueId}:${dataset.datasetId}`);

  try {
    await saveWorkspace(
      kernelStore,
      nextDatasetFileHandles,
      sourceFileHandle ? [dataset.datasetId] : undefined,
    );
  } catch (error) {
    const currentKernelState = kernelStore.getState();

    if (currentKernelState.workspaceVersion === confirmedWorkspaceVersion) {
      currentKernelState.commands.replaceSnapshot({
        snapshot: rollbackSnapshot,
        ledger: rollbackLedger,
        datasetFileHandles: rollbackDatasetFileHandles,
      });
    } else {
      currentKernelState.commands.rollbackConfirmedImport({
        datasetId: dataset.datasetId,
        graphId: createImportedGraphId(confirmationToken),
        issueIds: canonicalIssueIds,
        previousActiveGraphId: rollbackActiveGraphId,
        previousReferenceGraphId: rollbackReferenceGraphId,
        fallbackDatasets: rollbackSnapshot.datasets,
        fallbackGraphDefinitions: rollbackSnapshot.graphDefinitions,
        actorId,
        correlationId: `confirm_rollback_${confirmationToken}`,
        occurredAt: new Date().toISOString(),
      });
      currentKernelState.commands.replaceDatasetFileHandles(
        currentKernelState.selectors
          .datasetFileHandles()
          .filter((entry) => entry.datasetId !== dataset.datasetId),
      );
    }
    throw error;
  }
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

export async function validateSourceFileHandleMatchesPreview(
  sourceRequest: ReplayableSourceRequest,
  pendingLocalImportSelection: PendingLocalImportSelection | null,
  signal?: AbortSignal | undefined,
) {
  if (sourceRequest.replayMode !== 'local-file' || !pendingLocalImportSelection?.handle) {
    return undefined;
  }

  return validateLocalImportFileHandleMatchesPreview({
    sourceKind: sourceRequest.sourceKind,
    fileName: sourceRequest.fileName,
    previewFile: sourceRequest.localFile,
    signal,
    selection: pendingLocalImportSelection,
  });
}

function isSourceValidationError(error: unknown): error is Error {
  return error instanceof LocalImportSourceValidationError || (error instanceof Error && (
    error.message.includes('Reselect the source file') ||
    error.message.includes('source file changed after preview')
  ));
}

const sectionCardStyle = {
  padding: '1rem 1.1rem',
  borderRadius: '1rem',
  background: '#f9f6f1',
  border: '1px solid rgba(31, 42, 54, 0.1)',
} as const;

type WorkerImportPayload = {
  sourceLabel: string;
  fileName?: string | undefined;
  mimeType?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  textContent?: string | null | undefined;
  binaryContent?: ArrayBuffer | null | undefined;
  repairSelections?: ImportRepairSelections | undefined;
};

type ReplayableInlineSourceRequest = {
  replayMode: 'inline';
  sourceKind: ImportSourceKind;
  sourceLabel: string;
  fileName?: string | undefined;
  mimeType?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  textContent?: string | null | undefined;
  binaryContent?: ArrayBuffer | null | undefined;
};

type ReplayableLocalFileSourceRequest = {
  replayMode: 'local-file';
  sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
  sourceLabel: string;
  fileName: string;
  mimeType?: string | null | undefined;
  benchmarkScenario?: ImportBenchmarkScenario | null | undefined;
  localFile: File;
};

export type ReplayableSourceRequest = ReplayableInlineSourceRequest | ReplayableLocalFileSourceRequest;

export type PendingLocalImportSelection = {
  sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
  fileName: string;
  handle?: WorkspaceFileHandle;
};

export type PreviewReplayContext = {
  sourceRequest: ReplayableSourceRequest;
  pendingLocalImportSelection: PendingLocalImportSelection | null;
};

const MAX_PREVIEW_REPLAY_CONTEXTS = 3;

export function rememberPreviewReplayContext({
  contexts,
  previewId,
  sourceRequest,
  pendingLocalImportSelection,
  maxContexts = MAX_PREVIEW_REPLAY_CONTEXTS,
}: {
  contexts: Map<string, PreviewReplayContext>;
  previewId: string;
  sourceRequest: ReplayableSourceRequest | null;
  pendingLocalImportSelection: PendingLocalImportSelection | null;
  maxContexts?: number | undefined;
}) {
  if (!sourceRequest) {
    contexts.delete(previewId);
    return;
  }

  contexts.set(previewId, {
    sourceRequest,
    pendingLocalImportSelection: pendingLocalImportSelection
      ? {
          ...pendingLocalImportSelection,
        }
      : null,
  });

  while (contexts.size > maxContexts) {
    const oldestPreviewId = contexts.keys().next().value;

    if (!oldestPreviewId) {
      break;
    }

    contexts.delete(oldestPreviewId);
  }
}

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
  fileName,
  textContent,
  binaryContent,
}: {
  sourceKind: ImportSourceKind;
  fileName?: string | undefined;
  textContent?: string | null | undefined;
  binaryContent?: ArrayBuffer | null | undefined;
}): Promise<ImportBenchmarkScenario | null> {
  const textImportBenchmarkScenario = detectOwnedTextImportBenchmarkScenario({
    sourceKind,
    fileName,
    textContent,
  });

  if (textImportBenchmarkScenario) {
    return textImportBenchmarkScenario;
  }

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

export function createReplayableSourceRequest({
  sourceKind,
  payload,
  localFile,
}: {
  sourceKind: ImportSourceKind;
  payload: WorkerImportPayload;
  localFile?: File | undefined;
}): ReplayableSourceRequest {
  if (localFile && (sourceKind === 'csv-file' || sourceKind === 'excel-file')) {
    return {
      replayMode: 'local-file',
      sourceKind,
      sourceLabel: payload.sourceLabel,
      fileName: payload.fileName ?? localFile.name,
      mimeType: payload.mimeType ?? localFile.type ?? null,
      benchmarkScenario: payload.benchmarkScenario ?? null,
      localFile,
    };
  }

  return {
    replayMode: 'inline',
    sourceKind,
    sourceLabel: payload.sourceLabel,
    ...(payload.fileName ? { fileName: payload.fileName } : {}),
    mimeType: payload.mimeType ?? null,
    benchmarkScenario: payload.benchmarkScenario ?? null,
    textContent: payload.textContent ?? null,
    binaryContent: cloneBinaryContent(payload.binaryContent ?? null),
  };
}

export async function createWorkerPayloadFromReplayableSourceRequest(
  sourceRequest: ReplayableSourceRequest,
  repairSelections: ImportRepairSelections,
  options: {
    readTextFile?: ((file: File) => Promise<string>) | undefined;
    readBinaryFile?: ((file: File) => Promise<ArrayBuffer>) | undefined;
    signal?: AbortSignal | undefined;
  } = {},
): Promise<WorkerImportPayload> {
  const readTextFile = options.readTextFile ?? readFileText;
  const readBinaryFile = options.readBinaryFile ?? readFileArrayBuffer;
  const assertNotAborted = () => {
    if (options.signal?.aborted) {
      throw new Error('The confirm-time import pass was canceled because the preview changed.');
    }
  };

  assertNotAborted();

  if (sourceRequest.replayMode === 'local-file') {
    if (sourceRequest.sourceKind === 'excel-file') {
      const binaryContent = await readBinaryFile(sourceRequest.localFile);
      assertNotAborted();

      return {
        sourceLabel: sourceRequest.sourceLabel,
        fileName: sourceRequest.fileName,
        mimeType: sourceRequest.mimeType ?? null,
        benchmarkScenario: sourceRequest.benchmarkScenario ?? null,
        binaryContent,
        repairSelections,
      };
    }

    const textContent = await readTextFile(sourceRequest.localFile);
    assertNotAborted();

    return {
      sourceLabel: sourceRequest.sourceLabel,
      fileName: sourceRequest.fileName,
      mimeType: sourceRequest.mimeType ?? null,
      benchmarkScenario: sourceRequest.benchmarkScenario ?? null,
      textContent,
      repairSelections,
    };
  }

  return {
    sourceLabel: sourceRequest.sourceLabel,
    ...(sourceRequest.fileName ? { fileName: sourceRequest.fileName } : {}),
    mimeType: sourceRequest.mimeType ?? null,
    benchmarkScenario: sourceRequest.benchmarkScenario ?? null,
    textContent: sourceRequest.textContent ?? null,
    binaryContent: cloneBinaryContent(sourceRequest.binaryContent ?? null),
    repairSelections,
  };
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

export function WorkspaceImportRoute({
  workspaceId,
  kernelStore,
}: {
  workspaceId?: string | undefined;
  kernelStore: WorkspaceKernelStore;
}) {
  const storeRef = useRef(createImportPreviewStore());
  const activityTrackerRef = useRef(createImportActivityTracker());
  const workerRef = useRef<Worker | null>(null);
  const confirmationMaterializationRef = useRef<{
    worker: Worker | null;
    abortController: AbortController;
    reject: (error: Error) => void;
  } | null>(null);
  const budgetTimerRef = useRef<number | null>(null);
  const budgetTimerCorrelationRef = useRef<string | null>(null);
  const localImportFileAccessRef = useRef<BrowserLocalImportFileAccess | null>(null);
  const pendingLocalImportSelectionRef = useRef<PendingLocalImportSelection | null>(null);
  const replayableSourceRequestRef = useRef<ReplayableSourceRequest | null>(null);
  const previewReplayContextRef = useRef(new Map<string, PreviewReplayContext>());
  const confirmationSourceValidationAbortControllerRef = useRef<AbortController | null>(null);
  const confirmationPendingPreviewIdRef = useRef<string | null>(null);
  const confirmationPersistencePendingPreviewIdRef = useRef<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteValidationError, setPasteValidationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmationPendingPreviewId, setConfirmationPendingPreviewId] = useState<string | null>(null);
  const [confirmationPersistencePendingPreviewId, setConfirmationPersistencePendingPreviewId] = useState<string | null>(null);

  const status = useStore(storeRef.current, (state) => state.status);
  const preview = useStore(storeRef.current, (state) => state.preview);
  const progress = useStore(storeRef.current, (state) => state.progress);
  const error = useStore(storeRef.current, (state) => state.error);
  const budgetExceeded = useStore(storeRef.current, (state) => state.budgetExceeded);
  const timingEvent = useStore(storeRef.current, (state) => state.lastTimingEvent);
  const repairSelections = useStore(storeRef.current, (state) => state.repairSelections);
  const lastCommittedPreviewId = useStore(storeRef.current, (state) => state.lastCommittedPreviewId);
  const committedSnapshot = useStore(kernelStore, (state) => state.snapshot);
  const displayedBenchmarkScenario = resolveDisplayedBenchmarkScenario(preview, timingEvent);
  const currentIssueSummary = summarizeImportIssues(preview?.issues ?? []);
  const confirmBlocked = currentIssueSummary.blocking > 0;
  const previewCommitted = preview ? lastCommittedPreviewId === preview.previewId : false;
  const previewCommitLocked = preview
    ? previewCommitted || confirmationPendingPreviewId === preview.previewId
    : false;
  const previewConfirmPersistencePending = preview
    ? confirmationPersistencePendingPreviewId === preview.previewId
    : false;
  const importEntrypointsLocked = isImportEntrypointPersistenceBlocked({
    pendingPreviewId: confirmationPersistencePendingPreviewId,
    confirmationPendingPreviewId,
  });
  const importEntrypointPersistenceBlockedMessage = getImportEntrypointPersistenceBlockedMessage({
    pendingPreviewId: confirmationPersistencePendingPreviewId,
    confirmationPendingPreviewId,
  });
  const canonicalDatasetCount = committedSnapshot.datasets.filter(
    (dataset) => dataset.datasetId !== IMPORT_BOOTSTRAP_DATASET_ID,
  ).length;

  useEffect(() => {
    activityTrackerRef.current = createImportActivityTracker();

    return () => {
      activityTrackerRef.current.dispose();

      if (budgetTimerRef.current !== null) {
        window.clearTimeout(budgetTimerRef.current);
      }

      budgetTimerCorrelationRef.current = null;
      disposeWorker();
      cancelConfirmationMaterialization();
      replayableSourceRequestRef.current = null;
      previewReplayContextRef.current.clear();
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

  function cancelConfirmationMaterialization() {
    confirmationSourceValidationAbortControllerRef.current?.abort(
      new Error('The source-file validation was canceled because the preview changed.'),
    );
    confirmationSourceValidationAbortControllerRef.current = null;

    const activeMaterialization = confirmationMaterializationRef.current;

    if (!activeMaterialization) {
      return;
    }

    activeMaterialization.abortController.abort(new Error('The confirm-time import pass was canceled because the preview changed.'));
    activeMaterialization.reject(new Error('The confirm-time import pass was canceled because the preview changed.'));
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
        restoreReplayContextForVisiblePreview();
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
        restoreReplayContextForVisiblePreview();
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
            startTransition(() => {
              storeRef.current
                .getState()
                .commands.resolveImport(resolvedPreview, benchmarkEvent, successMessage.data.correlationId);
              rememberReplayContextForPreview(resolvedPreview.previewId);
            });
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
            startTransition(() => {
              storeRef.current.getState().commands.failImport(
                failureMessage.data.payload,
                failureMessage.data.correlationId,
              );
              restoreReplayContextForVisiblePreview();
            });
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

  function getLocalImportFileAccess() {
    if (!localImportFileAccessRef.current) {
      localImportFileAccessRef.current = new BrowserLocalImportFileAccess(undefined, undefined, undefined, {
        preferNativePicker: true,
      });
    }

    return localImportFileAccessRef.current;
  }

  function blockImportEntrypointIfConfirmationPersistencePending() {
    if (!isImportEntrypointPersistenceBlocked({
      pendingPreviewId: confirmationPersistencePendingPreviewIdRef.current,
      confirmationPendingPreviewId: confirmationPendingPreviewIdRef.current,
    })) {
      return false;
    }

    setActionError(CONFIRMATION_PERSISTENCE_IMPORT_ENTRYPOINT_BLOCKED_MESSAGE);
    return true;
  }

  function beginImport(sourceKind: ImportSourceKind) {
    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return null;
    }

    clearBudgetTimer();
    disposeWorker();
    cancelConfirmationMaterialization();
    activityTrackerRef.current.clearBenchmark();
    clearReplayableSourceRequest();
    setActionError(null);
    const correlationId = createCorrelationId();
    storeRef.current.getState().commands.beginImport(correlationId, sourceKind);

    return correlationId;
  }

  function setPendingLocalImportSelection(selection: PendingLocalImportSelection | null) {
    pendingLocalImportSelectionRef.current = selection;
  }

  function clearReplayableSourceRequest() {
    replayableSourceRequestRef.current = null;
  }

  function clonePendingLocalImportSelection(selection: PendingLocalImportSelection | null) {
    return selection
      ? {
          ...selection,
        }
      : null;
  }

  function rememberReplayContextForPreview(previewId: string) {
    rememberPreviewReplayContext({
      contexts: previewReplayContextRef.current,
      previewId,
      sourceRequest: replayableSourceRequestRef.current,
      pendingLocalImportSelection: clonePendingLocalImportSelection(pendingLocalImportSelectionRef.current),
    });
  }

  function restoreReplayContextForVisiblePreview() {
    const visiblePreviewId = storeRef.current.getState().preview?.previewId;

    if (!visiblePreviewId) {
      clearReplayableSourceRequest();
      setPendingLocalImportSelection(null);
      return;
    }

    const previewReplayContext = previewReplayContextRef.current.get(visiblePreviewId);

    if (!previewReplayContext) {
      clearReplayableSourceRequest();
      setPendingLocalImportSelection(null);
      return;
    }

    replayableSourceRequestRef.current = previewReplayContext.sourceRequest;
    setPendingLocalImportSelection(previewReplayContext.pendingLocalImportSelection);
  }

  async function materializeConfirmedPreviewForImport(
    sourceRequest: ReplayableSourceRequest,
    repairSelectionsForConfirm: ImportRepairSelections,
  ) {
    return new Promise<ImportPreviewDataset>((resolve, reject) => {
      const abortController = new AbortController();
      let worker: Worker | null = null;
      let timeoutId: number | null = null;
      const correlationId = `import_confirm_${createCorrelationId()}`;
      let settled = false;
      const cleanup = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (confirmationMaterializationRef.current?.reject === rejectOnce) {
          confirmationMaterializationRef.current = null;
        }

        if (worker) {
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          worker.terminate();
        }
      };
      const resolveOnce = (preview: ImportPreviewDataset) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(preview);
      };
      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      };

      confirmationMaterializationRef.current = {
        worker: null,
        abortController,
        reject: rejectOnce,
      };
      timeoutId = window.setTimeout(() => {
        const timeoutError = new Error(CONFIRMATION_MATERIALIZATION_TIMEOUT_MESSAGE);
        abortController.abort(timeoutError);
        rejectOnce(timeoutError);
      }, CONFIRMATION_MATERIALIZATION_TIMEOUT_MS);

      void (async () => {
        try {
          const payload = await createWorkerPayloadFromReplayableSourceRequest(sourceRequest, repairSelectionsForConfirm, {
            readTextFile: readFileText,
            readBinaryFile: readFileArrayBuffer,
            signal: abortController.signal,
          });

          if (settled || abortController.signal.aborted) {
            return;
          }

          worker = new Worker(new URL('../../workers/import.worker.ts', import.meta.url), {
            type: 'module',
          });

          if (confirmationMaterializationRef.current?.reject === rejectOnce) {
            confirmationMaterializationRef.current.worker = worker;
          }

          worker.onmessage = (event: MessageEvent) => {
            const successMessage = importPreviewSuccessMessageSchema.safeParse(event.data);

            if (successMessage.success && successMessage.data.correlationId === correlationId) {
              resolveOnce(successMessage.data.payload.preview);
              return;
            }

            const failureMessage = importPreviewFailureMessageSchema.safeParse(event.data);

            if (failureMessage.success && failureMessage.data.correlationId === correlationId) {
              rejectOnce(new Error(failureMessage.data.payload.detail));
            }
          };

          worker.onerror = (event) => {
            rejectOnce(new Error(event.message || 'The import worker could not materialize the confirmed dataset.'));
            event.preventDefault();
          };
          worker.onmessageerror = () => {
            rejectOnce(new Error('The import worker returned an unreadable confirmed-import payload.'));
          };

          const binaryContent = payload.binaryContent ?? null;
          worker.postMessage(
            importPreviewRequestMessageSchema.parse({
              schemaVersion: '1.0.0',
              messageId: `import_confirm_${correlationId}`,
              correlationId,
              workspaceVersion: 1,
              type: 'import.preview.request',
              payload: {
                sourceKind: sourceRequest.sourceKind,
                ...payload,
                ...(binaryContent ? { binaryContent } : {}),
                materializeConfirmedDataset: true,
              },
            }),
            binaryContent ? [binaryContent] : [],
          );
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error('The import worker could not start the confirmed import pass.'));
        }
      })();
    });
  }

  function markConfirmationPending(previewId: string) {
    confirmationPendingPreviewIdRef.current = previewId;
    setConfirmationPendingPreviewId(previewId);
  }

  function clearConfirmationPending(previewId?: string) {
    if (previewId !== undefined && confirmationPendingPreviewIdRef.current !== previewId) {
      return;
    }

    confirmationPendingPreviewIdRef.current = null;
    setConfirmationPendingPreviewId(null);
  }

  function markConfirmationPersistencePending(previewId: string) {
    confirmationPersistencePendingPreviewIdRef.current = previewId;
    setConfirmationPersistencePendingPreviewId(previewId);
  }

  function clearConfirmationPersistencePending(previewId?: string) {
    if (previewId !== undefined && confirmationPersistencePendingPreviewIdRef.current !== previewId) {
      return;
    }

    confirmationPersistencePendingPreviewIdRef.current = null;
    setConfirmationPersistencePendingPreviewId((currentPreviewId) => {
      if (previewId !== undefined && currentPreviewId !== previewId) {
        return currentPreviewId;
      }

      return null;
    });
  }

  function beginRepairImport(sourceKind: ImportSourceKind) {
    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return null;
    }

    clearBudgetTimer();
    disposeWorker();
    cancelConfirmationMaterialization();
    activityTrackerRef.current.clearBenchmark();
    setActionError(null);
    const correlationId = createCorrelationId();
    storeRef.current.getState().commands.beginImport(correlationId, sourceKind, {
      preserveRepairSelections: true,
    });

    return correlationId;
  }

  function postWorkerImport(
    correlationId: string,
    sourceKind: ImportSourceKind,
    payload: WorkerImportPayload,
    options?: {
      localFile?: File | undefined;
      preserveReplayablePayload?: boolean;
    },
  ) {
    const currentRepairSelections = payload.repairSelections ?? storeRef.current.getState().repairSelections;

    if (options?.preserveReplayablePayload === true && replayableSourceRequestRef.current) {
      // Keep the original replay source so repeated repairs do not retain or reclone raw file payloads.
    } else {
      replayableSourceRequestRef.current = createReplayableSourceRequest({
        sourceKind,
        payload: {
          ...payload,
          repairSelections: currentRepairSelections,
        },
        ...(options?.localFile ? { localFile: options.localFile } : {}),
      });
    }

    storeRef.current.getState().commands.setSourceRequest({
      sourceKind,
      sourceLabel: payload.sourceLabel,
      ...(payload.fileName ? { fileName: payload.fileName } : {}),
      mimeType: payload.mimeType ?? null,
      benchmarkScenario: payload.benchmarkScenario ?? null,
      repairSelections: currentRepairSelections,
    });
    postWorkerImportFromRoute({
      correlationId,
      sourceKind,
      payload: {
        ...payload,
        binaryContent: payload.binaryContent ?? null,
        repairSelections: currentRepairSelections,
      },
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

  async function handleFileImport(
    sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>,
    selection: LocalImportSelection | null,
  ) {
    if (!selection) {
      return;
    }

    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return;
    }

    const { file, handle } = selection;
    setPasteValidationError(null);
    setPendingLocalImportSelection({
      sourceKind,
      fileName: file.name,
      ...(handle ? { handle } : {}),
    });
    const correlationId = beginImport(sourceKind);

    if (correlationId === null) {
      setPendingLocalImportSelection(null);
      return;
    }

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
          fileName: file.name,
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
          fileName: file.name,
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
      postWorkerImport(correlationId, sourceKind, payload, {
        localFile: file,
      });
    } catch (caughtError) {
      failImportFromWorker(
        correlationId,
        caughtError instanceof Error ? caughtError.message : 'The import worker could not start for the selected source.',
      );
    }
  }

  async function handleLocalFileSelection(sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>) {
    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return;
    }

    setPasteValidationError(null);

    let selection: LocalImportSelection | null;

    try {
      selection = await getLocalImportFileAccess().openLocalImportSource({ sourceKind });
    } catch (caughtError) {
      storeRef.current.getState().commands.failImport(toImportPreparationError('selection', caughtError));
      return;
    }

    await handleFileImport(sourceKind, selection);
  }

  async function handlePasteImport() {
    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return;
    }

    if (pasteText.trim().length === 0) {
      setPasteValidationError('Paste some tabular data first');
      return;
    }

    setPasteValidationError(null);
    setPendingLocalImportSelection(null);
    const correlationId = beginImport('pasted-table');

    if (correlationId === null) {
      return;
    }

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
    if (blockImportEntrypointIfConfirmationPersistencePending()) {
      return;
    }

    setPasteValidationError(null);
    setPendingLocalImportSelection(null);
    const fixture = getOwnedImportBenchmarkFixture(sourceKind);
    const correlationId = beginImport(sourceKind);

    if (correlationId === null) {
      return;
    }

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

  function handleRepairSelection(nextRepairSelections: ImportRepairSelections) {
    void (async () => {
      const currentState = storeRef.current.getState();
      const activePreview = currentState.preview;
      const sourceRequest = replayableSourceRequestRef.current;

      if (
        !sourceRequest ||
        !activePreview ||
        currentState.lastCommittedPreviewId === activePreview.previewId ||
        confirmationPendingPreviewIdRef.current === activePreview.previewId
      ) {
        return;
      }

      const correlationId = beginRepairImport(sourceRequest.sourceKind);

      if (correlationId === null) {
        return;
      }

      storeRef.current.getState().commands.setRepairSelections(nextRepairSelections);
      activityTrackerRef.current.markBenchmarkStart(correlationId);
      storeRef.current.getState().commands.updateProgress(
        {
          phase: 'loading',
          message: 'Applying the selected repair in the import worker.',
        },
        correlationId,
      );

      try {
        const repairedRequest = await createWorkerPayloadFromReplayableSourceRequest(sourceRequest, nextRepairSelections, {
          readTextFile: async (file) => readLocalFileWithBudget(correlationId, () => readFileText(file)),
          readBinaryFile: async (file) => readLocalFileWithBudget(correlationId, () => readFileArrayBuffer(file)),
        });

        if (!isActiveWorkerMessage(correlationId)) {
          return;
        }

        postWorkerImport(correlationId, sourceRequest.sourceKind, repairedRequest, {
          preserveReplayablePayload: true,
        });
      } catch (caughtError) {
        failImportFromWorker(
          correlationId,
          caughtError instanceof Error ? caughtError.message : 'The import worker could not apply the selected repair.',
        );
      }
    })();
  }

  async function confirmImport() {
    const currentState = storeRef.current.getState();
    const currentPreview = currentState.preview;

    if (!currentPreview) {
      return;
    }

    const currentIssueSummary = summarizeImportIssues(currentPreview.issues);

    if (
      currentIssueSummary.blocking > 0 ||
      currentState.lastCommittedPreviewId === currentPreview.previewId ||
      confirmationPendingPreviewIdRef.current === currentPreview.previewId
    ) {
      return;
    }

    setActionError(null);
    markConfirmationPending(currentPreview.previewId);
    const sourceRequest = replayableSourceRequestRef.current;
    let sourceValidationAbortController: AbortController | null = null;

    if (!sourceRequest) {
      setActionError('Confirmed import could not replay the selected source. Reopen the preview and try again.');
      clearConfirmationPending(currentPreview.previewId);
      return;
    }

    try {
      sourceValidationAbortController = new AbortController();
      confirmationSourceValidationAbortControllerRef.current = sourceValidationAbortController;
      const sourceFileHandle = await validateSourceFileHandleMatchesPreview(
        sourceRequest,
        pendingLocalImportSelectionRef.current,
        sourceValidationAbortController.signal,
      );
      clearAbortControllerIfCurrent(confirmationSourceValidationAbortControllerRef, sourceValidationAbortController);

      if (!isConfirmTimePreviewStillCurrent({
        expectedPreviewId: currentPreview.previewId,
        visiblePreviewId: storeRef.current.getState().preview?.previewId,
      })) {
        return;
      }

      const confirmedPreview = await materializeConfirmedPreviewForImport(sourceRequest, currentPreview.repairSelections);

      if (!hasMaterializedConfirmedDataset(confirmedPreview)) {
        throw new Error('The confirmed import dataset could not be materialized.');
      }

      const confirmedIssueSummary = summarizeImportIssues(confirmedPreview.issues);

      if (!isConfirmTimePreviewStillCurrent({
        expectedPreviewId: currentPreview.previewId,
        visiblePreviewId: storeRef.current.getState().preview?.previewId,
      })) {
        return;
      }

      if (confirmedIssueSummary.blocking > 0) {
        storeRef.current.getState().commands.resolveImport(confirmedPreview, null);
        rememberReplayContextForPreview(confirmedPreview.previewId);
        setActionError('The full dataset still has repairable blocking issues. Review the updated repair cards before confirming again.');
        return;
      }

      if (shouldSurfaceConfirmTimePreviewForAcknowledgement({
        visiblePreview: currentPreview,
        confirmedPreview,
      })) {
        storeRef.current.getState().commands.resolveImport(confirmedPreview, null);
        rememberReplayContextForPreview(confirmedPreview.previewId);
        setActionError('The full workbook includes additional rows or columns that were not visible in the earlier complete preview. Review the updated preview before confirming again.');
        return;
      }

      markConfirmationPersistencePending(currentPreview.previewId);

      try {
        await commitConfirmedImportToKernel({
          kernelStore,
          preview: confirmedPreview,
          confirmationToken: createCorrelationId(),
          ...(sourceFileHandle ? { sourceFileHandle } : {}),
        });
        storeRef.current.getState().commands.markCommitted(currentPreview.previewId);
      } finally {
        clearConfirmationPersistencePending(currentPreview.previewId);
      }
    } catch (error) {
      if (!isConfirmTimePreviewStillCurrent({
        expectedPreviewId: currentPreview.previewId,
        visiblePreviewId: storeRef.current.getState().preview?.previewId,
      })) {
        return;
      }

      console.error('Failed to persist the confirmed import workspace state.', error);
      setActionError(
        isSourceValidationError(error)
          ? error.message
          : isConfirmMaterializationRecoveryError(error)
            ? error.message
            : 'Confirmed import could not be persisted. Restore local workspace storage and try again.',
      );
    } finally {
      clearAbortControllerIfCurrent(confirmationSourceValidationAbortControllerRef, sourceValidationAbortController);
      clearConfirmationPending(currentPreview.previewId);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Import preview workspace</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Start with CSV, Excel, or pasted rows. BMADGraphWebApp prepares a preview first, lets you repair uncertain
          parsing and data quality issues inline, and only commits the dataset after explicit confirmation.
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
            <button type="button" onClick={() => void handleLocalFileSelection('csv-file')} disabled={importEntrypointsLocked}>
              Choose CSV file
            </button>
            <button type="button" onClick={() => handleOwnedBenchmarkImport('csv-file')} disabled={importEntrypointsLocked}>
              {getOwnedImportBenchmarkFixture('csv-file').actionLabel}
            </button>
          </div>
        </article>

        <article style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Excel workbook</h3>
          <p style={{ lineHeight: 1.6 }}>Open a local `.xlsx` or `.xls` workbook and preview the first sheet only.</p>
          <button type="button" onClick={() => void handleLocalFileSelection('excel-file')} disabled={importEntrypointsLocked}>
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
            disabled={importEntrypointsLocked}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            placeholder={'Sample\tReading\tMeasuredAt\nA-1\t42.5\t2026-04-18'}
          />
          {pasteValidationError ? (
            <p role="alert" style={{ margin: '0.5rem 0 0', color: '#8a2d1b', lineHeight: 1.5 }}>
              {pasteValidationError}
            </p>
          ) : null}
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            <button type="button" onClick={() => void handlePasteImport()} disabled={importEntrypointsLocked}>
              Preview pasted table
            </button>
            <button type="button" onClick={() => handleOwnedBenchmarkImport('pasted-table')} disabled={importEntrypointsLocked}>
              {getOwnedImportBenchmarkFixture('pasted-table').actionLabel}
            </button>
          </div>
        </article>
      </section>
      {importEntrypointPersistenceBlockedMessage ? (
        <p role="status" aria-live="polite" style={{ margin: 0, color: '#6f5b45', lineHeight: 1.5 }}>
          {importEntrypointPersistenceBlockedMessage}
        </p>
      ) : null}

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
            <span>
              {previewCommitted
                ? 'Preview confirmed. The canonical workspace now reflects this imported dataset.'
                : 'Preview ready. Repair any blocking issues, then confirm or reject the import.'}
            </span>
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
              background: previewCommitted ? 'rgba(31, 42, 54, 0.06)' : 'rgba(227, 177, 104, 0.16)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
              {previewCommitted ? 'Canonical workspace updated' : 'Confirm or reject this import'}
            </strong>
            <span>
              {previewCommitted
                ? 'This dataset now sits in the workspace kernel through the confirmed-import path. Rejecting a later preview will leave that canonical state unchanged.'
                : confirmBlocked
                  ? `Resolve ${currentIssueSummary.blocking} blocking ${currentIssueSummary.blocking === 1 ? 'issue' : 'issues'} before confirming. Reject Import clears this preview without mutating the canonical workspace.`
                  : 'Confirm Import commits this repaired dataset into the canonical workspace. Reject Import clears the preview and leaves canonical state untouched.'}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
              <button type="button" onClick={() => void confirmImport()} disabled={confirmBlocked || previewCommitLocked}>
                Confirm Import
              </button>
              {shouldShowRejectImportAction({
                previewCommitted,
                confirmPersistencePending: previewConfirmPersistencePending,
              }) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isRejectImportPersistenceBlocked({
                      previewId: preview.previewId,
                      pendingPreviewId: confirmationPersistencePendingPreviewIdRef.current,
                    })) {
                      setActionError('Confirm Import is already saving this dataset. Wait for it to finish before rejecting the preview.');
                      return;
                    }

                    cancelConfirmationMaterialization();
                    clearActiveImportPreview({
                      clearPasteValidationError: () => {
                        setPasteValidationError(null);
                        setActionError(null);
                      },
                      clearBenchmark: () => {
                        activityTrackerRef.current.clearBenchmark();
                      },
                      clearBudgetTimer: () => {
                        clearBudgetTimer();
                      },
                      disposeWorker,
                      resetPreview: () => {
                        clearReplayableSourceRequest();
                        previewReplayContextRef.current.clear();
                        storeRef.current.getState().commands.reset();
                      },
                    });
                  }}
                >
                  Reject Import
                </button>
              ) : null}
            </div>
            {actionError ? (
              <p role="alert" style={{ margin: '0.75rem 0 0', color: '#8a2d1b', lineHeight: 1.5 }}>
                {actionError}
              </p>
            ) : null}
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
            <article style={sectionCardStyle}>
              <strong>Canonical datasets</strong>
              <div>{canonicalDatasetCount}</div>
            </article>
          </section>

          <section
            aria-live={confirmBlocked ? 'assertive' : 'polite'}
            style={{
              display: 'grid',
              gap: '0.75rem',
            }}
          >
            <h3 style={{ marginBottom: 0 }}>Repair cards</h3>
            {preview.issues.length > 0 ? (
              preview.issues.map((issue) => {
                const tone = describeRepairIssueTone(issue.severity);
                const diagnostics = issue.diagnostics as Record<string, unknown>;

                return (
                  <article
                    key={issue.issueId}
                    style={{
                      ...sectionCardStyle,
                      background: tone.background,
                      border: tone.border,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <strong>{issue.title}</strong>
                      <span>{tone.label}</span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', lineHeight: 1.6 }}>{issue.userMessage}</p>
                    <p style={{ margin: '0.5rem 0 0', lineHeight: 1.6, color: '#6f5b45' }}>{issue.detail}</p>

                    {diagnostics.category === 'delimiter' ? (
                      <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                        <span>Delimiter choice</span>
                        <select
                          aria-label="Delimiter choice"
                          value={repairSelections.delimiter ?? ''}
                          disabled={previewCommitLocked}
                          onChange={(event) =>
                            handleRepairSelection({
                              ...repairSelections,
                              delimiter: event.currentTarget.value as ImportRepairDelimiter,
                            })
                          }
                        >
                          <option value="" disabled>
                            Select and confirm a repair choice
                          </option>
                          <option value=",">Comma (,)</option>
                          <option value=";">Semicolon (;)</option>
                          <option value={'\t'}>Tab</option>
                          <option value="|">Pipe (|)</option>
                        </select>
                      </label>
                    ) : null}

                    {diagnostics.category === 'header' ? (
                      <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                        <span>First-row handling</span>
                          <select
                            aria-label="First-row handling"
                            value={repairSelections.headerSelection ?? ''}
                            disabled={previewCommitLocked}
                            onChange={(event) =>
                              handleRepairSelection({
                                ...repairSelections,
                              headerSelection: event.currentTarget.value as ImportHeaderSelection,
                            })
                          }
                        >
                          <option value="" disabled>
                            Select and confirm a repair choice
                          </option>
                          <option value="first-row-header">{formatHeaderSelection('first-row-header')}</option>
                          <option value="first-row-data">{formatHeaderSelection('first-row-data')}</option>
                        </select>
                      </label>
                    ) : null}

                    {diagnostics.category === 'column-type' ? (
                      <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                        <span>{`Confirmed type for ${String(diagnostics.sourceName ?? diagnostics.columnId ?? 'column')}`}</span>
                        <select
                          aria-label={`Confirmed type for ${String(diagnostics.sourceName ?? diagnostics.columnId ?? 'column')}`}
                          value={repairSelections.columnTypeOverrides[String(diagnostics.columnId)] ?? ''}
                          disabled={previewCommitLocked}
                          onChange={(event) =>
                            handleRepairSelection({
                              ...repairSelections,
                              columnTypeOverrides: {
                                ...repairSelections.columnTypeOverrides,
                                [String(diagnostics.columnId)]: event.currentTarget.value as 'text' | 'numeric' | 'date',
                              },
                            })
                          }
                        >
                          <option value="" disabled>
                            Select and confirm a repair choice
                          </option>
                          <option value="text">Text</option>
                          <option value="numeric">Numeric</option>
                          <option value="date">Date</option>
                        </select>
                      </label>
                    ) : null}

                    {diagnostics.category === 'missing-values' ? (
                      <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                        <span>Missing-value handling</span>
                        <select
                          aria-label="Missing-value handling"
                          value={repairSelections.missingValuePolicy ?? ''}
                          disabled={previewCommitLocked}
                          onChange={(event) =>
                            handleRepairSelection({
                              ...repairSelections,
                              missingValuePolicy: event.currentTarget.value as ImportMissingValuePolicy,
                            })
                          }
                        >
                          <option value="" disabled>
                            Select and confirm a repair choice
                          </option>
                          <option value="mark-empty">{formatMissingValuePolicy('mark-empty')}</option>
                          <option value="drop-invalid-rows">{formatMissingValuePolicy('drop-invalid-rows')}</option>
                        </select>
                      </label>
                    ) : null}

                    {diagnostics.category === 'additional-columns' ? (
                      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <span>
                          Additional columns: {String((diagnostics.additionalColumns as string[] | undefined)?.join(', ') ?? '')}
                        </span>
                        <button
                          type="button"
                          disabled={previewCommitLocked}
                          onClick={() =>
                            handleRepairSelection({
                              ...repairSelections,
                              additionalColumnsAcknowledgement: String(diagnostics.acknowledgementToken ?? ''),
                            })
                          }
                        >
                          Acknowledge additional columns
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                No repair cards are open. This preview is ready for confirmation.
              </p>
            )}
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

        </>
      ) : null}
    </section>
  );
}
