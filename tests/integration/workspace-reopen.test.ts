import { describe, expect, it } from 'vitest';

import { reopenWorkspaceKernel, saveWorkspaceKernel, type WorkspaceCompatibilityEnvelope } from '../../src/features/workspace-persistence';
import { InMemoryWorkspaceStorage, createWorkspaceRepository } from '../../src/services/persistence';
import { createWorkspaceKernelStore } from '../../src/stores/workspace-kernel';
import {
  benchmarkWorkspaceLocalLedgerFixture,
  benchmarkWorkspaceLocalSnapshotFixture,
} from '../../src/test/benchmark-workspaces/benchmark-workspace-local.fixture';

const compatibilityEnvelope: WorkspaceCompatibilityEnvelope = {
  currentAppBuildVersion: '0.1.0',
  minimumReadableWorkspaceFormat: '1.0.0',
  maximumReadableWorkspaceFormat: '1.x',
  migrationPolicy: 'migrate-on-open',
};

describe('workspace reopen integration', () => {
  it('round-trips a saved workspace and hydrates WorkspaceKernel without collapsing graph identity', async () => {
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const kernelStore = createWorkspaceKernelStore({
      snapshot: benchmarkWorkspaceLocalSnapshotFixture,
      ledger: benchmarkWorkspaceLocalLedgerFixture,
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      savedAt: '2026-04-16T18:40:00Z',
      benchmarkKey: 'benchmark_workspace_local',
    });

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:40:03Z',
      nowMs: (() => {
        const samples = [1000, 1380];
        return () => samples.shift() ?? 1380;
      })(),
    });

    expect(reopened.kernelStore.getState().selectors.activeGraphId()).toBe('graph_scatter_secondary');
    expect(reopened.kernelStore.getState().selectors.referenceGraphId()).toBe('graph_capacity_fade');
    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.datasets,
    );
    expect(reopened.kernelStore.getState().snapshot.formulaColumns).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.formulaColumns,
    );
    expect(reopened.report.benchmark).toMatchObject({
      durationMs: 380,
      migrationApplied: false,
      issueCount: 0,
      benchmarkKey: 'benchmark_workspace_local',
    });
  });

  it('applies the release compatibility envelope as a blocking reopen issue', async () => {
    const storage = new InMemoryWorkspaceStorage([
      {
        workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
        savedAt: '2026-04-16T18:45:00Z',
        snapshot: {
          ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
          workspaceFormatVersion: '2.0.0',
        },
        ledger: structuredClone(benchmarkWorkspaceLocalLedgerFixture),
      },
    ]);
    const repository = createWorkspaceRepository(storage);

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:45:04Z',
      nowMs: (() => {
        const samples = [2000, 2200];
        return () => samples.shift() ?? 2200;
      })(),
    });

    expect(reopened.report.localizedIssues).toContainEqual(
      expect.objectContaining({
        kind: 'workspace.reopen.compatibility.blocked',
        severity: 'blocking',
      }),
    );
    expect(reopened.kernelStore.getState().selectors.readinessSummary().status).toBe('blocked');
  });

  it('preserves unaffected workspace state while localizing invalid reopened content', async () => {
    const storage = new InMemoryWorkspaceStorage([
      {
        workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
        savedAt: '2026-04-16T18:48:00Z',
        snapshot: {
          ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture),
          datasets: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.datasets),
            {
              datasetId: 'ds_invalid',
              displayName: 'broken.csv',
              sourceKind: 'csv',
              fingerprint: 'sha256:dataset-invalid',
              rowCount: 4,
              columnCount: 1,
              columns: [
                {
                  columnId: '',
                  sourceName: 'Broken',
                  dataType: 'string',
                  semanticRole: 'x',
                  unit: null,
                  status: 'confirmed',
                },
              ],
            },
          ],
          transformPipeline: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.transformPipeline),
            {
              transformId: 'tf_missing_column',
              kind: 'filter',
              status: 'applied',
              order: 2,
              expression: "missingColumn == 'PASS'",
            },
          ],
          formulaColumns: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.formulaColumns),
            {
              formulaId: 'fm_missing_dependency',
              columnId: 'missingDerived',
              label: 'Missing Derived',
              expression: 'missingColumn * 2',
              status: 'valid',
              dependsOn: ['missingColumn'],
            },
          ],
          graphDefinitions: [
            benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0],
            {
              ...benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[0],
              graphId: 'graph_invalid_role_assignment',
              title: 'Invalid Graph',
              datasetId: 'ds_missing',
              status: 'candidate',
              evidenceIds: [],
              issueIds: [],
            },
            benchmarkWorkspaceLocalSnapshotFixture.graphDefinitions[1],
          ],
          evidence: [
            ...structuredClone(benchmarkWorkspaceLocalSnapshotFixture.evidence),
            {
              evidenceId: 'ev_orphaned',
              graphId: 'graph_invalid_role_assignment',
              note: 'This evidence points at a dropped graph.',
              provenanceRefs: ['prov_orphaned'],
              status: 'review-ready',
            },
          ],
        },
        ledger: [
          ...structuredClone(benchmarkWorkspaceLocalLedgerFixture),
          {
            ...structuredClone(benchmarkWorkspaceLocalLedgerFixture[2]),
            sequence: 18,
            workspaceVersion: 18,
            ledgerEntryId: 'led_004_invalid',
          },
        ],
      },
    ]);
    const repository = createWorkspaceRepository(storage);

    const reopened = await reopenWorkspaceKernel({
      repository,
      workspaceId: benchmarkWorkspaceLocalSnapshotFixture.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:48:05Z',
      nowMs: (() => {
        const samples = [3000, 3365];
        return () => samples.shift() ?? 3365;
      })(),
    });

    expect(reopened.kernelStore.getState().snapshot.datasets).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.datasets,
    );
    expect(reopened.kernelStore.getState().snapshot.transformPipeline).toEqual([]);
    expect(reopened.kernelStore.getState().snapshot.formulaColumns).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.formulaColumns,
    );
    expect(reopened.kernelStore.getState().snapshot.evidence).toEqual(
      benchmarkWorkspaceLocalSnapshotFixture.evidence,
    );
    expect(reopened.kernelStore.getState().snapshot.graphDefinitions.map((graph) => graph.graphId)).toEqual([
      'graph_capacity_fade',
      'graph_scatter_secondary',
    ]);
    expect(reopened.kernelStore.getState().ledger).toHaveLength(3);
    expect(reopened.report.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.missing-dataset',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.ledger.invalid-order',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.invalid-contract',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.transform.dataset-loss',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.formula.missing-dependency',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.evidence.orphaned-graph',
        }),
      ]),
    );
  });
});
