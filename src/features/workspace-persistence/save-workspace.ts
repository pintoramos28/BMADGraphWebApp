import type { PersistedDatasetFileHandle, WorkspaceRepository } from '../../services/persistence';
import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';
import { synchronizeDatasetSourceFileMetadata } from '../../stores/workspace-kernel/dataset-file-handle-metadata';

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
  const snapshot = state.selectors.persistedWorkspace();
  const snapshotToSave =
    datasetFileHandles.length > 0
      ? synchronizeDatasetSourceFileMetadata(snapshot, datasetFileHandles)
      : snapshot;
  const saveResult = await input.repository.saveCanonicalWorkspace({
    snapshot: snapshotToSave,
    ledger: structuredClone(state.ledger),
    savedAt: input.savedAt ?? new Date().toISOString(),
    ...((input.datasetFileHandles !== undefined || datasetFileHandles.length > 0)
      ? { datasetFileHandles }
      : {}),
    ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
  });

  if (input.datasetFileHandles !== undefined) {
    input.kernelStore.getState().commands.replaceDatasetFileHandles(input.datasetFileHandles);
  }

  return saveResult;
}
