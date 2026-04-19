import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { compareSemver, matchesVersionRange } from '../../lib/semver';

export interface IssueState {
  total: number;
  open: number;
  resolved: number;
  blocking: number;
  warning: number;
  info: number;
  openIssueIds: string[];
  blockingIssueIds: string[];
  warningIssueIds: string[];
}

export type TelemetrySummary = WorkspaceSnapshot['telemetrySnapshot'] & {
  hasPendingQueue: boolean;
};

export interface CompatibilityState {
  workspaceFormatVersion: string;
  appBuildVersion: string;
  minReadableAppBuild: string;
  maxTestedAppBuild: string;
  isReadable: boolean;
  isTested: boolean;
}

export interface RepairEntryPointSummary {
  issueId: string;
  kind: string;
  status: WorkspaceSnapshot['issues'][number]['status'];
  severity: WorkspaceSnapshot['issues'][number]['severity'];
  entityType: string;
  entityId: string;
  graphId?: string;
  panel?: string;
  scopeLabel: string;
  impactLabel: string;
  repairActions: WorkspaceSnapshot['issues'][number]['repairActions'];
}

const scopeLabelByEntityType: Record<string, string> = {
  dataset: 'Dataset',
  evidence: 'Evidence',
  formula: 'Formula',
  graph: 'Graph',
  'issue-record': 'Saved issue record',
  ledger: 'Ledger entry',
  transform: 'Transform',
  workspace: 'Workspace',
};

export function selectIssueState(snapshot: WorkspaceSnapshot): IssueState {
  const openIssues = snapshot.issues.filter((issue) => issue.status !== 'resolved');
  const blockingIssues = openIssues.filter((issue) => issue.severity === 'blocking');
  const warningIssues = openIssues.filter((issue) => issue.severity === 'warning');
  const infoIssues = openIssues.filter((issue) => issue.severity === 'info');

  return {
    total: snapshot.issues.length,
    open: openIssues.length,
    resolved: snapshot.issues.length - openIssues.length,
    blocking: blockingIssues.length,
    warning: warningIssues.length,
    info: infoIssues.length,
    openIssueIds: openIssues.map((issue) => issue.issueId),
    blockingIssueIds: blockingIssues.map((issue) => issue.issueId),
    warningIssueIds: warningIssues.map((issue) => issue.issueId),
  };
}

export function selectRepairEntryPoints(snapshot: WorkspaceSnapshot): RepairEntryPointSummary[] {
  return snapshot.issues
    .filter((issue) => issue.status !== 'resolved')
    .map((issue) => {
      const scopePrefix = scopeLabelByEntityType[issue.source.entityType] ?? 'Item';
      const scopeLabel =
        issue.source.entityType === 'workspace'
          ? 'Workspace'
          : `${scopePrefix} ${issue.source.entityId}`;

      return {
        issueId: issue.issueId,
        kind: issue.kind,
        status: issue.status,
        severity: issue.severity,
        entityType: issue.source.entityType,
        entityId: issue.source.entityId,
        ...(issue.contextRef.graphId ? { graphId: issue.contextRef.graphId } : {}),
        ...(issue.contextRef.panel ? { panel: issue.contextRef.panel } : {}),
        scopeLabel,
        impactLabel: issue.userMessage,
        repairActions: issue.repairActions,
      };
    });
}

export function selectTelemetrySummary(snapshot: WorkspaceSnapshot): TelemetrySummary {
  return {
    ...snapshot.telemetrySnapshot,
    hasPendingQueue:
      snapshot.telemetrySnapshot.offlineQueueDepth > 0 || snapshot.telemetrySnapshot.status === 'queued',
  };
}

export function selectCompatibilityState(snapshot: WorkspaceSnapshot): CompatibilityState {
  const hasOpenCompatibilityBlock = snapshot.issues.some(
    (issue) => issue.status !== 'resolved' && issue.kind === 'workspace.reopen.compatibility.blocked',
  );

  return {
    workspaceFormatVersion: snapshot.workspaceFormatVersion,
    appBuildVersion: snapshot.appBuildVersion,
    minReadableAppBuild: snapshot.compatibility.minReadableAppBuild,
    maxTestedAppBuild: snapshot.compatibility.maxTestedAppBuild,
    isReadable:
      !hasOpenCompatibilityBlock &&
      compareSemver(snapshot.appBuildVersion, snapshot.compatibility.minReadableAppBuild) >= 0,
    isTested:
      !hasOpenCompatibilityBlock &&
      matchesVersionRange(snapshot.appBuildVersion, snapshot.compatibility.maxTestedAppBuild),
  };
}
