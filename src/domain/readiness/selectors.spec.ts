import { describe, expect, it } from 'vitest';

import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import { selectReadinessSummary } from './selectors';

describe('selectReadinessSummary', () => {
  it('preserves explicitly blocked readiness even without blocking issue ids', () => {
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      readiness: {
        status: 'blocked',
        blockingIssueIds: [],
        warningIssueIds: [],
        provenanceCompleteness: 'complete',
      },
    };

    expect(selectReadinessSummary(snapshot).status).toBe('blocked');
  });
});
