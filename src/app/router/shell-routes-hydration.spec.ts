import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveWorkspaceKernel } from '../../features/workspace-persistence';
import { createWorkspaceRepository, InMemoryWorkspaceStorage } from '../../services/persistence';
import { createImportWorkspaceSnapshot, IMPORT_BOOTSTRAP_DATASET_ID } from '../../stores/workspace-kernel';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  MAX_CACHED_WORKSPACE_KERNEL_STORES,
  resetWorkspaceKernelStoresForTest,
  resolveWorkspaceKernelStore,
} from './shell-routes';

describe('resolveWorkspaceKernelStore hydration', () => {
  beforeEach(() => {
    resetWorkspaceKernelStoresForTest();
  });

  it('does not rehydrate an already-live cached store with stale persisted state on remount', async () => {
    const workspaceId = 'workspace_demo_live';
    const hydratedSnapshot = structuredClone(workspaceSnapshotFixture);
    hydratedSnapshot.workspaceId = workspaceId;
    const initialRecord = {
      workspaceId,
      savedAt: '2026-04-22T14:30:00.000Z',
      snapshot: hydratedSnapshot,
      ledger: structuredClone(workspaceLedgerFixture),
    };
    const liveStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => initialRecord,
    });
    const liveSnapshot = structuredClone(workspaceSnapshotFixture);
    const liveDataset = structuredClone(workspaceSnapshotFixture.datasets[0]) as typeof workspaceSnapshotFixture.datasets[number];
    liveSnapshot.workspaceId = workspaceId;
    liveSnapshot.datasets = [
      {
        ...liveDataset,
        datasetId: 'dataset_live',
        displayName: 'Live canonical dataset',
      },
    ];

    liveStore.getState().commands.replaceSnapshot({
      snapshot: liveSnapshot,
      ledger: structuredClone(workspaceLedgerFixture),
    });

    const remountedStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        ...initialRecord,
        snapshot: {
          ...structuredClone(hydratedSnapshot),
          datasets: [
            {
              ...liveDataset,
              datasetId: 'dataset_stale',
              displayName: 'Stale persisted dataset',
            },
          ],
        },
      }),
    });

    expect(remountedStore).toBe(liveStore);
    expect(remountedStore.getState().snapshot.datasets).toEqual(liveSnapshot.datasets);
  });

  it('ignores persisted records that do not belong to the requested workspace id', async () => {
    const workspaceId = 'workspace_demo_requested';
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId: 'workspace_other',
        savedAt: '2026-04-22T15:00:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId: 'workspace_other',
        },
        ledger: structuredClone(workspaceLedgerFixture),
      }),
    });

    expect(store.getState().snapshot.workspaceId).toBe(workspaceId);
    expect(store.getState().snapshot.datasets).toMatchObject(bootstrapSnapshot.datasets);
    expect(store.getState().snapshot.datasets[0]?.datasetId).toBe(IMPORT_BOOTSTRAP_DATASET_ID);
    expect(store.getState().ledger).toEqual([]);
  });

  it('sanitizes persisted dataset file handles against the hydrated snapshot before installing them', async () => {
    const workspaceId = 'workspace_demo_handles';
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:15:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId,
          datasets: [
            {
              ...structuredClone(workspaceSnapshotFixture.datasets[0]),
              datasetId: 'dataset_live',
              sourceFile: {
                fileName: 'live.csv',
                fileHandleToken: 'live_token',
              },
            },
          ],
        },
        ledger: structuredClone(workspaceLedgerFixture),
        datasetFileHandles: [
          {
            datasetId: 'dataset_live',
            fileName: 'live.csv',
            fileHandleToken: 'live_token',
            fileSize: 4,
            fileLastModified: 1713830400000,
            handle: {
              name: 'live.csv',
              getFile: async () =>
                new File(['live'], 'live.csv', {
                  lastModified: 1713830400000,
                }),
              createWritable: async () => ({}),
            },
          },
          {
            datasetId: 'dataset_live',
            fileName: 'mismatch.csv',
            fileHandleToken: 'other_token',
            fileSize: 8,
            fileLastModified: 1713830401000,
            handle: {
              name: 'mismatch.csv',
              getFile: async () =>
                new File(['mismatch'], 'mismatch.csv', {
                  lastModified: 1713830401000,
                }),
              createWritable: async () => ({}),
            },
          },
          {
            datasetId: 'dataset_invalid handle',
            fileName: '',
            fileHandleToken: 'bad token',
            handle: {},
          },
        ],
      }),
    });

    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: 4,
        fileLastModified: 1713830400000,
        handle: expect.objectContaining({
          name: 'live.csv',
        }),
      },
    ]);
  });

  it('falls back to a clean bootstrap store when persisted workspace parsing fails', async () => {
    const workspaceId = 'workspace_demo_corrupt';
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:30:00.000Z',
        snapshot: {
          workspaceId,
          invalid: true,
        },
        ledger: [],
      }),
    });

    expect(store.getState().snapshot.workspaceId).toBe(workspaceId);
    expect(store.getState().snapshot.datasets).toMatchObject(bootstrapSnapshot.datasets);
    expect(store.getState().snapshot.datasets[0]?.datasetId).toBe(IMPORT_BOOTSTRAP_DATASET_ID);
    expect(store.getState().ledger).toEqual([]);
  });

  it('falls back to a clean bootstrap store when loading persisted workspace state rejects', async () => {
    const workspaceId = 'workspace_demo_load_failure';
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        throw new Error('transient IndexedDB read failure');
      },
    });

    expect(store.getState().snapshot.workspaceId).toBe(workspaceId);
    expect(store.getState().snapshot.datasets).toMatchObject(bootstrapSnapshot.datasets);
    expect(store.getState().snapshot.datasets[0]?.datasetId).toBe(IMPORT_BOOTSTRAP_DATASET_ID);
    expect(store.getState().ledger).toEqual([]);
  });

  it('retries persisted hydration after a transient read failure instead of latching the bootstrap store forever', async () => {
    const workspaceId = 'workspace_demo_retry_after_failure';
    let attemptCount = 0;
    const firstStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        attemptCount += 1;

        if (attemptCount === 1) {
          throw new Error('transient IndexedDB read failure');
        }

        return {
          workspaceId,
          savedAt: '2026-04-22T15:45:00.000Z',
          snapshot: {
            ...structuredClone(workspaceSnapshotFixture),
            workspaceId,
            datasets: [
              {
                ...structuredClone(workspaceSnapshotFixture.datasets[0]),
                datasetId: 'dataset_recovered',
                displayName: 'Recovered persisted dataset',
              },
            ],
          },
          ledger: structuredClone(workspaceLedgerFixture),
        };
      },
    });
    const retriedStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        attemptCount += 1;

        return {
          workspaceId,
          savedAt: '2026-04-22T15:45:00.000Z',
          snapshot: {
            ...structuredClone(workspaceSnapshotFixture),
            workspaceId,
            datasets: [
              {
                ...structuredClone(workspaceSnapshotFixture.datasets[0]),
                datasetId: 'dataset_recovered',
                displayName: 'Recovered persisted dataset',
              },
            ],
          },
          ledger: structuredClone(workspaceLedgerFixture),
        };
      },
    });

    expect(firstStore).toBe(retriedStore);
    expect(attemptCount).toBe(2);
    expect(retriedStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_recovered',
        displayName: 'Recovered persisted dataset',
      }),
    ]);
    expect(retriedStore.getState().ledger).toEqual(workspaceLedgerFixture);
  });

  it('retries persisted hydration after a transient parse failure instead of latching the bootstrap store forever', async () => {
    const workspaceId = 'workspace_demo_retry_after_parse_failure';
    let attemptCount = 0;
    const firstStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        attemptCount += 1;

        if (attemptCount === 1) {
          return {
            workspaceId,
            savedAt: '2026-04-22T15:50:00.000Z',
            snapshot: {
              workspaceId,
              invalid: true,
            },
            ledger: [],
          };
        }

        return {
          workspaceId,
          savedAt: '2026-04-22T15:51:00.000Z',
          snapshot: {
            ...structuredClone(workspaceSnapshotFixture),
            workspaceId,
            datasets: [
              {
                ...structuredClone(workspaceSnapshotFixture.datasets[0]),
                datasetId: 'dataset_recovered_after_parse',
                displayName: 'Recovered after parse retry',
              },
            ],
          },
          ledger: structuredClone(workspaceLedgerFixture),
        };
      },
    });
    const retriedStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        attemptCount += 1;

        return {
          workspaceId,
          savedAt: '2026-04-22T15:51:00.000Z',
          snapshot: {
            ...structuredClone(workspaceSnapshotFixture),
            workspaceId,
            datasets: [
              {
                ...structuredClone(workspaceSnapshotFixture.datasets[0]),
                datasetId: 'dataset_recovered_after_parse',
                displayName: 'Recovered after parse retry',
              },
            ],
          },
          ledger: structuredClone(workspaceLedgerFixture),
        };
      },
    });

    expect(firstStore).toBe(retriedStore);
    expect(attemptCount).toBe(2);
    expect(retriedStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_recovered_after_parse',
        displayName: 'Recovered after parse retry',
      }),
    ]);
    expect(retriedStore.getState().ledger).toEqual(workspaceLedgerFixture);
  });

  it('hydrates persisted workspaces through reopen validation instead of installing raw invalid route state', async () => {
    const workspaceId = 'workspace_demo_reopen_validated';
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T16:00:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId,
          graphDefinitions: [
            {
              ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]),
              graphId: 'graph_broken_reference',
              title: 'Broken Reference Graph',
              datasetId: 'dataset_missing_after_reload',
              status: 'reference',
              issueIds: [],
              evidenceIds: [],
            },
            {
              ...structuredClone(workspaceSnapshotFixture.graphDefinitions[0]),
              graphId: 'graph_recovery_candidate',
              title: 'Recovery Candidate',
              datasetId: workspaceSnapshotFixture.datasets[0]!.datasetId,
              status: 'candidate',
              issueIds: [],
              evidenceIds: [],
            },
          ],
          activeGraphId: 'graph_broken_reference',
          referenceGraphId: 'graph_broken_reference',
        },
        ledger: structuredClone(workspaceLedgerFixture),
      }),
    });

    expect(store.getState().snapshot.activeGraphId).toBe('graph_recovery_candidate');
    expect(store.getState().snapshot.referenceGraphId).toBe('graph_recovery_candidate');
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.graph.missing-dataset',
        }),
      ]),
    );
  });

  it('evicts least-recently-used workspace kernel stores after the cache limit is exceeded', async () => {
    let now = 0;
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      now += 1;
      return now;
    });
    const cachedStores = new Map<string, Awaited<ReturnType<typeof resolveWorkspaceKernelStore>>>();

    for (let index = 0; index <= MAX_CACHED_WORKSPACE_KERNEL_STORES; index += 1) {
      const workspaceId = `workspace_cache_${index}`;
      const store = await resolveWorkspaceKernelStore(workspaceId, {
        loadWorkspaceRecord: async () => null,
      });
      cachedStores.set(workspaceId, store);
    }

    const evictedWorkspaceId = 'workspace_cache_0';
    const recreatedStore = await resolveWorkspaceKernelStore(evictedWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });

    expect(recreatedStore).not.toBe(cachedStores.get(evictedWorkspaceId));
    dateNowSpy.mockRestore();
  });

  it('does not evict dirty workspace kernel stores when the cache limit is exceeded', async () => {
    let now = 0;
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      now += 1;
      return now;
    });
    const dirtyWorkspaceId = 'workspace_cache_dirty';
    const dirtyStore = await resolveWorkspaceKernelStore(dirtyWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });
    const cleanWorkspaceId = 'workspace_cache_clean_0';
    const cleanStore = await resolveWorkspaceKernelStore(cleanWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });

    dirtyStore.getState().commands.replaceIssues([], {
      actorId: 'test',
      correlationId: 'issues_updated_dirty_cache',
      occurredAt: '2026-04-23T12:00:00.000Z',
    });

    for (let index = 1; index <= MAX_CACHED_WORKSPACE_KERNEL_STORES; index += 1) {
      const workspaceId = `workspace_cache_clean_${index}`;
      await resolveWorkspaceKernelStore(workspaceId, {
        loadWorkspaceRecord: async () => null,
      });
    }

    const resolvedDirtyStore = await resolveWorkspaceKernelStore(dirtyWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });
    const recreatedCleanStore = await resolveWorkspaceKernelStore('workspace_cache_clean_0', {
      loadWorkspaceRecord: async () => null,
    });

    expect(resolvedDirtyStore).toBe(dirtyStore);
    expect(recreatedCleanStore).not.toBe(cleanStore);
    dateNowSpy.mockRestore();
  });

  it('returns successfully persisted workspace kernel stores to the LRU eviction pool', async () => {
    let now = 0;
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      now += 1;
      return now;
    });
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());
    const persistedWorkspaceId = 'workspace_cache_persisted_after_save';
    const persistedStore = await resolveWorkspaceKernelStore(persistedWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });

    persistedStore.getState().commands.replaceIssues([], {
      actorId: 'test',
      correlationId: 'issues_updated_before_save',
      occurredAt: '2026-04-23T12:10:00.000Z',
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore: persistedStore,
      savedAt: '2026-04-23T12:10:05.000Z',
    });

    for (let index = 0; index <= MAX_CACHED_WORKSPACE_KERNEL_STORES; index += 1) {
      await resolveWorkspaceKernelStore(`workspace_cache_saved_${index}`, {
        loadWorkspaceRecord: async () => null,
      });
    }

    const recreatedStore = await resolveWorkspaceKernelStore(persistedWorkspaceId, {
      loadWorkspaceRecord: async () => null,
    });

    expect(recreatedStore).not.toBe(persistedStore);
    dateNowSpy.mockRestore();
  });
});
