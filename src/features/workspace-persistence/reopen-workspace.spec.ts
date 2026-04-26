import { describe, expect, it } from 'vitest';

import { selectCompatibilityState } from '../../domain/trust';
import type { PersistedWorkspaceRecord } from '../../services/persistence';
import { graphDefinitionFixture } from '../../test/fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  collectAvailableFormulaDependencyIds,
  reopenPersistedWorkspaceRecord,
  reopenWorkspaceKernel,
  type WorkspaceCompatibilityEnvelope,
} from './reopen-workspace';

const compatibilityEnvelope: WorkspaceCompatibilityEnvelope = {
  currentAppBuildVersion: '0.1.0',
  minimumReadableWorkspaceFormat: '1.0.0',
  maximumReadableWorkspaceFormat: '1.x',
  migrationPolicy: 'migrate-on-open',
};

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

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

    expect(reopened.snapshot.transformPipeline).toEqual(workspaceSnapshotFixture.transformPipeline);
    expect(reopened.snapshot.formulaColumns).toEqual(workspaceSnapshotFixture.formulaColumns);
    expect(reopened.snapshot.evidence).toEqual(workspaceSnapshotFixture.evidence);
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.invalid-contract',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.transform.dataset-loss',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_missing_column',
          }),
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

  it('preserves transforms on surviving datasets when unrelated dataset entries fail validation', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:06Z',
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
          ...structuredClone(workspaceSnapshotFixture.transformPipeline),
          {
            transformId: 'tf_invalid_dataset_filter',
            kind: 'filter',
            status: 'applied',
            order: 2,
            expression: "brokenColumn == 'PASS'",
            dependencyMetadata: {
              datasetId: 'ds_invalid',
              dependsOnColumnIds: ['brokenColumn'],
              producesColumnIds: [],
              upstreamTransformIds: [],
            },
          },
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:07Z',
      nowMs: () => 6025,
    });

    expect(reopened.snapshot.transformPipeline).toEqual(workspaceSnapshotFixture.transformPipeline);
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.invalid-contract',
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.transform.missing-dataset',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_invalid_dataset_filter',
          }),
        }),
      ]),
    );
    expect(reopened.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.transform.dataset-loss',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_filter_high_quality',
          }),
        }),
      ]),
    );
  });

  it('localizes missing persisted file handles to the affected dataset while preserving reopen state', () => {
    const rawRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:10Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      datasetFileHandles: [],
      ledger: structuredClone(workspaceLedgerFixture),
    } as PersistedWorkspaceRecord;

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:15Z',
      nowMs: () => 6100,
    });

    expect(reopened.snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
      }),
    ]);
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
          userMessage:
            'The source file handle for dataset "battery-cycles.csv" is missing. The dataset remains available, but it may need to be re-linked before source-backed repairs can continue.',
          diagnostics: expect.objectContaining({
            datasetId: 'ds_main',
            fileName: 'battery-cycles.csv',
            fileHandleToken: 'dataset.ds_main.source-file',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusDataset',
              args: expect.objectContaining({
                datasetId: 'ds_main',
              }),
            }),
          ]),
        }),
      ]),
    );
  });

  it('treats token-only dataset file-handle matches as incompatible when dataset metadata drifted', () => {
    const rawRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:20Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      datasetFileHandles: [
        {
          datasetId: 'ds_other',
          fileName: 'different-source.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: {
            name: 'different-source.csv',
            async getFile() {
              return {
                name: 'different-source.csv',
              } as File;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
      ],
      ledger: structuredClone(workspaceLedgerFixture),
    } as PersistedWorkspaceRecord;

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:25Z',
      nowMs: () => 6150,
    });

    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
          diagnostics: expect.objectContaining({
            datasetId: 'ds_main',
            fileName: 'battery-cycles.csv',
            fileHandleToken: 'dataset.ds_main.source-file',
          }),
        }),
      ]),
    );
  });

  it('treats persisted file handles as incompatible when the handle object name does not match the dataset source file', () => {
    const rawRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:27Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: {
            name: 'different-source.csv',
            async getFile() {
              return {
                name: 'different-source.csv',
              } as File;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
      ],
      ledger: structuredClone(workspaceLedgerFixture),
    } as PersistedWorkspaceRecord;

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:28Z',
      nowMs: () => 6175,
    });

    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
        }),
      ]),
    );
  });

  it('sanitizes and filters persisted file handles before direct reopen issue localization', async () => {
    const validFile = new File(['live'], 'battery-cycles.csv', {
      lastModified: 1713830400000,
    });
    const extraFile = new File(['extra'], 'extra.csv', {
      lastModified: 1713830400000,
    });
    let extraHandleReadCount = 0;
    const record: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:29Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          fileSize: validFile.size,
          fileLastModified: validFile.lastModified,
          fileSha256: 'digest-does-not-match-live-file',
          handle: {
            name: 'battery-cycles.csv',
            async getFile() {
              return validFile;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
        {
          datasetId: 'ds_extra',
          fileName: 'extra.csv',
          fileHandleToken: 'dataset.ds_extra.source-file',
          fileSize: extraFile.size,
          fileLastModified: extraFile.lastModified,
          fileSha256: await sha256Hex(extraFile),
          handle: {
            name: 'extra.csv',
            async getFile() {
              extraHandleReadCount += 1;

              return extraFile;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
      ],
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const session = await reopenWorkspaceKernel({
      repository: {
        async loadWorkspaceRecord() {
          return record;
        },
        async saveCanonicalWorkspace() {
          throw new Error('Not used by reopen.');
        },
        async listWorkspaces() {
          return [];
        },
      },
      workspaceId: record.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:29Z',
      nowMs: () => 6180,
    });

    expect(extraHandleReadCount).toBe(0);
    expect(session.kernelStore.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(session.report.snapshot.datasets[0]).not.toHaveProperty('sourceFile');
    expect(session.kernelStore.getState().selectors.persistedWorkspace().datasets[0]).not.toHaveProperty('sourceFile');
    expect(session.report.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityType: 'dataset',
            entityId: 'ds_main',
          }),
        }),
      ]),
    );
  });

  it('drops malformed persisted dataset-handle entries during direct reopen filtering', async () => {
    const validFile = new File(['live'], 'battery-cycles.csv', {
      lastModified: 1713830400000,
    });
    const record: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:29Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: [
          {
            ...structuredClone(workspaceSnapshotFixture.datasets[0]),
            sourceFile: {
              fileName: 'battery-cycles.csv',
              fileHandleToken: 'dataset.ds_main.source-file',
            },
          },
        ],
      },
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          fileSize: validFile.size,
          fileLastModified: validFile.lastModified,
          fileSha256: await sha256Hex(validFile),
          handle: {
            name: 'battery-cycles.csv',
            async getFile() {
              return validFile;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
        {
          datasetId: 'ds_main',
          fileName: 42,
          fileHandleToken: 'dataset.ds_main.source-file',
          handle: null,
        },
      ],
      ledger: structuredClone(workspaceLedgerFixture),
    } as unknown as PersistedWorkspaceRecord;

    const session = await reopenWorkspaceKernel({
      repository: {
        async loadWorkspaceRecord() {
          return record;
        },
        async saveCanonicalWorkspace() {
          throw new Error('Not used by reopen.');
        },
        async listWorkspaces() {
          return [];
        },
      },
      workspaceId: record.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:29Z',
      nowMs: () => 6180,
    });

    expect(session.kernelStore.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'ds_main',
        fileName: 'battery-cycles.csv',
      }),
    ]);
  });

  it('rejects invalid direct reopen records before reading persisted file handles', async () => {
    const file = new File(['live'], 'battery-cycles.csv', {
      lastModified: 1713830400000,
    });
    let handleReadCount = 0;
    const record = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:32:29Z',
      snapshot: {
        workspaceId: workspaceSnapshotFixture.workspaceId,
        workspaceFormatVersion: 'not-semver',
      },
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          fileSize: file.size,
          fileLastModified: file.lastModified,
          fileSha256: await sha256Hex(file),
          handle: {
            name: 'battery-cycles.csv',
            async getFile() {
              handleReadCount += 1;

              return file;
            },
            async createWritable() {
              return {
                async write() {},
                async close() {},
              };
            },
          },
        },
      ],
      ledger: structuredClone(workspaceLedgerFixture),
    } as unknown as PersistedWorkspaceRecord;

    await expect(reopenWorkspaceKernel({
      repository: {
        async loadWorkspaceRecord() {
          return record;
        },
        async saveCanonicalWorkspace() {
          throw new Error('Not used by reopen.');
        },
        async listWorkspaces() {
          return [];
        },
      },
      workspaceId: record.workspaceId,
      compatibilityEnvelope,
      now: () => '2026-04-16T18:32:29Z',
      nowMs: () => 6180,
    })).rejects.toThrow();

    expect(handleReadCount).toBe(0);
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
            entityType: 'graph-selection',
            entityId: 'active-graph-selection',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_scatter_secondary',
          }),
          detail:
            'Saved active graph selection "graph invalid/id" could not be restored, so graph "graph_scatter_secondary" was selected instead.',
          userMessage:
            'The saved active graph selection could not be restored. Graph "graph_scatter_secondary" was selected instead.',
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_scatter_secondary',
              }),
            }),
          ]),
          diagnostics: expect.objectContaining({
            selection: 'active',
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
            entityType: 'graph-selection',
            entityId: 'active-graph-selection',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_scatter_secondary',
          }),
          detail:
            'Saved active graph selection "graph scatter secondary" was normalized to "graph_scatter_secondary" during reopen.',
          userMessage:
            'The saved active graph selection was normalized to "graph_scatter_secondary" during reopen.',
          diagnostics: expect.objectContaining({
            selection: 'active',
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
            entityType: 'graph-selection',
            entityId: 'reference-graph-selection',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_capacity_fade',
          }),
          detail:
            'Saved reference graph selection "graph capacity fade" was normalized to "graph_capacity_fade" during reopen.',
          userMessage:
            'The saved reference graph selection was normalized to "graph_capacity_fade" during reopen.',
          diagnostics: expect.objectContaining({
            selection: 'reference',
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

  it('uses persisted transform dependency metadata to localize stale transform steps without dropping unaffected legacy steps', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:10Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        transformPipeline: [
          {
            ...structuredClone(workspaceSnapshotFixture.transformPipeline[0]),
            dependencyMetadata: {
              datasetId: 'ds_main',
              dependsOnColumnIds: ['capacityRetention'],
              producesColumnIds: [],
              upstreamTransformIds: [],
            },
          },
          {
            transformId: 'tf_missing_dependency',
            kind: 'derive-column',
            status: 'applied',
            order: 2,
            expression: 'missingColumn * 2',
            dependencyMetadata: {
              datasetId: 'ds_main',
              dependsOnColumnIds: ['missingColumn'],
              producesColumnIds: ['missingDerived'],
              upstreamTransformIds: [],
            },
          },
          {
            transformId: 'tf_missing_upstream',
            kind: 'derive-column',
            status: 'applied',
            order: 3,
            expression: 'missingDerived * 3',
            dependencyMetadata: {
              datasetId: 'ds_main',
              dependsOnColumnIds: ['missingDerived'],
              producesColumnIds: ['missingUpstreamDerived'],
              upstreamTransformIds: ['tf_missing_dependency'],
            },
          },
          {
            transformId: 'tf_legacy_expression_only',
            kind: 'filter',
            status: 'applied',
            order: 4,
            expression: "qualityFlag == 'PASS'",
          },
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:15Z',
      nowMs: () => 6450,
    });

    expect(reopened.snapshot.transformPipeline.map((transform) => transform.transformId)).toEqual([
      'tf_filter_high_quality',
      'tf_legacy_expression_only',
    ]);
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.transform.missing-dependency',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_missing_dependency',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusTransform',
              args: expect.objectContaining({
                transformId: 'tf_missing_dependency',
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          kind: 'workspace.reopen.transform.missing-upstream',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_missing_upstream',
          }),
        }),
      ]),
    );
  });

  it('treats retained transform outputs as available formula dependencies during reopen', () => {
    const availableDependencyIds = collectAvailableFormulaDependencyIds({
      datasets: workspaceSnapshotFixture.datasets,
      transforms: [
        ...structuredClone(workspaceSnapshotFixture.transformPipeline),
        {
          transformId: 'tf_derived_quality_band',
          kind: 'derive-column',
          status: 'applied',
          order: 2,
          expression: 'capacityRetention > 0.92',
          dependencyMetadata: {
            datasetId: 'ds_main',
            dependsOnColumnIds: ['capacityRetention'],
            producesColumnIds: ['qualityBand'],
            upstreamTransformIds: ['tf_filter_high_quality'],
          },
        },
      ],
    });

    expect(availableDependencyIds.has('capacityRetention')).toBe(true);
    expect(availableDependencyIds.has('qualityBand')).toBe(true);
  });

  it('retains downstream transforms when upstream retained steps produce their required columns', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:18Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        transformPipeline: [
          {
            transformId: 'tf_derive_quality_band',
            kind: 'derive-column',
            status: 'applied',
            order: 1,
            expression: 'capacityRetention > 0.92',
            dependencyMetadata: {
              datasetId: 'ds_main',
              dependsOnColumnIds: ['capacityRetention'],
              producesColumnIds: ['qualityBand'],
              upstreamTransformIds: [],
            },
          },
          {
            transformId: 'tf_filter_quality_band',
            kind: 'filter',
            status: 'applied',
            order: 2,
            expression: "qualityBand == 'high'",
            dependencyMetadata: {
              datasetId: 'ds_main',
              dependsOnColumnIds: ['qualityBand'],
              producesColumnIds: [],
              upstreamTransformIds: ['tf_derive_quality_band'],
            },
          },
        ],
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:19Z',
      nowMs: () => 6475,
    });

    expect(reopened.snapshot.transformPipeline.map((transform) => transform.transformId)).toEqual([
      'tf_derive_quality_band',
      'tf_filter_quality_band',
    ]);
    expect(reopened.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.transform.missing-dependency',
          source: expect.objectContaining({
            entityType: 'transform',
            entityId: 'tf_filter_quality_band',
          }),
        }),
      ]),
    );
  });

  it('infers catalog metadata for legacy graphs and retains blocked compositions as stale repair scopes', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:20Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            ...structuredClone(graphDefinitionFixture),
            issueIds: [],
            evidenceIds: [],
          },
          {
            ...structuredClone(graphDefinitionFixture),
            graphId: 'graph_bar_regression',
            title: 'Bar With Regression',
            status: 'candidate',
            marks: ['bar'],
            roleAssignments: {
              x: ['temperatureBand'],
              y: ['capacityRetention'],
              color: [],
              size: [],
              facetRow: [],
              facetColumn: [],
            },
            overlays: [
              {
                overlayId: 'ov_linear_fit_bar',
                kind: 'regression',
                method: 'linear',
                status: 'ready',
                catalogOverlayId: 'regression_linear',
              },
            ],
            family: 'bar',
            templateId: 'tpl_bar_grouped_compare',
            issueIds: [],
            evidenceIds: [],
          },
        ],
        activeGraphId: 'graph_bar_regression',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:25Z',
      nowMs: () => 6500,
    });

    expect(reopened.snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_capacity_fade',
          family: 'scatter',
          templateId: 'tpl_scatter_regression',
          overlays: [
            expect.objectContaining({
              overlayId: 'ov_linear_fit',
              catalogOverlayId: 'regression_linear',
            }),
          ],
        }),
        expect.objectContaining({
          graphId: 'graph_bar_regression',
          status: 'stale',
          family: 'bar',
          templateId: 'tpl_bar_grouped_compare',
        }),
      ]),
    );
    expect(reopened.snapshot.activeGraphId).toBe('graph_capacity_fade');
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_bar_regression',
          }),
          contextRef: expect.objectContaining({
            graphId: 'graph_bar_regression',
          }),
          repairActions: expect.arrayContaining([
            expect.objectContaining({
              command: 'repair.focusGraph',
              args: expect.objectContaining({
                graphId: 'graph_bar_regression',
              }),
            }),
          ]),
          diagnostics: expect.objectContaining({
            family: 'bar',
            blockedReasons: expect.arrayContaining([
              expect.stringContaining('regression_linear'),
            ]),
          }),
        }),
      ]),
    );
    expect(
      reopened.snapshot.graphDefinitions.find((graph) => graph.graphId === 'graph_bar_regression')?.issueIds,
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^workspace\.reopen\./),
      ]),
    );
  });

  it('keeps legacy binned-bar histograms that omit persisted family and template metadata', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:30Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            ...structuredClone(graphDefinitionFixture),
            issueIds: [],
            evidenceIds: [],
          },
          {
            graphId: 'graph_legacy_histogram',
            title: 'Legacy Histogram',
            status: 'candidate',
            datasetId: 'ds_main',
            roleAssignments: {
              x: ['capacityRetention'],
              y: [],
              color: [],
              size: [],
              facetRow: [],
              facetColumn: [],
            },
            marks: ['binned-bar'],
            overlays: [
              {
                overlayId: 'ov_reference_line_histogram',
                kind: 'reference',
                method: 'line',
                status: 'ready',
              },
            ],
            presentation: {
              xAxisLabel: 'Capacity Retention (%)',
              yAxisLabel: 'Count',
              legendPosition: 'right',
            },
            issueIds: [],
            evidenceIds: [],
          },
        ],
        activeGraphId: 'graph_legacy_histogram',
        referenceGraphId: 'graph_capacity_fade',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:35Z',
      nowMs: () => 6750,
    });

    expect(reopened.snapshot.activeGraphId).toBe('graph_legacy_histogram');
    expect(reopened.snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_legacy_histogram',
          family: 'histogram',
          templateId: 'tpl_histogram_distribution',
          overlays: [
            expect.objectContaining({
              overlayId: 'ov_reference_line_histogram',
              catalogOverlayId: 'reference_line',
            }),
          ],
        }),
      ]),
    );
    expect(reopened.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_legacy_histogram',
          }),
        }),
      ]),
    );
  });

  it('derives overlay catalog ids from overlay semantics when persisted metadata is contradictory', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:40Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            ...structuredClone(graphDefinitionFixture),
            graphId: 'graph_reference_overlay_semantics',
            title: 'Reference Overlay Semantics',
            status: 'candidate',
            overlays: [
              {
                overlayId: 'ov_reference_line_semantics',
                kind: 'reference',
                method: 'line',
                status: 'ready',
                catalogOverlayId: 'regression_linear',
              },
            ],
            issueIds: [],
            evidenceIds: [],
          },
        ],
        activeGraphId: 'graph_reference_overlay_semantics',
        referenceGraphId: 'graph_reference_overlay_semantics',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:45Z',
      nowMs: () => 6900,
    });

    expect(reopened.snapshot.graphDefinitions).toEqual([
      expect.objectContaining({
        graphId: 'graph_reference_overlay_semantics',
        overlays: [
          expect.objectContaining({
            overlayId: 'ov_reference_line_semantics',
            catalogOverlayId: 'reference_line',
          }),
        ],
      }),
    ]);
    expect(reopened.localizedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_reference_overlay_semantics',
          }),
        }),
      ]),
    );
  });

  it('rejects overlays whose persisted catalog ids contradict unsupported saved semantics', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:42Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            ...structuredClone(graphDefinitionFixture),
            graphId: 'graph_invalid_regression_overlay',
            title: 'Unsupported Regression Overlay',
            status: 'candidate',
            overlays: [
              {
                overlayId: 'ov_quadratic_fit',
                kind: 'regression',
                method: 'quadratic',
                status: 'ready',
                catalogOverlayId: 'regression_linear',
              },
            ],
            issueIds: [],
            evidenceIds: [],
          },
        ],
        activeGraphId: 'graph_invalid_regression_overlay',
        referenceGraphId: 'graph_invalid_regression_overlay',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:43Z',
      nowMs: () => 6925,
    });

    expect(reopened.snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_invalid_regression_overlay',
          status: 'stale',
          overlays: [
            expect.not.objectContaining({
              catalogOverlayId: 'regression_linear',
            }),
          ],
        }),
      ]),
    );
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_invalid_regression_overlay',
          }),
          diagnostics: expect.objectContaining({
            blockedReasons: expect.arrayContaining([
              expect.stringContaining('locked MVP overlay catalog'),
            ]),
          }),
        }),
      ]),
    );
  });

  it('rejects histograms that attempt faceting in the locked catalog', () => {
    const rawRecord: PersistedWorkspaceRecord = {
      workspaceId: workspaceSnapshotFixture.workspaceId,
      savedAt: '2026-04-16T18:33:44Z',
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        graphDefinitions: [
          {
            graphId: 'graph_faceted_histogram',
            title: 'Faceted Histogram',
            status: 'candidate',
            datasetId: 'ds_main',
            family: 'histogram',
            templateId: 'tpl_histogram_distribution',
            roleAssignments: {
              x: ['capacityRetention'],
              y: [],
              color: [],
              size: [],
              facetRow: ['temperatureBand'],
              facetColumn: [],
            },
            marks: ['binned-bar'],
            overlays: [],
            presentation: {
              xAxisLabel: 'Capacity Retention (%)',
              yAxisLabel: 'Count',
              legendPosition: 'right',
            },
            issueIds: [],
            evidenceIds: [],
          },
        ],
        activeGraphId: 'graph_faceted_histogram',
        referenceGraphId: 'graph_faceted_histogram',
      },
      ledger: structuredClone(workspaceLedgerFixture),
    };

    const reopened = reopenPersistedWorkspaceRecord(rawRecord, {
      compatibilityEnvelope,
      now: () => '2026-04-16T18:33:45Z',
      nowMs: () => 6950,
    });

    expect(reopened.snapshot.graphDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          graphId: 'graph_faceted_histogram',
          status: 'stale',
        }),
      ]),
    );
    expect(reopened.localizedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.incompatible-composition',
          source: expect.objectContaining({
            entityType: 'graph',
            entityId: 'graph_faceted_histogram',
          }),
          diagnostics: expect.objectContaining({
            blockedReasons: expect.arrayContaining([
              expect.stringContaining('cannot use row or column faceting'),
            ]),
          }),
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
