import { describe, expect, it, vi } from 'vitest';

import type { GraphDefinition, WorkspaceSnapshot } from '../../../schemas/workspace';
import { graphDefinitionFixture } from '../../../test/fixtures/workspace/graph-definition.fixture';
import { workspaceLedgerFixture } from '../../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../../test/fixtures/workspace/workspace-snapshot.fixture';
import type {
  PersistedDatasetFileHandle,
  PersistedWorkspaceRecord,
  WorkspacePersistenceStorage,
} from './workspace-repository';
import { InMemoryWorkspaceStorage, createWorkspaceRepository } from './workspace-repository';

function createWorkspaceFileHandle(fileRef: { current: File }) {
  return {
    name: fileRef.current.name,
    async getFile() {
      return fileRef.current;
    },
    async createWritable() {
      return {
        async write() {},
        async close() {},
      };
    },
  };
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

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

  it('round-trips persisted dataset file handles through the default in-memory storage adapter', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const fileRef = {
      current: new File(['cycle,reading\n1,42.5'], 'battery-cycles.csv', {
        lastModified: 1713830400000,
      }),
    };
    const handle = createWorkspaceFileHandle(fileRef);
    const datasetFileHandles: PersistedDatasetFileHandle[] = [
      {
        datasetId: 'ds_main',
        fileName: 'battery-cycles.csv',
        fileHandleToken: 'dataset.ds_main.source-file',
        fileSize: fileRef.current.size,
        fileLastModified: fileRef.current.lastModified,
        fileSha256: await sha256Hex(fileRef.current),
        handle,
      },
    ];
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
        ...structuredClone(dataset),
        sourceFile: {
          fileName: dataset.displayName,
          fileHandleToken: `dataset.${dataset.datasetId}.source-file`,
        },
      })),
    };

    await repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:21:00Z',
      datasetFileHandles,
    });

    const record = await repository.loadWorkspaceRecord(snapshot.workspaceId);

    expect(record).toMatchObject({
      datasetFileHandles: [
        expect.objectContaining({
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          fileSha256: expect.any(String),
        }),
      ],
    });
    expect((record?.datasetFileHandles?.[0] as PersistedDatasetFileHandle | undefined)?.handle).toBe(handle);
  });

  it('rejects stale prefilled dataset file-handle digests by rereading live bytes before save', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const originalFile = new File(['cycle,reading\n1,42.5'], 'battery-cycles.csv', {
      lastModified: 1713830400000,
    });
    const fileRef = {
      current: originalFile,
    };
    const handle = createWorkspaceFileHandle(fileRef);
    const staleDigest = await sha256Hex(originalFile);

    fileRef.current = new File(['cycle,reading\n1,99.9'], 'battery-cycles.csv', {
      lastModified: 1713830400000,
    });

    await repository.saveCanonicalWorkspace({
      snapshot: {
        ...structuredClone(workspaceSnapshotFixture),
        datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
          ...structuredClone(dataset),
          sourceFile: {
            fileName: 'battery-cycles.csv',
            fileHandleToken: 'dataset.ds_main.source-file',
          },
        })),
      },
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:24:00Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_main',
          fileName: 'battery-cycles.csv',
          fileHandleToken: 'dataset.ds_main.source-file',
          fileSize: originalFile.size,
          fileLastModified: originalFile.lastModified,
          fileSha256: staleDigest,
          handle,
        },
      ],
    });

    const record = await repository.loadWorkspaceRecord(workspaceSnapshotFixture.workspaceId);

    expect(record?.datasetFileHandles).toEqual([]);
    expect((record?.snapshot as WorkspaceSnapshot | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
  });

  it('serializes final dataset file-handle verification reads', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const files = [
      new File(['cycle,reading\n1,42.5'], 'battery-a.csv', {
        lastModified: 1713830400000,
      }),
      new File(['cycle,reading\n2,44.1'], 'battery-b.csv', {
        lastModified: 1713830400000,
      }),
    ];
    let activeReads = 0;
    let maxConcurrentReads = 0;
    const createTrackedHandle = (file: File) => ({
      name: file.name,
      async getFile() {
        activeReads += 1;
        maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);

        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        activeReads -= 1;

        return file;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    });

    await repository.saveCanonicalWorkspace({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:25:00Z',
      datasetFileHandles: await Promise.all(files.map(async (file, index) => ({
        datasetId: `ds_${index + 1}`,
        fileName: file.name,
        fileHandleToken: `dataset.ds_${index + 1}.source-file`,
        fileSize: file.size,
        fileLastModified: file.lastModified,
        fileSha256: await sha256Hex(file),
        handle: createTrackedHandle(file),
      }))),
    });

    expect(maxConcurrentReads).toBe(1);
  });

  it('stops final dataset file-handle verification when save becomes stale', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const files = [
      new File(['cycle,reading\n1,42.5'], 'battery-a.csv', {
        lastModified: 1713830400000,
      }),
      new File(['cycle,reading\n2,44.1'], 'battery-b.csv', {
        lastModified: 1713830400000,
      }),
    ];
    let firstHandleRead = false;
    let secondHandleRead = false;
    let stale = false;

    const datasetFileHandles = await Promise.all(files.map(async (file, index) => ({
      datasetId: `ds_${index + 1}`,
      fileName: file.name,
      fileHandleToken: `dataset.ds_${index + 1}.source-file`,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileSha256: await sha256Hex(file),
      handle: {
        name: file.name,
        async getFile() {
          if (index === 0) {
            firstHandleRead = true;
            stale = true;
          } else {
            secondHandleRead = true;
          }

          return file;
        },
        async createWritable() {
          return {
            async write() {},
            async close() {},
          };
        },
      },
    } satisfies PersistedDatasetFileHandle)));

    await expect(repository.saveCanonicalWorkspace({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:25:30Z',
      datasetFileHandles,
      assertNotStale() {
        if (stale) {
          throw new Error('Workspace save became stale.');
        }
      },
    })).rejects.toThrow('Workspace save became stale.');

    expect(firstHandleRead).toBe(true);
    expect(secondHandleRead).toBe(false);
  });

  it('rejects save cancellation while final file byte verification is pending', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const trustedFile = new File(['cycle,reading\n1,42.5'], 'battery-a.csv', {
      lastModified: 1713830400000,
    });
    const hangingFile = new File(['cycle,reading\n1,42.5'], 'battery-a.csv', {
      lastModified: 1713830400000,
    });
    vi.spyOn(hangingFile, 'arrayBuffer').mockReturnValue(new Promise<ArrayBuffer>(() => {}));
    const abortController = new AbortController();
    const save = repository.saveCanonicalWorkspace({
      snapshot: workspaceSnapshotFixture,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:25:30Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_1',
          fileName: hangingFile.name,
          fileHandleToken: 'dataset.ds_1.source-file',
          fileSize: hangingFile.size,
          fileLastModified: hangingFile.lastModified,
          fileSha256: await sha256Hex(trustedFile),
          handle: createWorkspaceFileHandle({ current: hangingFile }),
        },
      ],
      requiredDatasetFileHandleDatasetIds: ['ds_1'],
      abortSignal: abortController.signal,
    });

    await Promise.resolve();
    abortController.abort(new Error('Workspace save became stale.'));

    await expect(save).rejects.toThrow('Workspace save became stale.');
  });

  it('rejects required source-backed repository saves when a same-dataset handle does not match snapshot source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const foreignFile = new File(['cycle,reading\n1,42.5'], 'foreign.csv', {
      lastModified: 1713830400000,
    });
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
        ...structuredClone(dataset),
        datasetId: 'ds_1',
        sourceFile: {
          fileName: 'expected.csv',
          fileHandleToken: 'expected_token',
        },
      })),
    };

    await expect(repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:25:45Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_1',
          fileName: 'foreign.csv',
          fileHandleToken: 'foreign_token',
          fileSize: foreignFile.size,
          fileLastModified: foreignFile.lastModified,
          fileSha256: await sha256Hex(foreignFile),
          handle: createWorkspaceFileHandle({ current: foreignFile }),
        },
      ],
      requiredDatasetFileHandleDatasetIds: ['ds_1'],
    })).rejects.toThrow('Source file provenance could not be verified');

    await expect(repository.loadWorkspaceRecord(snapshot.workspaceId)).resolves.toBeNull();
  });

  it('does not let a later same-dataset handle rewrite required source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const expectedFileRef = {
      current: new File(['cycle,reading\n1,42.5'], 'expected.csv', {
        lastModified: 1713830400000,
      }),
    };
    const foreignFileRef = {
      current: new File(['cycle,reading\n1,99.9'], 'foreign.csv', {
        lastModified: 1713830400000,
      }),
    };
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
        ...structuredClone(dataset),
        datasetId: 'ds_1',
        sourceFile: {
          fileName: 'expected.csv',
          fileHandleToken: 'expected_token',
        },
      })),
    };

    await repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:26:00Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_1',
          fileName: 'expected.csv',
          fileHandleToken: 'expected_token',
          fileSize: expectedFileRef.current.size,
          fileLastModified: expectedFileRef.current.lastModified,
          fileSha256: await sha256Hex(expectedFileRef.current),
          handle: createWorkspaceFileHandle(expectedFileRef),
        },
        {
          datasetId: 'ds_1',
          fileName: 'foreign.csv',
          fileHandleToken: 'foreign_token',
          fileSize: foreignFileRef.current.size,
          fileLastModified: foreignFileRef.current.lastModified,
          fileSha256: await sha256Hex(foreignFileRef.current),
          handle: createWorkspaceFileHandle(foreignFileRef),
        },
      ],
      requiredDatasetFileHandleDatasetIds: ['ds_1'],
    });

    const record = await repository.loadWorkspaceRecord(snapshot.workspaceId);

    expect((record?.snapshot as WorkspaceSnapshot | undefined)?.datasets[0]?.sourceFile).toEqual({
      fileName: 'expected.csv',
      fileHandleToken: 'expected_token',
    });
    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'ds_1',
        fileName: 'expected.csv',
        fileHandleToken: 'expected_token',
      }),
    ]);
  });

  it('drops optional same-dataset handles that do not match snapshot source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const foreignFileRef = {
      current: new File(['cycle,reading\n1,99.9'], 'foreign.csv', {
        lastModified: 1713830400000,
      }),
    };
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: workspaceSnapshotFixture.datasets.map((dataset) => ({
        ...structuredClone(dataset),
        datasetId: 'ds_1',
        sourceFile: {
          fileName: 'expected.csv',
          fileHandleToken: 'expected_token',
        },
      })),
    };

    const result = await repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-16T18:26:30Z',
      datasetFileHandles: [
        {
          datasetId: 'ds_1',
          fileName: 'foreign.csv',
          fileHandleToken: 'foreign_token',
          fileSize: foreignFileRef.current.size,
          fileLastModified: foreignFileRef.current.lastModified,
          fileSha256: await sha256Hex(foreignFileRef.current),
          handle: createWorkspaceFileHandle(foreignFileRef),
        },
      ],
    });

    const record = await repository.loadWorkspaceRecord(snapshot.workspaceId);

    expect(result.datasetFileHandles).toEqual([]);
    expect(result.snapshot.datasets[0]).not.toHaveProperty('sourceFile');
    expect(record?.datasetFileHandles).toEqual([]);
    expect((record?.snapshot as WorkspaceSnapshot | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
  });

  it('does not reattach stale dataset file-handle provenance to handleless datasets', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const staleFileRef = {
      current: new File(['stale-live'], 'stale.csv', {
        lastModified: 1713830400000,
      }),
    };
    const snapshot: WorkspaceSnapshot = {
      ...structuredClone(workspaceSnapshotFixture),
      datasets: workspaceSnapshotFixture.datasets.map((dataset) => {
        const datasetWithoutSourceFile = {
          ...structuredClone(dataset),
          datasetId: 'dataset_handleless',
        };

        return datasetWithoutSourceFile;
      }),
      graphDefinitions: workspaceSnapshotFixture.graphDefinitions.map((graph) => ({
        ...structuredClone(graph),
        datasetId: 'dataset_handleless',
      })),
    };

    const result = await repository.saveCanonicalWorkspace({
      snapshot,
      ledger: workspaceLedgerFixture,
      savedAt: '2026-04-26T11:15:00Z',
      datasetFileHandles: [{
        datasetId: 'dataset_handleless',
        fileName: 'stale.csv',
        fileHandleToken: 'stale_token',
        fileSize: staleFileRef.current.size,
        fileLastModified: staleFileRef.current.lastModified,
        fileSha256: await sha256Hex(staleFileRef.current),
        handle: createWorkspaceFileHandle(staleFileRef),
      }],
    });

    const record = await storage.getRecord(snapshot.workspaceId);

    expect(result.datasetFileHandles).toEqual([]);
    expect(result.snapshot.datasets[0]).not.toHaveProperty('sourceFile');
    expect(record?.datasetFileHandles).toEqual([]);
    expect((record?.snapshot as WorkspaceSnapshot | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
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
