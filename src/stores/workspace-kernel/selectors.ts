import type { PersistedDatasetFileHandle } from '../../services/persistence';
import { selectReadinessSummary } from '../../domain/readiness';
import { createSemanticSummary, isConfirmedSemanticDataset } from '../../features/semantics/semantic-model';
import {
  selectCompatibilityState,
  selectIssueState,
  selectRepairEntryPoints,
  selectTelemetrySummary,
} from '../../domain/trust';
import type { WorkspaceKernelData } from './types';

function clonePersistedDatasetFileHandle(entry: PersistedDatasetFileHandle): PersistedDatasetFileHandle {
  return {
    ...entry,
  };
}

export function selectActiveGraphId(data: WorkspaceKernelData) {
  return data.snapshot.activeGraphId;
}

export function selectReferenceGraphId(data: WorkspaceKernelData) {
  return data.snapshot.referenceGraphId;
}

export function selectActiveDataset(data: WorkspaceKernelData) {
  const activeGraph = data.snapshot.graphDefinitions.find((graph) => graph.graphId === data.snapshot.activeGraphId);
  const datasetId = activeGraph?.datasetId ?? data.snapshot.datasets[0]?.datasetId;

  return data.snapshot.datasets.find((dataset) => dataset.datasetId === datasetId) ?? null;
}

export function selectActiveDatasetColumns(data: WorkspaceKernelData) {
  return structuredClone(selectActiveDataset(data)?.columns ?? []);
}

export function selectGraphReadySemanticSummary(data: WorkspaceKernelData) {
  const activeDataset = selectActiveDataset(data);

  return createSemanticSummary(isConfirmedSemanticDataset(activeDataset) ? activeDataset : null, data.snapshot.issues);
}

export function selectPersistedDatasetFileHandles(data: WorkspaceKernelData) {
  return data.datasetFileHandles.map((entry) => clonePersistedDatasetFileHandle(entry));
}

export function selectPersistedWorkspace(data: WorkspaceKernelData) {
  return structuredClone(data.snapshot);
}

export function selectKernelIssueState(data: WorkspaceKernelData) {
  return selectIssueState(data.snapshot);
}

export function selectKernelRepairEntryPoints(data: WorkspaceKernelData) {
  return selectRepairEntryPoints(data.snapshot);
}

export function selectKernelReadinessSummary(data: WorkspaceKernelData) {
  return selectReadinessSummary(data.snapshot);
}

export function selectKernelTelemetrySummary(data: WorkspaceKernelData) {
  return selectTelemetrySummary(data.snapshot);
}

export function selectKernelCompatibilityState(data: WorkspaceKernelData) {
  return selectCompatibilityState(data.snapshot);
}
