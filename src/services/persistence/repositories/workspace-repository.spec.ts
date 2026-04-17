import { describe, expect, it } from 'vitest';

import type { GraphDefinition, WorkspaceSnapshot } from '../../../schemas/workspace';
import { graphDefinitionFixture } from '../../../test/fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../../test/fixtures/workspace/workspace-snapshot.fixture';
import type { PersistedWorkspaceRecord, WorkspacePersistenceStorage } from './workspace-repository';
import { InMemoryWorkspaceStorage, createWorkspaceRepository } from './workspace-repository';

describe('WorkspaceRepository', () => {
  it('stores canonical snapshot-plus-ledger records and lists saved workspaces', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const secondaryGraph: GraphDefinition = {
      ...graphDefinitionFixture,
      graphId: 'graph_scatter_secondary',
      title: 'Scatter Investigation',
      status: 'candidate',
      evidenceIds: [],
      issueIds: [],
    };
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      graphDefinitions: [
        graphDefinitionFixture,
        secondaryGraph,
      ],
      activeGraphId: 'graph_scatter_secondary',
      referenceGraphId: 'graph_capacity_fade',
    };

    await repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:20:00Z',
      benchmarkKey: 'benchmark_workspace_local',
    });

    const record = await repository.loadWorkspaceRecord(snapshot.workspaceId);
    const summaries = await repository.listWorkspaces();

    expect(record).toMatchObject({
      workspaceId: snapshot.workspaceId,
      savedAt: '2026-04-16T18:20:00Z',
      benchmarkKey: 'benchmark_workspace_local',
      snapshot,
      ledger: workspaceLedgerFixture,
    });
    expect(summaries).toEqual([
      {
        workspaceId: snapshot.workspaceId,
        savedAt: '2026-04-16T18:20:00Z',
        datasetCount: 1,
        graphCount: 2,
        benchmarkKey: 'benchmark_workspace_local',
      },
    ]);
  });

  it('rejects unordered ledger entries on save', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const unorderedLedger = [
      workspaceLedgerFixture[1],
      workspaceLedgerFixture[0],
    ].filter((entry) => entry !== undefined);

    await expect(
      repository.saveCanonicalWorkspace({
        snapshot: workspaceSnapshotFixture,
        ledger: unorderedLedger,
        savedAt: '2026-04-16T18:22:00Z',
      }),
    ).rejects.toThrow(/ledger/i);
  });

  it('rejects regressing workspace versions on save', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const regressingLedger = [
      workspaceLedgerFixture[0]!,
      {
        ...workspaceLedgerFixture[1]!,
        workspaceVersion: 16,
      },
    ];

    await expect(
      repository.saveCanonicalWorkspace({
        snapshot: workspaceSnapshotFixture,
        ledger: regressingLedger,
        savedAt: '2026-04-16T18:23:00Z',
      }),
    ).rejects.toThrow(/workspace versions/i);
  });

  it('sorts workspace summaries newest-first regardless of storage adapter ordering', async () => {
    const storage: WorkspacePersistenceStorage = {
      async putRecord() {},
      async getRecord() {
        return null;
      },
      async listRecords() {
        const olderRecord: PersistedWorkspaceRecord = {
          workspaceId: 'ws_older',
          savedAt: '2026-04-16T18:10:00Z',
          snapshot: structuredClone(workspaceSnapshotFixture),
          ledger: structuredClone(workspaceLedgerFixture),
        };
        const newerRecord: PersistedWorkspaceRecord = {
          workspaceId: 'ws_newer',
          savedAt: '2026-04-16T18:30:00Z',
          snapshot: structuredClone(workspaceSnapshotFixture),
          ledger: structuredClone(workspaceLedgerFixture),
        };

        return [olderRecord, newerRecord];
      },
    };
    const repository = createWorkspaceRepository(storage);

    const summaries = await repository.listWorkspaces();

    expect(summaries.map((summary) => summary.workspaceId)).toEqual(['ws_newer', 'ws_older']);
  });

  it('sorts workspace summaries by actual timestamp rather than lexicographic order', async () => {
    const storage: WorkspacePersistenceStorage = {
      async putRecord() {},
      async getRecord() {
        return null;
      },
      async listRecords() {
        const newerFractionalRecord: PersistedWorkspaceRecord = {
          workspaceId: 'ws_newer_fractional',
          savedAt: '2026-04-16T18:30:00.500Z',
          snapshot: structuredClone(workspaceSnapshotFixture),
          ledger: structuredClone(workspaceLedgerFixture),
        };
        const olderWholeSecondRecord: PersistedWorkspaceRecord = {
          workspaceId: 'ws_older_whole_second',
          savedAt: '2026-04-16T18:30:00Z',
          snapshot: structuredClone(workspaceSnapshotFixture),
          ledger: structuredClone(workspaceLedgerFixture),
        };

        return [olderWholeSecondRecord, newerFractionalRecord];
      },
    };
    const repository = createWorkspaceRepository(storage);

    const summaries = await repository.listWorkspaces();

    expect(summaries.map((summary) => summary.workspaceId)).toEqual([
      'ws_newer_fractional',
      'ws_older_whole_second',
    ]);
  });
});
