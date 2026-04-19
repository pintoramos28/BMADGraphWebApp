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

  it('adds explicit scope labels for ledger and saved issue-record failures', () => {
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      issues: [
        {
          ...structuredClone(issueRecordFixture),
          issueId: 'workspace.reopen.011',
          kind: 'workspace.reopen.ledger.invalid-order',
          severity: 'warning',
          source: {
            module: 'workspace-persistence',
            entityType: 'ledger',
            entityId: 'led_004_invalid',
          },
          title: 'Saved history contains out-of-order entries',
          detail: 'Ledger entry led_004_invalid is out of sequence and was excluded from the reopened workspace history.',
          userMessage: 'Some saved history entries were out of order and were excluded from reopen history.',
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
                issueId: 'workspace.reopen.011',
              },
            },
          ],
          diagnostics: {
            ledgerEntryId: 'led_004_invalid',
          },
        },
        {
          ...structuredClone(issueRecordFixture),
          issueId: 'workspace.reopen.012',
          kind: 'workspace.reopen.issue.invalid-contract',
          severity: 'warning',
          source: {
            module: 'workspace-persistence',
            entityType: 'issue-record',
            entityId: 'reopen.issue.001',
          },
          title: 'A saved issue record could not be reopened',
          detail: 'Issue entry 1 is invalid and was excluded from the reopened workspace.',
          userMessage: 'One saved issue record could not be reopened.',
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
                issueId: 'workspace.reopen.012',
              },
            },
          ],
          diagnostics: {
            index: 0,
          },
        },
      ],
    };

    expect(selectRepairEntryPoints(snapshot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'workspace.reopen.011',
          scopeLabel: 'Ledger entry led_004_invalid',
        }),
        expect.objectContaining({
          issueId: 'workspace.reopen.012',
          scopeLabel: 'Saved issue record reopen.issue.001',
        }),
      ]),
    );
  });
});
