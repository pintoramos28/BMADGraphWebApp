import { describe, expect, it } from 'vitest';

import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { issueRecordFixture } from '../../test/fixtures/workspace/issue-record.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import { selectIssueState, selectRepairEntryPoints } from './selectors';

describe('trust selectors', () => {
  it('keeps deferred reopen issues visible through repair entry selectors', () => {
    const deferredIssue = {
      ...structuredClone(issueRecordFixture),
      issueId: 'workspace.reopen.010',
      kind: 'workspace.reopen.formula.missing-dependency',
      status: 'deferred' as const,
      severity: 'warning' as const,
      source: {
        module: 'workspace-persistence',
        entityType: 'formula',
        entityId: 'fm_missing_dependency',
      },
      title: 'A saved formula references unavailable dependencies',
      detail: 'Formula "fm_missing_dependency" depends on columns that are unavailable in the reopened workspace.',
      userMessage: 'One saved formula references unavailable dependencies and was excluded from reopen state.',
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: workspaceSnapshotFixture.workspaceId,
        panel: 'repair',
      },
      repairActions: [
        {
          actionId: 'repair.focusIssue',
          label: 'Open repair card',
          command: 'repair.focusIssue',
          args: {
            issueId: 'workspace.reopen.010',
          },
        },
        {
          actionId: 'repair.focusFormula',
          label: 'Inspect formula',
          command: 'repair.focusFormula',
          args: {
            formulaId: 'fm_missing_dependency',
          },
        },
      ],
      diagnostics: {
        formulaId: 'fm_missing_dependency',
        missingDependencies: ['missingColumn'],
      },
    };
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      issues: [deferredIssue],
      readiness: {
        status: 'warning',
        blockingIssueIds: [],
        warningIssueIds: ['workspace.reopen.010'],
        provenanceCompleteness: 'complete',
      },
    };

    expect(selectIssueState(snapshot)).toMatchObject({
      open: 1,
      warning: 1,
      openIssueIds: ['workspace.reopen.010'],
    });
    expect(selectRepairEntryPoints(snapshot)).toEqual([
      expect.objectContaining({
        issueId: 'workspace.reopen.010',
        status: 'deferred',
        entityType: 'formula',
        entityId: 'fm_missing_dependency',
        scopeLabel: 'Formula fm_missing_dependency',
        impactLabel: 'One saved formula references unavailable dependencies and was excluded from reopen state.',
        repairActions: expect.arrayContaining([
          expect.objectContaining({
            command: 'repair.focusFormula',
          }),
        ]),
      }),
    ]);
  });
});
