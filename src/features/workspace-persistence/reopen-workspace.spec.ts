import { describe, expect, it } from 'vitest';

import type { PersistedWorkspaceRecord } from '../../services/persistence';
import { graphDefinitionFixture } from '../../test/fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  reopenPersistedWorkspaceRecord,
  type WorkspaceCompatibilityEnvelope,
} from './reopen-workspace';

const compatibilityEnvelope: WorkspaceCompatibilityEnvelope = {
  currentAppBuildVersion: '0.1.0',
  minimumReadableWorkspaceFormat: '1.0.0',
  maximumReadableWorkspaceFormat: '1.x',
  migrationPolicy: 'migrate-on-open',
};

describe('reopenPersistedWorkspaceRecord', () => {
  it('localizes invalid graph records into issue records while preserving valid state', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:30:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          graphDefinitionFixture,
          {
            ...graphDefinitionFixture,
            graphId: 'graph_broken_reference',
            title: 'Broken Reference Graph',
            datasetId: 'ds_missing',
            status: 'reference',
            evidenceIds: [],
            issueIds: [],
          },
          {
            ...graphDefinitionFixture,
            graphId: 'graph_recovery_candidate',
            title: 'Recovery Candidate',
            status: 'candidate',
            evidenceIds: [],
            issueIds: [],
          },
        ],
        activeGraphId: 'graph_capacity_fade',
        referenceGraphId: 'graph_broken_reference',
      },
      ledger: structuredClone(workspaceLedgerFixture),
      benchmarkKey: 'benchmark_workspace_local',
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:30:05Z',
      nowMs: () => 5000,
    });

    expect(reopened.snapshot.graphDefinitions.map((graph) => graph.graphId)).toEqual([
      'graph_capacity_fade',
      'graph_recovery_candidate',
    ]);
    expect(reopened.snapshot.activeGraphId).toBe('graph_capacity_fade');
    expect(reopened.snapshot.referenceGraphId).toBe('graph_recovery_candidate');
    expect(reopened.snapshot.formulaColumns).toEqual(workspaceSnapshotFixture.formulaColumns);
    expect(reopened.snapshot.datasets).toEqual(workspaceSnapshotFixture.datasets);
    expect(
      reopened.localizedIssues.some(
        (issue) =>
          issue.kind === 'workspace.reopen.graph.missing-dataset' &&
          issue.source.entityType === 'graph' &&
          issue.source.entityId === 'graph_broken_reference',
      ),
    ).toBe(true);
    expect(reopened.benchmark).toMatchObject({
      savedAt: '2026-04-16T18:30:00Z',
      migrationApplied: false,
      issueCount: 2,
    });
  });

  it('drops stale transforms, formulas, and evidence while preserving unaffected state', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          ...workspaceSnapshotFixture.datasets,
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
          ...workspaceSnapshotFixture.transformPipeline,
          {
            transformId: 'tf_missing_column',
            kind: 'filter',
            status: 'applied',
            order: 2,
            expression: "missingColumn == 'PASS'",
          },
        ],
        formulaColumns: [
          ...workspaceSnapshotFixture.formulaColumns,
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
          graphDefinitionFixture,
          {
            ...graphDefinitionFixture,
            graphId: 'graph_orphaned',
            title: 'Orphaned Graph',
            datasetId: 'ds_missing',
            status: 'candidate',
            evidenceIds: ['ev_orphaned'],
            issueIds: [],
          },
        ],
        evidence: [
          ...workspaceSnapshotFixture.evidence,
          {
            evidenceId: 'ev_orphaned',
            graphId: 'graph_orphaned',
            note: 'This evidence points at a dropped graph.',
            provenanceRefs: ['prov_orphaned'],
            status: 'review-ready',
          },
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:05Z',
      nowMs: () => 6000,
    });

    expect(reopened.snapshot.transformPipeline).toEqual([]);
    expect(reopened.snapshot.formulaColumns).toEqual(workspaceSnapshotFixture.formulaColumns);
    expect(reopened.snapshot.evidence).toEqual(workspaceSnapshotFixture.evidence);
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
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
