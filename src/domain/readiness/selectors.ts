import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { selectIssueState } from '../trust';

export interface ReadinessSummary {
  status: 'ready' | 'warning' | 'blocked';
  blockingIssueCount: number;
  warningIssueCount: number;
  provenanceCompleteness: WorkspaceSnapshot['readiness']['provenanceCompleteness'];
  activeGraphId: string;
  referenceGraphId: string;
}

export function selectReadinessSummary(snapshot: WorkspaceSnapshot): ReadinessSummary {
  const issueState = selectIssueState(snapshot);
  const blockingIssueIds = new Set([
    ...snapshot.readiness.blockingIssueIds,
    ...issueState.blockingIssueIds,
  ]);
  const warningIssueIds = new Set([
    ...snapshot.readiness.warningIssueIds,
    ...issueState.warningIssueIds,
  ]);

  const status: ReadinessSummary['status'] =
    snapshot.readiness.status === 'blocked' || blockingIssueIds.size > 0
      ? 'blocked'
      : warningIssueIds.size > 0 ||
          snapshot.readiness.status === 'warning' ||
          snapshot.readiness.provenanceCompleteness !== 'complete'
        ? 'warning'
        : 'ready';

  return {
    status,
    blockingIssueCount: blockingIssueIds.size,
    warningIssueCount: warningIssueIds.size,
    provenanceCompleteness: snapshot.readiness.provenanceCompleteness,
    activeGraphId: snapshot.activeGraphId,
    referenceGraphId: snapshot.referenceGraphId,
  };
}
