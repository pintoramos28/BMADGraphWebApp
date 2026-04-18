import { selectReadinessSummary } from '../../domain/readiness';
import {
  selectCompatibilityState,
  selectIssueState,
  selectRepairEntryPoints,
  selectTelemetrySummary,
} from '../../domain/trust';
import type { WorkspaceKernelData } from './types';

export function selectActiveGraphId(data: WorkspaceKernelData) {
  return data.snapshot.activeGraphId;
}

export function selectReferenceGraphId(data: WorkspaceKernelData) {
  return data.snapshot.referenceGraphId;
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
