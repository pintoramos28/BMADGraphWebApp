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
  benchmarkKey?: string;
}

export async function saveWorkspaceKernel(input: SaveWorkspaceKernelInput) {
  const state = input.kernelStore.getState();
  const datasetFileHandles = input.datasetFileHandles ?? state.selectors.datasetFileHandles();
  const preparedDatasetFileHandles =
    datasetFileHandles.length > 0 ? await preparePersistedDatasetFileHandlesForSave(datasetFileHandles) : [];
  const snapshot = state.selectors.persistedWorkspace();
  const snapshotToSave =
    preparedDatasetFileHandles.length > 0
      ? synchronizeDatasetSourceFileMetadata(snapshot, preparedDatasetFileHandles)
      : snapshot;
  const saveResult = await input.repository.saveCanonicalWorkspace({
    snapshot: snapshotToSave,
    ledger: structuredClone(state.ledger),
    savedAt: input.savedAt ?? new Date().toISOString(),
    ...((input.datasetFileHandles !== undefined || preparedDatasetFileHandles.length > 0)
      ? { datasetFileHandles: preparedDatasetFileHandles }
      : {}),
    ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
  });

  if (input.datasetFileHandles !== undefined || preparedDatasetFileHandles.length !== datasetFileHandles.length) {
    input.kernelStore.getState().commands.replaceDatasetFileHandles(preparedDatasetFileHandles);
  }

  markWorkspaceKernelStorePersisted(input.kernelStore);

  return saveResult;
}
