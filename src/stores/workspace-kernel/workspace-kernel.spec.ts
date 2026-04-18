import { describe, expect, it } from 'vitest';

import type { GraphDefinition, WorkspaceSnapshot } from '../../schemas/workspace';
import { workspaceSnapshotSchema } from '../../schemas/workspace';
import { graphDefinitionFixture } from '../../test/fixtures/workspace/graph-definition.fixture';
import { issueRecordFixture } from '../../test/fixtures/workspace/issue-record.fixture';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import { createViewStateStore } from '../view-state';
import { createWorkspaceKernelStore } from './store';

function createSnapshotWithSecondaryGraph() {
  const snapshot: WorkspaceSnapshot = structuredClone(workspaceSnapshotFixture);
  const secondaryGraph = {
    ...graphDefinitionFixture,
    graphId: 'graph_scatter_secondary',
    title: 'Secondary Graph',
    status: 'candidate',
    evidenceIds: [],
    issueIds: [],
  } satisfies GraphDefinition;

  snapshot.graphDefinitions.push(secondaryGraph);

  return snapshot;
}

describe('WorkspaceKernel', () => {
  it('keeps active and reference graph selectors separate while appending ordered ledger facts', () => {
    const store = createWorkspaceKernelStore({
      snapshot: createSnapshotWithSecondaryGraph(),
      ledger: workspaceLedgerFixture,
    });

    expect(store.getState().selectors.activeGraphId()).toBe('graph_capacity_fade');
    expect(store.getState().selectors.referenceGraphId()).toBe('graph_capacity_fade');

    store.getState().commands.promoteReferenceGraph({
      graphId: 'graph_scatter_secondary',
      actorId: 'local-user',
      correlationId: 'cmd_2026_04_16_001',
      occurredAt: '2026-04-16T18:00:00Z',
      reason: 'Promote the review candidate.',
    });

    expect(store.getState().selectors.activeGraphId()).toBe('graph_capacity_fade');
    expect(store.getState().selectors.referenceGraphId()).toBe('graph_scatter_secondary');
    expect(store.getState().workspaceVersion).toBe(19);

    const lastLedgerEntry = store.getState().ledger.at(-1);

    expect(lastLedgerEntry).toMatchObject({
      sequence: 19,
      workspaceVersion: 19,
      type: 'graph.promoted',
      correlationId: 'cmd_2026_04_16_001',
    });
  });

  it('rejects stale worker replies by workspaceVersion and correlationId', () => {
    const store = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
    });

    store.getState().commands.queueWorkerRequest({
      correlationId: 'wrk_001',
      type: 'graph.render.completed',
    });

    store.getState().commands.updateTelemetrySnapshot(
      {
        lastGraphRenderMs: 311,
        offlineQueueDepth: 0,
        status: 'flushed',
      },
      {
        actorId: 'system',
        correlationId: 'cmd_2026_04_16_002',
        occurredAt: '2026-04-16T18:02:00Z',
      },
    );

    const staleResult = store.getState().commands.applyWorkerEnvelope(
      {
        schemaVersion: '1.0.0',
        messageId: 'msg_001',
        correlationId: 'wrk_001',
        workspaceVersion: 18,
        type: 'graph.render.completed',
        payload: {
          lastGraphRenderMs: 250,
        },
      },
      ({ snapshot, message }) => ({
        telemetrySnapshot: {
          ...snapshot.telemetrySnapshot,
          lastGraphRenderMs: Number(message.payload.lastGraphRenderMs),
        },
      }),
    );

    const unknownCorrelationResult = store.getState().commands.applyWorkerEnvelope(
      {
        schemaVersion: '1.0.0',
        messageId: 'msg_002',
        correlationId: 'wrk_missing',
        workspaceVersion: 19,
        type: 'graph.render.completed',
        payload: {
          lastGraphRenderMs: 199,
        },
      },
      ({ snapshot, message }) => ({
        telemetrySnapshot: {
          ...snapshot.telemetrySnapshot,
          lastGraphRenderMs: Number(message.payload.lastGraphRenderMs),
        },
      }),
    );

    expect(staleResult).toEqual({
      applied: false,
      reason: 'stale-workspace-version',
    });
    expect(unknownCorrelationResult).toEqual({
      applied: false,
      reason: 'unknown-correlation',
    });
    expect(store.getState().selectors.telemetrySnapshot()).toMatchObject({
      lastGraphRenderMs: 311,
      status: 'flushed',
    });
  });

  it('replaces the workspace ledger and invalidates pending worker replies after replacing the snapshot', () => {
    const store = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
    });

    store.getState().commands.queueWorkerRequest({
      correlationId: 'wrk_002',
      type: 'graph.render.completed',
    });

    const replacementSnapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      workspaceId: 'ws_2026_04_16_002',
      updatedAt: '2026-04-16T19:00:00Z',
    };
    const replacementLedger = [
      {
        ledgerEntryId: 'graph.created.7',
        sequence: 7,
        occurredAt: '2026-04-16T18:59:00Z',
        type: 'graph.created',
        actor: {
          kind: 'user',
          id: 'local-user',
        },
        workspaceVersion: 7,
        entityRefs: {
          workspaceId: 'ws_2026_04_16_002',
          graphId: 'graph_capacity_fade',
        },
        payload: {
          title: 'Reloaded graph history',
        },
        correlationId: 'cmd_2026_04_16_007',
      },
    ] as const;

    store.getState().commands.replaceSnapshot({
      snapshot: replacementSnapshot,
      ledger: [...replacementLedger],
    });

    expect(store.getState().workspaceVersion).toBe(7);
    expect(store.getState().pendingWorkerRequests).toEqual({});
    expect(store.getState().ledger).toEqual(replacementLedger);

    const result = store.getState().commands.applyWorkerEnvelope(
      {
        schemaVersion: '1.0.0',
        messageId: 'msg_003',
        correlationId: 'wrk_002',
        workspaceVersion: 7,
        type: 'graph.render.completed',
        payload: {
          lastGraphRenderMs: 180,
        },
      },
      ({ snapshot, message }) => ({
        telemetrySnapshot: {
          ...snapshot.telemetrySnapshot,
          lastGraphRenderMs: Number(message.payload.lastGraphRenderMs),
        },
      }),
    );

    expect(result).toEqual({
      applied: false,
      reason: 'unknown-correlation',
    });
    expect(store.getState().snapshot.workspaceId).toBe('ws_2026_04_16_002');
    expect(store.getState().selectors.telemetrySnapshot().lastGraphRenderMs).toBe(
      replacementSnapshot.telemetrySnapshot.lastGraphRenderMs,
    );

    store.getState().commands.replaceIssues([issueRecordFixture]);

    expect(store.getState().workspaceVersion).toBe(8);
    expect(store.getState().ledger.at(-1)).toMatchObject({
      sequence: 8,
      workspaceVersion: 8,
      entityRefs: {
        workspaceId: 'ws_2026_04_16_002',
      },
    });
  });

  it('derives trust selectors from canonical kernel state', () => {
    const store = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: [],
    });

    store.getState().commands.replaceIssues([issueRecordFixture]);
    store.getState().commands.updateTelemetrySnapshot(
      {
        lastGraphRenderMs: 512,
        offlineQueueDepth: 4,
        status: 'queued',
      },
      {
        actorId: 'system',
        correlationId: 'cmd_2026_04_16_003',
        occurredAt: '2026-04-16T18:05:00Z',
      },
    );

    expect(store.getState().selectors.issueState()).toMatchObject({
      total: 1,
      open: 1,
      blocking: 1,
      resolved: 0,
      openIssueIds: ['issue_color_role_quantitative'],
    });
    expect(store.getState().selectors.readinessSummary()).toMatchObject({
      status: 'blocked',
      blockingIssueCount: 1,
      warningIssueCount: 1,
      referenceGraphId: 'graph_capacity_fade',
    });
    expect(store.getState().selectors.telemetrySnapshot()).toMatchObject({
      lastGraphRenderMs: 512,
      offlineQueueDepth: 4,
      status: 'queued',
      hasPendingQueue: true,
    });
    expect(store.getState().selectors.compatibilityState()).toMatchObject({
      appBuildVersion: '0.1.0',
      minReadableAppBuild: '0.1.0',
      maxTestedAppBuild: '0.1.x',
      isReadable: true,
      isTested: true,
    });
    expect(store.getState().selectors.repairEntryPoints()).toEqual([
      expect.objectContaining({
        issueId: 'issue_color_role_quantitative',
        entityType: 'graph',
        entityId: 'graph_capacity_fade',
        scopeLabel: 'Graph graph_capacity_fade',
      }),
    ]);
  });

  it('preserves readiness-owned state while dropping issue-derived readiness ids', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [issueRecordFixture],
        readiness: {
          status: 'blocked',
          blockingIssueIds: ['issue_color_role_quantitative', 'repair.blocked.externally'],
          warningIssueIds: ['issue_missing_reviewer_note'],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: [],
    });

    store.getState().commands.replaceIssues([]);

    expect(store.getState().snapshot.readiness).toEqual({
      status: 'blocked',
      blockingIssueIds: ['repair.blocked.externally'],
      warningIssueIds: ['issue_missing_reviewer_note'],
      provenanceCompleteness: 'complete',
    });
    expect(store.getState().selectors.readinessSummary()).toMatchObject({
      status: 'blocked',
      blockingIssueCount: 1,
      warningIssueCount: 1,
    });
  });

  it('preserves an explicitly blocked readiness state when replaceIssues receives no blocking issues', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        readiness: {
          status: 'blocked',
          blockingIssueIds: [],
          warningIssueIds: ['issue_missing_reviewer_note'],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: [],
    });

    store.getState().commands.replaceIssues([]);

    expect(store.getState().snapshot.readiness).toEqual({
      status: 'blocked',
      blockingIssueIds: [],
      warningIssueIds: ['issue_missing_reviewer_note'],
      provenanceCompleteness: 'complete',
    });
  });

  it('rejects ledgers whose workspace versions move backwards', () => {
    const invalidLedger = [
      workspaceLedgerFixture[0]!,
      {
        ...workspaceLedgerFixture[1]!,
        workspaceVersion: 16,
      },
    ];

    expect(() =>
      createWorkspaceKernelStore({
        snapshot: workspaceSnapshotFixture,
        ledger: invalidLedger,
      }),
    ).toThrow(/workspace versions/i);
  });

  it('keeps persisted workspace data out of ViewState', () => {
    const kernelStore = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: [],
    });
    const viewStore = createViewStateStore();

    viewStore.getState().commands.setPanelOpen('readiness', true);
    viewStore.getState().commands.setPanelOpen('missionLog', true);
    viewStore.getState().commands.setShellStatus('loading');
    viewStore.getState().commands.setFocusReturnTarget('workspace-launcher');

    const persistedWorkspace = kernelStore.getState().selectors.persistedWorkspace();

    expect(workspaceSnapshotSchema.parse(persistedWorkspace)).toEqual(persistedWorkspace);
    expect('panels' in persistedWorkspace).toBe(false);
    expect('shellStatus' in persistedWorkspace).toBe(false);
    expect('focusReturnTarget' in persistedWorkspace).toBe(false);
    expect(viewStore.getState().selectors.isPanelOpen('readiness')).toBe(true);
    expect(viewStore.getState().selectors.isPanelOpen('missionLog')).toBe(true);
    expect('snapshot' in viewStore.getState()).toBe(false);
  });
});
