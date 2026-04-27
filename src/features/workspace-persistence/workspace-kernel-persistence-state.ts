import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';

const persistedWorkspaceVersionByStore = new WeakMap<WorkspaceKernelStore, number>();
const pendingSemanticWorkspaceSaveByStore = new WeakMap<WorkspaceKernelStore, PendingSemanticWorkspaceSave>();

export const WORKSPACE_PENDING_SEMANTIC_SAVE_MESSAGE =
  'Workspace save is waiting for an in-progress semantic save to finish.';

export interface PendingSemanticWorkspaceSave {
  correlationId: string;
  workspaceVersion: number;
}

export function markWorkspaceKernelStorePersisted(
  store: WorkspaceKernelStore,
  workspaceVersion: number = store.getState().workspaceVersion,
) {
  persistedWorkspaceVersionByStore.set(store, workspaceVersion);
}

export function getPersistedWorkspaceKernelVersion(store: WorkspaceKernelStore) {
  return persistedWorkspaceVersionByStore.get(store);
}

export function markSemanticWorkspaceSavePending(
  store: WorkspaceKernelStore,
  pendingSave: PendingSemanticWorkspaceSave,
) {
  const existingPendingSave = pendingSemanticWorkspaceSaveByStore.get(store);

  if (existingPendingSave && existingPendingSave.correlationId !== pendingSave.correlationId) {
    throw new Error(WORKSPACE_PENDING_SEMANTIC_SAVE_MESSAGE);
  }

  pendingSemanticWorkspaceSaveByStore.set(store, pendingSave);
}

export function clearSemanticWorkspaceSavePending(
  store: WorkspaceKernelStore,
  correlationId?: string | undefined,
) {
  const pendingSave = pendingSemanticWorkspaceSaveByStore.get(store);

  if (!pendingSave) {
    return;
  }

  if (correlationId === undefined || pendingSave.correlationId === correlationId) {
    pendingSemanticWorkspaceSaveByStore.delete(store);
  }
}

export function getPendingSemanticWorkspaceSave(store: WorkspaceKernelStore) {
  return pendingSemanticWorkspaceSaveByStore.get(store);
}
