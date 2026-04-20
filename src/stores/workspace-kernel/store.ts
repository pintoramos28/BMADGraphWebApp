import { createStore } from 'zustand/vanilla';

import { validateLedgerOrdering, initializeWorkspaceVersion } from './events';
import {
  applyWorkerEnvelopeReducer,
  promoteReferenceGraphReducer,
  queueWorkerRequestReducer,
  replaceDatasetFileHandlesReducer,
  replaceIssuesReducer,
  replaceSnapshotReducer,
  updateTelemetrySnapshotReducer,
} from './reducers';
import {
  selectActiveGraphId,
  selectKernelCompatibilityState,
  selectPersistedDatasetFileHandles,
  selectKernelIssueState,
  selectKernelRepairEntryPoints,
  selectKernelReadinessSummary,
  selectKernelTelemetrySummary,
  selectPersistedWorkspace,
  selectReferenceGraphId,
} from './selectors';
import type {
  WorkspaceKernelData,
  WorkspaceKernelState,
  WorkspaceKernelStoreOptions,
} from './types';
import { workspaceSnapshotSchema } from '../../schemas/workspace';
import type { PersistedDatasetFileHandle } from '../../services/persistence';

function clonePersistedDatasetFileHandle(entry: PersistedDatasetFileHandle): PersistedDatasetFileHandle {
  return {
    ...entry,
  };
}

function toKernelData(state: WorkspaceKernelState): WorkspaceKernelData {
  return {
    snapshot: state.snapshot,
    ledger: state.ledger,
    datasetFileHandles: state.datasetFileHandles.map((entry) => clonePersistedDatasetFileHandle(entry)),
    workspaceVersion: state.workspaceVersion,
    pendingWorkerRequests: state.pendingWorkerRequests,
  };
}

function initializeKernelData(options: WorkspaceKernelStoreOptions): WorkspaceKernelData {
  const snapshot = workspaceSnapshotSchema.parse(options.snapshot);
  const ledger = options.ledger ? [...options.ledger] : [];

  validateLedgerOrdering(ledger);

  return {
    snapshot,
    ledger,
    datasetFileHandles: (options.datasetFileHandles ?? []).map((entry) => clonePersistedDatasetFileHandle(entry)),
    workspaceVersion: initializeWorkspaceVersion(ledger),
    pendingWorkerRequests: {},
  };
}

export function createWorkspaceKernelStore(options: WorkspaceKernelStoreOptions) {
  const initialData = initializeKernelData(options);

  return createStore<WorkspaceKernelState>((set, get) => ({
    ...initialData,
    commands: {
      replaceSnapshot(input) {
        set((state) => replaceSnapshotReducer(toKernelData(state), input));
      },
      replaceDatasetFileHandles(datasetFileHandles) {
        set((state) => replaceDatasetFileHandlesReducer(toKernelData(state), datasetFileHandles));
      },
      promoteReferenceGraph(input) {
        set((state) => promoteReferenceGraphReducer(toKernelData(state), input));
      },
      replaceIssues(issues, meta) {
        set((state) => replaceIssuesReducer(toKernelData(state), issues, meta));
      },
      updateTelemetrySnapshot(telemetrySnapshot, meta) {
        set((state) => updateTelemetrySnapshotReducer(toKernelData(state), telemetrySnapshot, meta));
      },
      queueWorkerRequest(input) {
        set((state) => queueWorkerRequestReducer(toKernelData(state), input));
      },
      applyWorkerEnvelope(message, apply) {
        const { nextData, result } = applyWorkerEnvelopeReducer(toKernelData(get()), message, apply);
        set(nextData);

        return result;
      },
    },
    selectors: {
      activeGraphId() {
        return selectActiveGraphId(toKernelData(get()));
      },
      referenceGraphId() {
        return selectReferenceGraphId(toKernelData(get()));
      },
      datasetFileHandles() {
        return selectPersistedDatasetFileHandles(toKernelData(get()));
      },
      issueState() {
        return selectKernelIssueState(toKernelData(get()));
      },
      repairEntryPoints() {
        return selectKernelRepairEntryPoints(toKernelData(get()));
      },
      readinessSummary() {
        return selectKernelReadinessSummary(toKernelData(get()));
      },
      telemetrySnapshot() {
        return selectKernelTelemetrySummary(toKernelData(get()));
      },
      compatibilityState() {
        return selectKernelCompatibilityState(toKernelData(get()));
      },
      persistedWorkspace() {
        return selectPersistedWorkspace(toKernelData(get()));
      },
    },
  }));
}
