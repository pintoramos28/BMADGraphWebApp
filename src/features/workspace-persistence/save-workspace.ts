import type { WorkspaceRepository } from '../../services/persistence';
import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';

interface SaveWorkspaceKernelInput {
  repository: WorkspaceRepository;
  kernelStore: WorkspaceKernelStore;
  savedAt?: string;
  benchmarkKey?: string;
}

export async function saveWorkspaceKernel(input: SaveWorkspaceKernelInput) {
  const state = input.kernelStore.getState();

  return input.repository.saveCanonicalWorkspace({
    snapshot: state.selectors.persistedWorkspace(),
    ledger: structuredClone(state.ledger),
    savedAt: input.savedAt ?? new Date().toISOString(),
    ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
  });
}
