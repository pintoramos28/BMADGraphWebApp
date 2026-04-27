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
    const staleHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return {
          name: 'battery-cycles.csv',
        } as File;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const replacementHandle = {
      name: 'battery-cycles-reloaded.csv',
      async getFile() {
        return {
          name: 'battery-cycles-reloaded.csv',
        } as File;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
          },
        })),
      },
      ledger: workspaceLedgerFixture,
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: staleHandle,
        },
      ],
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
    expect(store.getState().selectors.datasetFileHandles()).toEqual([]);

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

    store.getState().commands.replaceSnapshot({
      snapshot: replacementSnapshot,
      ledger: [...replacementLedger],
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles-reloaded.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: replacementHandle,
        },
      ],
    });

    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles-reloaded.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: replacementHandle,
      }),
    ]);
    expect(store.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles-reloaded.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
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

  it('removes resolved reopen issues from readiness counts when issues are replaced', () => {
    const reopenIssue = {
      ...structuredClone(issueRecordFixture),
      issueId: 'workspace.reopen.010',
      kind: 'workspace.reopen.graph.invalid-selection',
      severity: 'warning' as const,
      source: {
        module: 'workspace-persistence',
        entityType: 'graph-selection',
        entityId: 'active-graph-selection',
      },
      title: 'The saved active graph selection could not be restored',
      detail:
        'Saved active graph selection "graph invalid/id" could not be restored, so graph "graph_scatter_secondary" was selected instead.',
      userMessage:
        'The saved active graph selection could not be restored. Graph "graph_scatter_secondary" was selected instead.',
      contextRef: {
        routeKey: 'workspaceDetail',
        workspaceId: workspaceSnapshotFixture.workspaceId,
        graphId: 'graph_scatter_secondary',
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
          actionId: 'repair.focusGraph',
          label: 'Inspect graph',
          command: 'repair.focusGraph',
          args: {
            graphId: 'graph_scatter_secondary',
          },
        },
      ],
      diagnostics: {
        selection: 'active',
        requestedGraphId: 'graph invalid/id',
        resolvedGraphId: 'graph_scatter_secondary',
      },
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [reopenIssue],
        readiness: {
          status: 'warning',
          blockingIssueIds: [],
          warningIssueIds: ['workspace.reopen.010'],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: [],
    });

    store.getState().commands.replaceIssues([
      {
        ...reopenIssue,
        status: 'resolved',
      },
    ]);

    expect(store.getState().snapshot.readiness).toEqual({
      status: 'ready',
      blockingIssueIds: [],
      warningIssueIds: [],
      provenanceCompleteness: 'complete',
    });
    expect(store.getState().selectors.readinessSummary()).toMatchObject({
      status: 'ready',
      blockingIssueCount: 0,
      warningIssueCount: 0,
    });
  });

  it('retains dataset file handles across kernel mutations and explicit handle updates', () => {
    const initialHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return {
          name: 'battery-cycles.csv',
        } as File;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const replacementHandle = {
      name: 'battery-cycles-v2.csv',
      async getFile() {
        return {
          name: 'battery-cycles-v2.csv',
        } as File;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const store = createWorkspaceKernelStore({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: initialHandle,
        },
      ],
    });

    store.getState().commands.replaceIssues([issueRecordFixture]);

    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: initialHandle,
      }),
    ]);

    store.getState().commands.replaceDatasetFileHandles([
      {
        datasetId: 'ds_main',
        fileName: 'battery-cycles-v2.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: replacementHandle,
      },
    ]);

    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles-v2.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        handle: replacementHandle,
      }),
    ]);
    expect(store.getState().selectors.persistedWorkspace().datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        sourceFile: {
          fileName: 'battery-cycles-v2.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
        },
      }),
    ]);
  });

  it('updates one column semantics through a ledgered kernel command while preserving source provenance', () => {
    const sourceHandle = {
      name: 'battery-cycles.csv',
      async getFile() {
        return { name: 'battery-cycles.csv' } as File;
      },
      async createWritable() {
        return { async write() {}, async close() {} };
      },
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      ledger: workspaceLedgerFixture,
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: sourceHandle,
        },
      ],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      label: 'Capacity Retention',
      dataType: 'number',
      semanticRole: 'y',
      unit: 'percent',
      measurementContext: { notes: 'Measured after each cycle.' },
      description: 'Normalized retention ratio.',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_001',
      occurredAt: '2026-04-22T15:00:00Z',
    });

    const dataset = store.getState().snapshot.datasets[0]!;

    expect(dataset.rows).toBeUndefined();
    expect(dataset.sourceFile).toEqual({
      fileName: 'battery-cycles.csv',
      fileHandleToken: 'dataset.ds_main.source-file',
    });
    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({ handle: sourceHandle }),
    ]);
    expect(dataset.columns.find((column) => column.columnId === 'capacityRetention')).toMatchObject({
      sourceName: 'CapacityRetentionPct',
      label: 'Capacity Retention',
      unit: 'percent',
      measurementContext: { notes: 'Measured after each cycle.' },
      description: 'Normalized retention ratio.',
    });
    expect(dataset.columns.find((column) => column.columnId === 'cycleIndex')).toMatchObject({
      label: 'Cycle',
      semanticRole: 'x',
    });
    expect(store.getState().ledger.at(-1)).toMatchObject({
      type: 'dataset.column-semantics.updated',
      correlationId: 'cmd_semantics_001',
      entityRefs: {
        datasetId: 'ds_main',
        columnId: 'capacityRetention',
      },
    });
  });

  it('rejects semantic column and dataset-context commands for placeholder datasets', () => {
    const previewDataset = {
      ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
      sourceKind: 'import-preview',
    } satisfies WorkspaceSnapshot['datasets'][number];
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [previewDataset],
      },
      ledger: [],
    });
    const initialWorkspaceVersion = store.getState().workspaceVersion;

    expect(() => store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      label: 'Should not stick',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_preview_column',
      occurredAt: '2026-04-27T10:05:00Z',
    })).toThrow('Semantic edits require a confirmed dataset.');

    expect(() => store.getState().commands.updateDatasetContext({
      datasetId: 'ds_main',
      datasetContext: { description: 'Should not stick' },
      actorId: 'local-user',
      correlationId: 'cmd_semantics_preview_context',
      occurredAt: '2026-04-27T10:06:00Z',
    })).toThrow('Semantic edits require a confirmed dataset.');

    expect(store.getState().workspaceVersion).toBe(initialWorkspaceVersion);
    expect(store.getState().snapshot.datasets[0]?.columns.find((column) => column.columnId === 'capacityRetention')).toMatchObject({
      label: 'Capacity Retention %',
    });
    expect(store.getState().snapshot.datasets[0]?.datasetContext).toEqual(previewDataset.datasetContext);

    const recoveryDataset = {
      ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
      sourceKind: 'recovery',
    } satisfies WorkspaceSnapshot['datasets'][number];
    const recoveryStore = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [recoveryDataset],
      },
      ledger: [],
    });
    const initialRecoveryWorkspaceVersion = recoveryStore.getState().workspaceVersion;

    expect(() => recoveryStore.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      label: 'Should not stick',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_recovery_column',
      occurredAt: '2026-04-27T10:07:00Z',
    })).toThrow('Semantic edits require a confirmed dataset.');

    expect(() => recoveryStore.getState().commands.updateDatasetContext({
      datasetId: 'ds_main',
      datasetContext: { description: 'Should not stick' },
      actorId: 'local-user',
      correlationId: 'cmd_semantics_recovery_context',
      occurredAt: '2026-04-27T10:08:00Z',
    })).toThrow('Semantic edits require a confirmed dataset.');

    expect(recoveryStore.getState().workspaceVersion).toBe(initialRecoveryWorkspaceVersion);
  });

  it('scopes graph-ready semantic summaries to confirmed datasets', () => {
    const placeholderDataset = {
      ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
      sourceKind: 'recovery',
    } satisfies WorkspaceSnapshot['datasets'][number];
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [placeholderDataset],
      },
      ledger: [],
    });

    expect(store.getState().selectors.activeDataset()?.sourceKind).toBe('recovery');
    expect(store.getState().selectors.graphReadySemanticSummary()).toBeNull();
  });

  it('reconciles only semantic issues for the targeted dataset and exposes the graph-ready summary', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [issueRecordFixture],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'unassigned',
      measurementContext: null,
      actorId: 'local-user',
      correlationId: 'cmd_semantics_002',
      occurredAt: '2026-04-22T15:02:00Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issueId: issueRecordFixture.issueId }),
        expect.objectContaining({
          kind: 'semantics.column.missing-role',
          source: expect.objectContaining({ entityType: 'dataset-column', entityId: 'capacityRetention' }),
          diagnostics: expect.objectContaining({ datasetId: 'ds_main', columnId: 'capacityRetention' }),
        }),
        expect.objectContaining({
          kind: 'semantics.graph.composition-invalid',
          severity: 'blocking',
        }),
      ]),
    );
    expect(store.getState().selectors.graphReadySemanticSummary()).toMatchObject({
      datasetId: 'ds_main',
      missingRoleColumnIds: ['capacityRetention'],
      missingContextColumnIds: ['capacityRetention'],
    });
    expect(store.getState().selectors.readinessSummary()).toMatchObject({
      status: 'blocked',
    });
  });

  it('invalidates graph assignments when a column semantic role no longer matches its assigned graph role', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'x',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_role_conflict',
      occurredAt: '2026-04-22T15:03:00Z',
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      issueIds: expect.arrayContaining(['semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid']),
    });
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'semantics.graph.composition-invalid',
          detail: expect.stringContaining('assigned to conflicting graph role "y" but its active semantic role is "x"'),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusSemanticField',
              label: 'Edit column semantics',
              args: expect.objectContaining({
                datasetId: 'ds_main',
                columnId: 'capacityRetention',
              }),
            }),
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_capacity_fade',
              }),
            }),
          ]),
          diagnostics: expect.objectContaining({
            affectedColumnIds: expect.arrayContaining(['capacityRetention']),
          }),
        }),
      ]),
    );
  });

  it('restores graph status when semantic graph conflicts are cleared', () => {
    const candidateGraph = {
      ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]!),
      status: 'candidate' as const,
      roleAssignments: {
        ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]!.roleAssignments),
        facetColumn: [],
      },
      issueIds: [],
    } satisfies GraphDefinition;
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [candidateGraph],
        referenceGraphId: candidateGraph.graphId,
        issues: [],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'x',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_status_conflict',
      occurredAt: '2026-04-22T15:03:05Z',
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      status: 'stale',
      issueIds: expect.arrayContaining(['semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid']),
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'y',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_status_restored',
      occurredAt: '2026-04-22T15:03:06Z',
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      status: 'reference',
      issueIds: [],
    });
    expect(store.getState().snapshot.issues.find((issue) => issue.kind === 'semantics.graph.composition-invalid')).toBeUndefined();
  });

  it('does not promote issue-free stale graphs that were not stale because of semantic issues', () => {
    const externallyStaleGraph = {
      ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]!),
      status: 'stale' as const,
      roleAssignments: {
        ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]!.roleAssignments),
        facetColumn: [],
      },
      issueIds: [],
    } satisfies GraphDefinition;
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [externallyStaleGraph],
        referenceGraphId: externallyStaleGraph.graphId,
        issues: [],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      label: 'Capacity Retention Confirmed',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_unrelated_stale_graph',
      occurredAt: '2026-04-22T15:03:07Z',
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      status: 'stale',
      issueIds: [],
    });
    expect(store.getState().snapshot.issues.find((issue) => issue.kind === 'semantics.graph.composition-invalid')).toBeUndefined();
  });

  it('flags conflicting roles when the same column is assigned to multiple graph roles', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: workspaceSnapshotFixture.graphDefinitions.map((graph) => ({
          ...structuredClone(graph),
          roleAssignments: {
            ...structuredClone(graph.roleAssignments),
            x: ['capacityRetention'],
            y: ['capacityRetention'],
          },
          issueIds: [],
        })),
        issues: [],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'y',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_multi_role_conflict',
      occurredAt: '2026-04-22T15:03:15Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'semantics.graph.composition-invalid',
          detail: expect.stringContaining('conflicting graph role "x"'),
          diagnostics: expect.objectContaining({
            affectedColumnIds: expect.arrayContaining(['capacityRetention']),
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusSemanticField',
              args: expect.objectContaining({
                columnId: 'capacityRetention',
              }),
            }),
          ]),
        }),
      ]),
    );
  });

  it('invalidates graph assignments when a quantitative graph column changes to a string data type', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      dataType: 'string',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_data_type_conflict',
      occurredAt: '2026-04-22T15:03:30Z',
    });

    expect(store.getState().snapshot.graphDefinitions[0]).toMatchObject({
      status: 'reference',
      issueIds: expect.arrayContaining(['semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid']),
    });
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'semantics.graph.composition-invalid',
          severity: 'blocking',
          detail: expect.stringContaining('Scatter compositions require quantitative columns for x and y roles.'),
          diagnostics: expect.objectContaining({
            datasetId: 'ds_main',
            graphId: 'graph_capacity_fade',
            affectedColumnIds: expect.arrayContaining(['capacityRetention']),
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusSemanticField',
              args: expect.objectContaining({
                datasetId: 'ds_main',
                columnId: 'capacityRetention',
              }),
            }),
          ]),
        }),
      ]),
    );
    expect(store.getState().selectors.readinessSummary()).toMatchObject({
      status: 'blocked',
    });
  });

  it('keeps nonsemantic graph catalog failures out of semantic graph issue regeneration', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: workspaceSnapshotFixture.graphDefinitions.map((graph) => ({
          ...structuredClone(graph),
          marks: ['point', 'bar'],
          issueIds: [],
        })),
        issues: [],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      dataType: 'string',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_mixed_catalog_conflict',
      occurredAt: '2026-04-22T15:03:45Z',
    });

    const semanticGraphIssue = store.getState().snapshot.issues.find(
      (issue) => issue.kind === 'semantics.graph.composition-invalid',
    );

    expect(semanticGraphIssue).toMatchObject({
      detail: expect.stringContaining('Scatter compositions require quantitative columns for x and y roles.'),
      diagnostics: expect.objectContaining({
        blockedReasons: expect.arrayContaining(['Scatter compositions require quantitative columns for x and y roles.']),
        affectedColumnIds: expect.arrayContaining(['capacityRetention']),
      }),
    });
    expect(semanticGraphIssue?.detail).not.toContain('Marks point, bar are not allowed');
    expect((semanticGraphIssue?.diagnostics as { blockedReasons?: string[] }).blockedReasons).not.toEqual(
      expect.arrayContaining(['Marks point, bar are not allowed for graph family "scatter".']),
    );
  });

  it('reopens regenerated graph semantic issues when blocking reasons change', () => {
    const initialStore = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });

    initialStore.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'x',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_initial_graph_conflict',
      occurredAt: '2026-04-22T15:03:00Z',
    });

    const graphIssue = initialStore.getState().snapshot.issues.find(
      (issue) => issue.kind === 'semantics.graph.composition-invalid',
    );

    expect(graphIssue).toBeDefined();

    const deferredSnapshot: WorkspaceSnapshot = {
      ...initialStore.getState().snapshot,
      issues: initialStore.getState().snapshot.issues.map((issue) => (
        issue.issueId === graphIssue?.issueId
          ? {
              ...issue,
              status: 'deferred' as const,
              detectedAt: '2026-04-22T15:03:00Z',
            }
          : issue
      )),
    };
    const store = createWorkspaceKernelStore({
      snapshot: deferredSnapshot,
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      semanticRole: 'unassigned',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_changed_graph_conflict',
      occurredAt: '2026-04-22T15:04:00Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: graphIssue?.issueId,
          kind: 'semantics.graph.composition-invalid',
          status: 'open',
          detectedAt: '2026-04-22T15:04:00Z',
          detail: expect.stringContaining('has no active semantic role'),
        }),
      ]),
    );
  });

  it('reopens regenerated graph semantic issues when affected columns change', () => {
    const graphIssueId = 'semantics.p7:ds_main.p19:graph_capacity_fade.p13:graph-invalid';
    const deferredGraphIssue = {
      issueId: graphIssueId,
      kind: 'semantics.graph.composition-invalid',
      severity: 'blocking' as const,
      status: 'deferred' as const,
      detectedAt: '2026-04-22T15:03:00Z',
      source: {
        module: 'workspace-kernel',
        entityType: 'graph',
        entityId: 'graph_capacity_fade',
      },
      title: 'Graph composition needs semantic review',
      detail: 'Scatter compositions require quantitative columns for x and y roles.',
      userMessage: 'A graph that uses this dataset no longer matches the active semantic choices.',
      contextRef: {
        routeKey: 'workspaceDetail' as const,
        workspaceId: workspaceSnapshotFixture.workspaceId,
        graphId: 'graph_capacity_fade',
        panel: 'semantics',
      },
      repairActions: [],
      diagnostics: {
        datasetId: 'ds_main',
        graphId: 'graph_capacity_fade',
        blockedReasons: ['Scatter compositions require quantitative columns for x and y roles.'],
        affectedColumnIds: ['temperatureBand'],
      },
    } satisfies WorkspaceSnapshot['issues'][number];
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [deferredGraphIssue],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      dataType: 'string',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_changed_graph_target',
      occurredAt: '2026-04-22T15:04:30Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: graphIssueId,
          kind: 'semantics.graph.composition-invalid',
          status: 'open',
          detectedAt: '2026-04-22T15:04:30Z',
          diagnostics: expect.objectContaining({
            affectedColumnIds: expect.arrayContaining(['capacityRetention']),
          }),
        }),
      ]),
    );
  });

  it('generates unambiguous semantic issue ids for dotted dataset and column identifiers', () => {
    const baseDataset = workspaceSnapshotFixture.datasets[0]!;
    const firstDataset = {
      ...structuredClone(baseDataset),
      datasetId: 'a.b',
      columns: [
        {
          ...structuredClone(baseDataset.columns[0]!),
          columnId: 'c',
          semanticRole: 'x' as const,
        },
      ],
      columnCount: 1,
    };
    const secondDataset = {
      ...structuredClone(baseDataset),
      datasetId: 'a',
      columns: [
        {
          ...structuredClone(baseDataset.columns[0]!),
          columnId: 'b.c',
          semanticRole: 'x' as const,
        },
      ],
      columnCount: 1,
    };
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [firstDataset, secondDataset],
        graphDefinitions: workspaceSnapshotFixture.graphDefinitions.map((graph) => ({
          ...structuredClone(graph),
          datasetId: 'a.b',
          roleAssignments: {
            x: [],
            y: [],
            color: [],
            size: [],
            facetRow: [],
            facetColumn: [],
          },
          issueIds: [],
        })),
        issues: [],
        readiness: {
          status: 'ready',
          blockingIssueIds: [],
          warningIssueIds: [],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'a.b',
      columnId: 'c',
      semanticRole: 'unassigned',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_dotted_first',
      occurredAt: '2026-04-22T15:06:00Z',
    });
    store.getState().commands.updateColumnSemantics({
      datasetId: 'a',
      columnId: 'b.c',
      semanticRole: 'unassigned',
      actorId: 'local-user',
      correlationId: 'cmd_semantics_dotted_second',
      occurredAt: '2026-04-22T15:07:00Z',
    });

    const missingRoleIssueIds = store.getState().snapshot.issues
      .filter((issue) => issue.kind === 'semantics.column.missing-role')
      .map((issue) => issue.issueId);

    expect(missingRoleIssueIds).toHaveLength(2);
    expect(new Set(missingRoleIssueIds).size).toBe(2);
    expect(missingRoleIssueIds).not.toContain('semantics.a.b.c.missing-role');
  });

  it('preserves unrelated semantic issue repair state when reconciling one edited column', () => {
    const unrelatedSemanticIssue = {
      issueId: 'semantics.ds_main.temperatureBand.missing-context',
      kind: 'semantics.column.missing-context',
      severity: 'info' as const,
      status: 'deferred' as const,
      detectedAt: '2026-04-20T10:00:00Z',
      source: {
        module: 'workspace-kernel',
        entityType: 'dataset-column',
        entityId: 'temperatureBand',
      },
      title: 'Column measurement context is missing',
      detail: 'Temperature context was deferred.',
      userMessage: 'Add context later.',
      contextRef: {
        routeKey: 'workspaceDetail' as const,
        workspaceId: workspaceSnapshotFixture.workspaceId,
        panel: 'semantics',
      },
      repairActions: [],
      diagnostics: {
        datasetId: 'ds_main',
        columnId: 'temperatureBand',
        field: 'measurementContext',
      },
    } satisfies WorkspaceSnapshot['issues'][number];
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [unrelatedSemanticIssue],
      },
      ledger: [],
    });

    store.getState().commands.updateColumnSemantics({
      datasetId: 'ds_main',
      columnId: 'capacityRetention',
      measurementContext: null,
      actorId: 'local-user',
      correlationId: 'cmd_semantics_target_only',
      occurredAt: '2026-04-22T15:04:00Z',
    });

    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        unrelatedSemanticIssue,
        expect.objectContaining({
          issueId: 'semantics.p7:ds_main.p17:capacityRetention.p15:missing-context',
          severity: 'warning',
          status: 'open',
        }),
      ]),
    );
    expect(store.getState().snapshot.readiness.warningIssueIds).toContain(
      'semantics.p7:ds_main.p17:capacityRetention.p15:missing-context',
    );
  });

  it('updates dataset context without changing imported rows or graph role assignments', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });
    const originalRows = store.getState().snapshot.datasets[0]!.rows;
    const originalRoleAssignments = structuredClone(store.getState().snapshot.graphDefinitions[0]!.roleAssignments);

    store.getState().commands.updateDatasetContext({
      datasetId: 'ds_main',
      datasetContext: {
        description: 'Updated context',
        measurementNotes: 'Updated measurement notes',
      },
      actorId: 'local-user',
      correlationId: 'cmd_semantics_003',
      occurredAt: '2026-04-22T15:05:00Z',
    });

    expect(store.getState().snapshot.datasets[0]).toMatchObject({
      displayName: 'battery-cycles.csv',
      datasetContext: {
        description: 'Updated context',
        measurementNotes: 'Updated measurement notes',
      },
    });
    expect(store.getState().snapshot.datasets[0]!.rows).toBe(originalRows);
    expect(store.getState().snapshot.graphDefinitions[0]!.roleAssignments).toEqual(originalRoleAssignments);
    expect(store.getState().ledger.at(-1)).toMatchObject({
      type: 'dataset.context.updated',
      correlationId: 'cmd_semantics_003',
    });
  });

  it('preserves handleless source metadata when no persisted dataset file handle remains', () => {
    const store = createWorkspaceKernelStore({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]!),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      ledger: workspaceLedgerFixture,
    });

    store.getState().commands.replaceDatasetFileHandles([]);

    expect(store.getState().selectors.persistedWorkspace().datasets[0]).toMatchObject({
      sourceFile: {
        fileName: 'battery-cycles.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
      },
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

  it('commits a confirmed import through the kernel with a placeholder reference graph', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });

    store.getState().commands.confirmImport({
      previewId: 'preview_csv',
      graphId: 'graph_import_confirm_001',
      source: {
        sourceKind: 'csv-file',
        sourceLabel: 'Local CSV file',
        fileName: 'dirty.csv',
        benchmarkScenario: 'import.dirty.type-repair',
      },
      repairSelections: {
        delimiter: ',',
        headerSelection: 'first-row-header',
        columnTypeOverrides: {
          col_2: 'numeric',
        },
        missingValuePolicy: 'mark-empty',
      },
        dataset: {
          datasetId: 'dataset_import_confirm_001',
          displayName: 'dirty.csv',
          datasetContext: null,
          sourceKind: 'csv-file',
        fingerprint: 'preview:preview_csv',
        rowCount: 3,
        columnCount: 2,
        columns: [
            {
              columnId: 'col_1',
              sourceName: 'Sample',
              label: 'Sample',
              dataType: 'string',
              semanticRole: 'unassigned',
              unit: null,
              measurementContext: null,
              description: null,
              status: 'confirmed',
            },
            {
              columnId: 'col_2',
              sourceName: 'Reading',
              label: 'Reading',
              dataType: 'number',
              semanticRole: 'unassigned',
              unit: null,
              measurementContext: null,
              description: null,
              status: 'confirmed',
            },
        ],
      },
      issues: [
        {
          ...issueRecordFixture,
          severity: 'warning',
        },
      ],
      actorId: 'workspace-import-route',
      correlationId: 'confirm_preview_csv',
      occurredAt: '2026-04-22T14:00:00Z',
    });

    expect(store.getState().snapshot.datasets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          datasetId: 'ds_main',
          displayName: 'battery-cycles.csv',
        }),
        expect.objectContaining({
          datasetId: 'dataset_import_confirm_001',
          displayName: 'dirty.csv',
        }),
      ]),
    );
    expect(store.getState().snapshot.transformPipeline).toEqual(workspaceSnapshotFixture.transformPipeline);
    expect(store.getState().snapshot.formulaColumns).toEqual(workspaceSnapshotFixture.formulaColumns);
    expect(store.getState().snapshot.evidence).toEqual(workspaceSnapshotFixture.evidence);
    expect(store.getState().snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_capacity_fade',
          datasetId: 'ds_main',
          status: 'candidate',
        }),
        expect.objectContaining({
          graphId: 'graph_import_confirm_001',
          datasetId: 'dataset_import_confirm_001',
          status: 'reference',
        }),
      ]),
    );
    expect(store.getState().snapshot.referenceGraphId).toBe('graph_import_confirm_001');
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: `${issueRecordFixture.issueId}:dataset_import_confirm_001`,
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'dataset_import_confirm_001',
          }),
          contextRef: expect.objectContaining({
            routeKey: 'workspaceDetail',
            workspaceId: workspaceSnapshotFixture.workspaceId,
            graphId: 'graph_import_confirm_001',
            panel: 'readiness',
          }),
          repairActions: [],
        }),
        expect.objectContaining({
          issueId: 'semantics.p26:dataset_import_confirm_001.p5:col_1.p12:missing-role',
          kind: 'semantics.column.missing-role',
          source: expect.objectContaining({
            entityType: 'dataset-column',
            entityId: 'col_1',
          }),
        }),
        expect.objectContaining({
          issueId: 'semantics.p26:dataset_import_confirm_001.p23:missing-dataset-context',
          kind: 'semantics.dataset.missing-context',
          severity: 'warning',
        }),
      ]),
    );
    expect(store.getState().snapshot.readiness.warningIssueIds).toEqual(
      expect.arrayContaining([
        'semantics.p26:dataset_import_confirm_001.p5:col_1.p15:missing-context',
        'semantics.p26:dataset_import_confirm_001.p5:col_2.p15:missing-context',
        'semantics.p26:dataset_import_confirm_001.p23:missing-dataset-context',
      ]),
    );
    expect(store.getState().selectors.graphReadySemanticSummary()).toMatchObject({
      datasetId: 'dataset_import_confirm_001',
      missingRoleColumnIds: ['col_1', 'col_2'],
      missingContextColumnIds: ['col_1', 'col_2'],
      datasetContextMissing: true,
    });
    expect(store.getState().ledger.at(-1)).toMatchObject({
      type: 'import.confirmed',
      correlationId: 'confirm_preview_csv',
      payload: {
        datasetId: 'dataset_import_confirm_001',
        previewId: 'preview_csv',
        source: {
          sourceKind: 'csv-file',
          sourceLabel: 'Local CSV file',
          fileName: 'dirty.csv',
          benchmarkScenario: 'import.dirty.type-repair',
        },
        repairSelections: {
          delimiter: ',',
          headerSelection: 'first-row-header',
          columnTypeOverrides: {
            col_2: 'numeric',
          },
          missingValuePolicy: 'mark-empty',
        },
      },
    });
  });

  it('rejects confirmed imports that still carry blocking issues', () => {
    const store = createWorkspaceKernelStore({
      snapshot: structuredClone(workspaceSnapshotFixture),
      ledger: [],
    });

    expect(() =>
      store.getState().commands.confirmImport({
        previewId: 'preview_csv',
        graphId: 'graph_import_blocked',
        source: {
          sourceKind: 'csv-file',
          sourceLabel: 'Local CSV file',
          fileName: 'blocked.csv',
          benchmarkScenario: 'import.dirty.type-repair',
        },
        repairSelections: {
          delimiter: ',',
          headerSelection: 'first-row-header',
          columnTypeOverrides: {},
          missingValuePolicy: null,
          additionalColumnsAcknowledgement: null,
        },
        dataset: {
          datasetId: 'dataset_import_blocked',
          displayName: 'blocked.csv',
          datasetContext: null,
          sourceKind: 'csv-file',
          fingerprint: 'preview:preview_csv',
          rowCount: 1,
          columnCount: 1,
          columns: [
            {
              columnId: 'col_1',
              sourceName: 'Sample',
              label: 'Sample',
              dataType: 'string',
              semanticRole: 'unassigned',
              unit: null,
              measurementContext: null,
              description: null,
              status: 'confirmed',
            },
          ],
          rows: [
            {
              col_1: 'A-1',
            },
          ],
        },
        issues: [
          {
            ...issueRecordFixture,
            severity: 'blocking',
            status: 'open',
          },
        ],
        actorId: 'workspace-import-route',
        correlationId: 'confirm_preview_blocked',
        occurredAt: '2026-04-22T14:05:00Z',
      }),
    ).toThrow(/blocking issues remain unresolved/i);
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
