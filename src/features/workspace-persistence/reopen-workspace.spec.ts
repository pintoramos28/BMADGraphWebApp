import { describe, expect, it } from 'vitest';

import { selectCompatibilityState } from '../../domain/trust';
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

  it('sanitizes invalid localized entity ids before creating reopen issue records', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:30Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...workspaceSnapshotFixture.datasets[0],
            datasetId: 'dataset invalid/id',
          },
        ],
        graphDefinitions: [
          {
            ...graphDefinitionFixture,
            graphId: 'graph invalid/id',
            datasetId: 'dataset invalid/id',
          },
        ],
        activeGraphId: 'graph_capacity_fade',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:35Z',
      nowMs: () => 6250,
    });

    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.invalid-contract',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'dataset_invalid_id',
          }),
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.graph.invalid-contract',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_invalid_id',
          }),
        }),
      ]),
    );
  });

  it('sanitizes invalid saved graph selection ids before emitting reopen issues', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:40Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          graphDefinitionFixture,
          {
            ...graphDefinitionFixture,
            graphId: 'graph_scatter_secondary',
            title: 'Secondary Graph',
            status: 'candidate',
            evidenceIds: [],
            issueIds: [],
          },
        ],
        activeGraphId: 'graph invalid/id',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:45Z',
      nowMs: () => 6300,
    });

    expect(reopened.snapshot.activeGraphId).toBe('graph_scatter_secondary');
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.invalid-selection',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_invalid_id',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_scatter_secondary',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_scatter_secondary',
              }),
            }),
          ]),
          diagnostics: expect.objectContaining({
            requestedGraphId: 'graph invalid/id',
            resolvedGraphId: 'graph_scatter_secondary',
          }),
        }),
      ]),
    );
  });

  it('emits a reopen issue when the saved active graph selection only survives via normalization', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:50Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          graphDefinitionFixture,
          {
            ...graphDefinitionFixture,
            graphId: 'graph_scatter_secondary',
            title: 'Secondary Graph',
            status: 'candidate',
            evidenceIds: [],
            issueIds: [],
          },
        ],
        activeGraphId: 'graph scatter secondary',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:55Z',
      nowMs: () => 6350,
    });

    expect(reopened.snapshot.activeGraphId).toBe('graph_scatter_secondary');
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.invalid-selection',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_scatter_secondary',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_scatter_secondary',
          }),
          diagnostics: expect.objectContaining({
            requestedGraphId: 'graph scatter secondary',
            normalizedRequestedGraphId: 'graph_scatter_secondary',
            resolvedGraphId: 'graph_scatter_secondary',
          }),
        }),
      ]),
    );
  });

  it('emits a reopen issue when the saved reference graph selection only survives via normalization', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          graphDefinitionFixture,
          {
            ...graphDefinitionFixture,
            graphId: 'graph_scatter_secondary',
            title: 'Secondary Graph',
            status: 'candidate',
            evidenceIds: [],
            issueIds: [],
          },
        ],
        activeGraphId: 'graph_scatter_secondary',
        referenceGraphId: 'graph capacity fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:05Z',
      nowMs: () => 6400,
    });

    expect(reopened.snapshot.referenceGraphId).toBe('graph_capacity_fade');
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.invalid-selection',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_capacity_fade',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_capacity_fade',
          }),
          diagnostics: expect.objectContaining({
            requestedGraphId: 'graph capacity fade',
            normalizedRequestedGraphId: 'graph_capacity_fade',
            resolvedGraphId: 'graph_capacity_fade',
          }),
        }),
      ]),
    );
  });

  it('emits localized repair actions for broken transforms and formulas during reopen', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:00Z',
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
          {
            transformId: 'tf_missing_column',
            kind: 'filter',
            status: 'applied',
            order: 2,
            expression: "missingColumn == 'PASS'",
          },
        ],
        formulaColumns: [
          {
            formulaId: 'fm_missing_dependency',
            columnId: 'missingDerived',
            label: 'Missing Derived',
            expression: 'missingColumn * 2',
            status: 'valid',
            dependsOn: ['missingColumn'],
          },
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:05Z',
      nowMs: () => 6500,
    });

    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.transform.dataset-loss',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_missing_column',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusIssue',
            }),
            expect.objectContaining({
              command: 'repair.focusTransform',
              args: expect.objectContaining({
                transformId: 'tf_missing_column',
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.formula.missing-dependency',
          source: expect.objectContaining({
            entityType: 'formula',
            entityId: 'fm_missing_dependency',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusIssue',
            }),
            expect.objectContaining({
              command: 'repair.focusFormula',
              args: expect.objectContaining({
                formulaId: 'fm_missing_dependency',
              }),
            }),
          ]),
        }),
      ]),
    );
  });

  it('creates a placeholder recovery graph when validation removes every saved graph', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:34:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            ...graphDefinitionFixture,
            graphId: 'graph_missing_dataset',
            title: 'Missing Dataset Graph',
            datasetId: 'ds_missing',
            status: 'reference',
            evidenceIds: [],
            issueIds: [],
          },
        ],
        activeGraphId: 'graph_missing_dataset',
        referenceGraphId: 'graph_missing_dataset',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:34:05Z',
      nowMs: () => 7000,
    });

    expect(reopened.snapshot.graphDefinitions).toEqual([
      expect.objectContaining({
        graphId: 'graph_recovery_ws_2026_04_15_001',
        title: 'Recovery Required',
        datasetId: 'ds_main',
      }),
    ]);
    expect(reopened.snapshot.activeGraphId).toBe('graph_recovery_ws_2026_04_15_001');
    expect(reopened.snapshot.referenceGraphId).toBe('graph_recovery_ws_2026_04_15_001');
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.missing-dataset',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.graph.none-recoverable',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('drops transient reopen issues from saved snapshots and allocates fresh reopen issue ids', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:36:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        compatibility: {
          minReadableAppBuild: '0.1.0',
          maxTestedAppBuild: '0.2.x',
        },
        graphDefinitions: [
          {
            ...graphDefinitionFixture,
            graphId: 'graph_missing_dataset',
            title: 'Missing Dataset Graph',
            datasetId: 'ds_missing',
            status: 'reference',
            evidenceIds: [],
            issueIds: ['workspace.reopen.001'],
          },
        ],
        activeGraphId: 'graph_missing_dataset',
        referenceGraphId: 'graph_missing_dataset',
        issues: [
          {
            issueId: 'workspace.reopen.001',
            kind: 'workspace.reopen.compatibility.blocked',
            severity: 'blocking',
            status: 'open',
            detectedAt: '2026-04-16T18:35:59Z',
            source: {
              module: 'workspace-persistence',
              entityType: 'workspace',
              entityId: workspaceSnapshotFixture.workspaceId,
            },
            title: 'Previously blocked reopen',
            detail: 'This transient issue should not survive another reopen.',
            userMessage: 'Blocked during a previous reopen.',
            contextRef: {
              routeKey: 'workspaceDetail',
              workspaceId: workspaceSnapshotFixture.workspaceId,
              panel: 'repair',
            },
            repairActions: [],
            diagnostics: {},
          },
        ],
        readiness: {
          ...workspaceSnapshotFixture.readiness,
          status: 'blocked',
          blockingIssueIds: ['workspace.reopen.001'],
          warningIssueIds: [],
        },
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope: {
        ...compatibilityEnvelope,
        currentAppBuildVersion: '0.2.0',
      },
      now: () => '2026-04-16T18:36:05Z',
      nowMs: () => 8000,
    });

    expect(reopened.snapshot.issues.some((issue) => issue.issueId === 'workspace.reopen.001')).toBe(false);
    expect(reopened.snapshot.issues.some((issue) => issue.kind === 'workspace.reopen.compatibility.blocked')).toBe(false);
    expect(reopened.snapshot.readiness.blockingIssueIds).not.toContain('workspace.reopen.001');
    expect(new Set(reopened.localizedIssues.map((issue) => issue.issueId)).size).toBe(reopened.localizedIssues.length);
    expect(reopened.localizedIssues.map((issue) => issue.issueId)).toEqual(
      expect.arrayContaining(['workspace.reopen.002', 'workspace.reopen.003']),
    );
  });

  it('reports compatibility against the build that reopened the workspace', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:38:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        compatibility: {
          ...workspaceSnapshotFixture.compatibility,
          maxTestedAppBuild: '0.1.x',
        },
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope: {
        ...compatibilityEnvelope,
        currentAppBuildVersion: '0.2.0',
      },
      now: () => '2026-04-16T18:38:05Z',
      nowMs: () => 9000,
    });

    expect(reopened.snapshot.appBuildVersion).toBe('0.2.0');
    expect(selectCompatibilityState(reopened.snapshot)).toMatchObject({
      appBuildVersion: '0.2.0',
      isReadable: true,
      isTested: false,
    });
  });

  it('preserves readiness-owned ids and explicit blocked state during reopen', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:39:00Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        readiness: {
          status: 'blocked',
          blockingIssueIds: ['repair.blocked.externally'],
          warningIssueIds: ['issue_missing_reviewer_note'],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:39:05Z',
      nowMs: () => 9500,
    });

    expect(reopened.snapshot.readiness).toEqual({
      status: 'blocked',
      blockingIssueIds: ['repair.blocked.externally'],
      warningIssueIds: ['issue_missing_reviewer_note'],
      provenanceCompleteness: 'complete',
    });
  });

  it('drops readiness references to persisted issues that fail issue-record validation', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:39:30Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        issues: [
          {
            issueId: 'issue_invalid_reopen_payload',
            kind: 'workspace.reopen.graph.invalid-contract',
            severity: 'blocking',
            status: 'open',
            detectedAt: '2026-04-16T18:39:29Z',
            source: {
              module: 'workspace-persistence',
              entityType: 'workspace',
              entityId: workspaceSnapshotFixture.workspaceId,
            },
            title: '',
            detail: 'Invalid persisted issue payload.',
            userMessage: 'Invalid persisted issue payload.',
            contextRef: {
              routeKey: 'workspaceDetail',
              workspaceId: workspaceSnapshotFixture.workspaceId,
              panel: 'repair',
            },
            repairActions: [],
            diagnostics: {},
          },
        ],
        readiness: {
          status: 'blocked',
          blockingIssueIds: ['issue_invalid_reopen_payload'],
          warningIssueIds: ['issue_missing_reviewer_note'],
          provenanceCompleteness: 'complete',
        },
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:39:35Z',
      nowMs: () => 9600,
    });

    expect(reopened.snapshot.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: 'issue_invalid_reopen_payload',
        }),
      ]),
    );
    expect(reopened.snapshot.readiness).toEqual({
      status: 'warning',
      blockingIssueIds: [],
      warningIssueIds: ['issue_missing_reviewer_note', 'workspace.reopen.001'],
      provenanceCompleteness: 'complete',
    });
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.issue.invalid-contract',
        }),
      ]),
    );
  });
});
