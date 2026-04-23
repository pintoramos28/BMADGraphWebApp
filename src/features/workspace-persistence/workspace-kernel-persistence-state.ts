import type { WorkspaceKernelStore } from '../../stores/workspace-kernel';

const persistedWorkspaceVersionByStore = new WeakMap<WorkspaceKernelStore, number>();

export function markWorkspaceKernelStorePersisted(
  store: WorkspaceKernelStore,
  workspaceVersion: number = store.getState().workspaceVersion,
) {
  persistedWorkspaceVersionByStore.set(store, workspaceVersion);
}

export function getPersistedWorkspaceKernelVersion(store: WorkspaceKernelStore) {
  return persistedWorkspaceVersionByStore.get(store);
}
