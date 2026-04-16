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

export function selectTelemetrySummary(snapshot: WorkspaceSnapshot): TelemetrySummary {
  return {
    ...snapshot.telemetrySnapshot,
    hasPendingQueue:
      snapshot.telemetrySnapshot.offlineQueueDepth > 0 || snapshot.telemetrySnapshot.status === 'queued',
  };
}

export function selectCompatibilityState(snapshot: WorkspaceSnapshot): CompatibilityState {
  return {
    workspaceFormatVersion: snapshot.workspaceFormatVersion,
    appBuildVersion: snapshot.appBuildVersion,
    minReadableAppBuild: snapshot.compatibility.minReadableAppBuild,
    maxTestedAppBuild: snapshot.compatibility.maxTestedAppBuild,
    isReadable: compareSemver(snapshot.appBuildVersion, snapshot.compatibility.minReadableAppBuild) >= 0,
    isTested: matchesVersionRange(snapshot.appBuildVersion, snapshot.compatibility.maxTestedAppBuild),
  };
}
