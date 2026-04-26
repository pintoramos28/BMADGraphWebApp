import type { PersistedDatasetFileHandle, WorkspaceRepository } from '../../services/persistence';
import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';
import { synchronizeDatasetSourceFileMetadata } from '../../stores/workspace-kernel/dataset-file-handle-metadata';
import { preparePersistedDatasetFileHandlesForSave } from './persisted-dataset-file-handles';
import { markWorkspaceKernelStorePersisted } from './workspace-kernel-persistence-state';

interface SaveWorkspaceKernelInput {
  repository: WorkspaceRepository;
  kernelStore: WorkspaceKernelStore;
  savedAt?: string;
  datasetFileHandles?: PersistedDatasetFileHandle[];
  requireDatasetFileHandles?: boolean;
  requiredDatasetFileHandleDatasetIds?: string[];
  benchmarkKey?: string;
  persistenceTimeoutMs?: number;
}

export const WORKSPACE_SAVE_PERSISTENCE_TIMEOUT_MS = 30_000;

const datasetFileHandleObjectIdentities = new WeakMap<object, number>();
let nextDatasetFileHandleObjectIdentity = 1;

function createSaveAbortError(signal: AbortSignal | undefined) {
  return signal?.reason instanceof Error ? signal.reason : new Error('Workspace persistence was aborted.');
}

async function awaitSaveWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  shouldRaceAbort: (reason: unknown) => boolean = () => true,
) {
  const observedOperation = operation.catch((error) => {
    throw error;
  });

  observedOperation.catch(() => {
    // The abort race can settle before a non-cooperative repository eventually
    // rejects. Keep observing that late rejection so it does not leak as an
    // unhandled promise rejection after the caller has already recovered.
  });

  if (!signal) {
    return observedOperation;
  }

  let cleanup = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    let abortQueued = false;
    const rejectIfAborted = () => {
      if (!shouldRaceAbort(signal.reason) || abortQueued) {
        return;
      }

      abortQueued = true;
      void Promise.resolve().then(() => {
        reject(createSaveAbortError(signal));
      });
    };

    if (signal.aborted) {
      rejectIfAborted();
    }

    signal.addEventListener('abort', rejectIfAborted, { once: true });
    cleanup = () => signal.removeEventListener('abort', rejectIfAborted);
  });

  try {
    return await Promise.race([observedOperation, cancellation]);
  } finally {
    cleanup();
  }
}

function getDatasetFileHandleObjectIdentity(handle: PersistedDatasetFileHandle['handle']) {
  const handleObject = handle as object;
  const existingIdentity = datasetFileHandleObjectIdentities.get(handleObject);

  if (existingIdentity !== undefined) {
    return existingIdentity;
  }

  const identity = nextDatasetFileHandleObjectIdentity;
  nextDatasetFileHandleObjectIdentity += 1;
  datasetFileHandleObjectIdentities.set(handleObject, identity);

  return identity;
}

function datasetFileHandleConcurrencySignature(datasetFileHandles: PersistedDatasetFileHandle[]) {
  return JSON.stringify(
    datasetFileHandles
      .map((entry) => ({
        datasetId: entry.datasetId,
        fileName: entry.fileName,
        fileHandleToken: entry.fileHandleToken,
        fileSize: entry.fileSize ?? null,
        fileLastModified: entry.fileLastModified ?? null,
        fileSha256: entry.fileSha256 ?? null,
        handleName: entry.handle.name,
        handleObjectIdentity: getDatasetFileHandleObjectIdentity(entry.handle),
      }))
      .sort((left, right) =>
        left.datasetId.localeCompare(right.datasetId)
        || left.fileHandleToken.localeCompare(right.fileHandleToken)
        || left.fileName.localeCompare(right.fileName),
      ),
  );
}

function datasetSourceFileConcurrencySignature(state: ReturnType<WorkspaceKernelStore['getState']>) {
  return JSON.stringify(
    state.snapshot.datasets
      .map((dataset) => ({
        datasetId: dataset.datasetId,
        fileName: dataset.sourceFile?.fileName ?? null,
        fileHandleToken: dataset.sourceFile?.fileHandleToken ?? null,
      }))
      .sort((left, right) => left.datasetId.localeCompare(right.datasetId)),
  );
}

function hasRequiredDatasetSourceFileHandle(
  snapshot: ReturnType<WorkspaceKernelStore['getState']>['snapshot'],
  datasetId: string,
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  const dataset = snapshot.datasets.find((candidate) => candidate.datasetId === datasetId);

  if (!dataset?.sourceFile) {
    return false;
  }

  return datasetFileHandles.some((entry) =>
    entry.datasetId === datasetId
    && entry.fileName === dataset.sourceFile?.fileName
    && entry.fileHandleToken === dataset.sourceFile?.fileHandleToken,
  );
}

function retainDatasetFileHandlesForSaveSnapshot(
  snapshot: ReturnType<WorkspaceKernelStore['getState']>['snapshot'],
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  return datasetFileHandles.filter((entry) => {
    const dataset = snapshot.datasets.find((candidate) => candidate.datasetId === entry.datasetId);

    if (!dataset) {
      return false;
    }

    if (!dataset.sourceFile) {
      return false;
    }

    const hasCurrentSourceHandle = datasetFileHandles.some((candidate) =>
      candidate.datasetId === dataset.datasetId
      && candidate.fileName === dataset.sourceFile?.fileName
      && candidate.fileHandleToken === dataset.sourceFile?.fileHandleToken,
    );

    if (!hasCurrentSourceHandle) {
      return false;
    }

    return entry.fileName === dataset.sourceFile.fileName
      && entry.fileHandleToken === dataset.sourceFile.fileHandleToken;
  });
}

export async function saveWorkspaceKernel(input: SaveWorkspaceKernelInput) {
  const state = input.kernelStore.getState();
  const workspaceVersion = state.workspaceVersion;
  const liveDatasetFileHandles = state.selectors.datasetFileHandles();
  const datasetFileHandles = input.datasetFileHandles ?? liveDatasetFileHandles;
  const liveDatasetFileHandleSignature = datasetFileHandleConcurrencySignature(liveDatasetFileHandles);
  const datasetSourceFileSignature = datasetSourceFileConcurrencySignature(state);
  const snapshot = state.selectors.persistedWorkspace();
  const ledger = structuredClone(state.ledger);
  const staleSaveError = new Error('Workspace changed while save was in progress. Save the workspace again to persist the latest changes.');
  const persistenceTimeoutError = new Error('Workspace persistence did not respond before the safety timeout. Try confirming or saving again.');

  const assertWorkspaceVersionUnchanged = () => {
    const currentState = input.kernelStore.getState();

    if (
      currentState.workspaceVersion !== workspaceVersion
      || datasetFileHandleConcurrencySignature(currentState.selectors.datasetFileHandles()) !== liveDatasetFileHandleSignature
      || datasetSourceFileConcurrencySignature(currentState) !== datasetSourceFileSignature
    ) {
      throw staleSaveError;
    }
  };
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const persistenceTimeoutMs = input.persistenceTimeoutMs ?? WORKSPACE_SAVE_PERSISTENCE_TIMEOUT_MS;
  const timeoutId = abortController && Number.isFinite(persistenceTimeoutMs) && persistenceTimeoutMs > 0
    ? setTimeout(() => {
      abortController.abort(persistenceTimeoutError);
    }, persistenceTimeoutMs)
    : null;
  const unsubscribe = input.kernelStore.subscribe(() => {
    if (abortController?.signal.aborted) {
      return;
    }

    try {
      assertWorkspaceVersionUnchanged();
    } catch {
      abortController?.abort(staleSaveError);
    }
  });

  try {
    const preparedDatasetFileHandlesForInput = datasetFileHandles.length > 0
      ? await preparePersistedDatasetFileHandlesForSave(datasetFileHandles, {
        signal: abortController?.signal,
        assertNotStale: assertWorkspaceVersionUnchanged,
      })
      : [];
    const preparedDatasetFileHandles = retainDatasetFileHandlesForSaveSnapshot(snapshot, preparedDatasetFileHandlesForInput);

    assertWorkspaceVersionUnchanged();

    const requiredDatasetFileHandleDatasetIds = new Set(
      input.requiredDatasetFileHandleDatasetIds
        ?? (input.requireDatasetFileHandles ? datasetFileHandles.map((entry) => entry.datasetId) : []),
    );
    const isMissingRequiredDatasetFileHandle = requiredDatasetFileHandleDatasetIds.size > 0
      ? Array.from(requiredDatasetFileHandleDatasetIds).some(
        (datasetId) => !hasRequiredDatasetSourceFileHandle(snapshot, datasetId, preparedDatasetFileHandles),
      )
      : input.requireDatasetFileHandles === true && datasetFileHandles.length === 0;

    if (isMissingRequiredDatasetFileHandle) {
      throw new Error('Source file provenance could not be verified for this workspace save. Reselect the source file and confirm again.');
    }

    const snapshotToSave = synchronizeDatasetSourceFileMetadata(snapshot, preparedDatasetFileHandles);
    const saveResult = await awaitSaveWithAbort(input.repository.saveCanonicalWorkspace({
      snapshot: snapshotToSave,
      ledger,
      savedAt: input.savedAt ?? new Date().toISOString(),
      abortSignal: abortController?.signal,
      assertNotStale: assertWorkspaceVersionUnchanged,
      ...(requiredDatasetFileHandleDatasetIds.size > 0
        ? { requiredDatasetFileHandleDatasetIds: Array.from(requiredDatasetFileHandleDatasetIds) }
        : {}),
      ...((input.datasetFileHandles !== undefined || preparedDatasetFileHandles.length > 0 || datasetFileHandles.length > 0)
        ? { datasetFileHandles: preparedDatasetFileHandles }
        : {}),
      ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
    }), abortController?.signal);
    const finalDatasetFileHandles = saveResult.datasetFileHandles ?? preparedDatasetFileHandles;

    const isMissingFinalRequiredDatasetFileHandle = Array.from(requiredDatasetFileHandleDatasetIds).some(
      (datasetId) => !hasRequiredDatasetSourceFileHandle(saveResult.snapshot, datasetId, finalDatasetFileHandles),
    );

    if (isMissingFinalRequiredDatasetFileHandle) {
      throw new Error('Source file provenance could not be verified for this workspace save. Reselect the source file and confirm again.');
    }

    let workspaceUnchangedAfterSave = true;

    try {
      assertWorkspaceVersionUnchanged();
    } catch {
      workspaceUnchangedAfterSave = false;
    }

    if (workspaceUnchangedAfterSave && (
      input.datasetFileHandles !== undefined
      || preparedDatasetFileHandles.length !== datasetFileHandles.length
      || finalDatasetFileHandles.length !== preparedDatasetFileHandles.length
      || snapshotToSave !== snapshot
    )) {
      input.kernelStore.getState().commands.replaceDatasetFileHandles(finalDatasetFileHandles);
    }

    if (workspaceUnchangedAfterSave) {
      markWorkspaceKernelStorePersisted(input.kernelStore, workspaceVersion);
    }

    return saveResult;
  } catch (error) {
    if (error === persistenceTimeoutError) {
      throw persistenceTimeoutError;
    }

    if (abortController?.signal.aborted) {
      if (abortController.signal.reason === persistenceTimeoutError) {
        throw persistenceTimeoutError;
      }

      throw staleSaveError;
    }

    throw error;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    unsubscribe();
  }
}
