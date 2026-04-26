import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveWorkspaceKernel } from '../../features/workspace-persistence';
import { createWorkspaceRepository, InMemoryWorkspaceStorage, type PersistedWorkspaceRecord } from '../../services/persistence';
import { workspaceLedgerFixture } from '../../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../../test/fixtures/workspace/workspace-snapshot.fixture';
import {
  MAX_CACHED_WORKSPACE_KERNEL_STORES,
  resetWorkspaceKernelStoresForTest,
  resolveWorkspaceKernelStore,
  WORKSPACE_HYDRATION_RECORD_LOAD_TIMEOUT_MS,
} from './shell-routes';

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

describe('resolveWorkspaceKernelStore hydration', () => {
  beforeEach(() => {
    resetWorkspaceKernelStoresForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('fails closed when persisted records do not belong to the requested workspace id', async () => {
    const workspaceId = 'workspace_demo_requested';
    await expect(resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId: 'workspace_other',
        savedAt: '2026-04-22T15:00:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId: 'workspace_other',
        },
        ledger: structuredClone(workspaceLedgerFixture),
      }),
    })).rejects.toThrow('does not match requested workspace');
  });

  it('validates persisted snapshot identity before touching dataset file handles', async () => {
    const workspaceId = 'workspace_demo_requested_snapshot_first';
    const getFile = vi.fn(async () => new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    }));

    await expect(resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:05:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId: 'workspace_other',
        },
        ledger: structuredClone(workspaceLedgerFixture),
        datasetFileHandles: [
          {
            datasetId: 'dataset_live',
            fileName: 'live.csv',
            fileHandleToken: 'live_token',
            fileSize: 4,
            fileLastModified: 1713830400000,
            fileSha256: await sha256Hex(new File(['live'], 'live.csv', {
              lastModified: 1713830400000,
            })),
            handle: {
              name: 'live.csv',
              getFile,
              createWritable: async () => ({}),
            },
          },
        ],
      }),
    })).rejects.toThrow('does not match requested workspace');
    expect(getFile).not.toHaveBeenCalled();
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
            fileSha256: await sha256Hex(new File(['live'], 'live.csv', {
              lastModified: 1713830400000,
            })),
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
        fileSha256: await sha256Hex(new File(['live'], 'live.csv', {
          lastModified: 1713830400000,
        })),
        handle: expect.objectContaining({
          name: 'live.csv',
        }),
      },
    ]);
  });

  it('filters persisted dataset file handles to the reopened snapshot before reading local handle bytes', async () => {
    const workspaceId = 'workspace_demo_extra_handles';
    const liveFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const extraGetFile = vi.fn(async () => new File(['extra'], 'extra.csv', {
      lastModified: 1713830401000,
    }));
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-25T22:45:00.000Z',
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
            datasetId: 'dataset_extra',
            fileName: 'extra.csv',
            fileHandleToken: 'extra_token',
            fileSize: 5,
            fileLastModified: 1713830401000,
            fileSha256: await sha256Hex(new File(['extra'], 'extra.csv', {
              lastModified: 1713830401000,
            })),
            handle: {
              name: 'extra.csv',
              getFile: extraGetFile,
              createWritable: async () => ({}),
            },
          },
          {
            datasetId: 'dataset_live',
            fileName: 'live.csv',
            fileHandleToken: 'live_token',
            fileSize: liveFile.size,
            fileLastModified: liveFile.lastModified,
            fileSha256: await sha256Hex(liveFile),
            handle: {
              name: 'live.csv',
              getFile: async () => liveFile,
              createWritable: async () => ({}),
            },
          },
        ],
      }),
    });

    expect(extraGetFile).not.toHaveBeenCalled();
    expect(store.getState().selectors.datasetFileHandles()).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
      }),
    ]);
  });

  it('aborts persisted dataset file-handle hydration when the caller cancels workspace hydration', async () => {
    const workspaceId = 'workspace_demo_abort_hydration_handles';
    const liveFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const abortController = new AbortController();
    const pendingGetFile = vi.fn(() => new Promise<File>(() => {}));
    const hydration = resolveWorkspaceKernelStore(workspaceId, {
      signal: abortController.signal,
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-26T06:00:00.000Z',
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
            fileSize: liveFile.size,
            fileLastModified: liveFile.lastModified,
            fileSha256: await sha256Hex(liveFile),
            handle: {
              name: 'live.csv',
              getFile: pendingGetFile,
              createWritable: async () => ({}),
            },
          },
        ],
      }),
    });

    await Promise.resolve();
    abortController.abort(new Error('Workspace route unmounted.'));

    await expect(hydration).rejects.toThrow('Workspace route unmounted.');
    expect(pendingGetFile).not.toHaveBeenCalled();
  });

  it('does not let one route unmount abort the shared hydration promise for an active remount', async () => {
    const workspaceId = 'workspace_demo_shared_abort_hydration';
    const liveFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const firstAbortController = new AbortController();
    const secondAbortController = new AbortController();
    let resolveLoadedRecord!: (record: PersistedWorkspaceRecord) => void;
    const loadedRecord = new Promise<PersistedWorkspaceRecord>((resolve) => {
      resolveLoadedRecord = resolve;
    });
    const loadWorkspaceRecord = vi.fn(async () => loadedRecord);
    const firstHydration = resolveWorkspaceKernelStore(workspaceId, {
      signal: firstAbortController.signal,
      loadWorkspaceRecord,
    });
    void firstHydration.catch(() => {});
    const secondHydration = resolveWorkspaceKernelStore(workspaceId, {
      signal: secondAbortController.signal,
      loadWorkspaceRecord,
    });

    await Promise.resolve();
    firstAbortController.abort(new Error('Workspace route unmounted.'));
    resolveLoadedRecord({
      workspaceId,
      savedAt: '2026-04-26T10:00:00.000Z',
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
          fileSize: liveFile.size,
          fileLastModified: liveFile.lastModified,
          fileSha256: await sha256Hex(liveFile),
          handle: {
            name: 'live.csv',
            getFile: async () => liveFile,
            createWritable: async () => ({}),
          },
        },
      ],
    });

    await expect(firstHydration).rejects.toThrow('Workspace route unmounted.');
    await expect(secondHydration).resolves.toEqual(expect.any(Object));
    expect(loadWorkspaceRecord).toHaveBeenCalledOnce();
  });

  it('starts a fresh hydration attempt when the cached shared signal was already aborted', async () => {
    const workspaceId = 'workspace_demo_aborted_cached_hydration';
    const liveFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const firstAbortController = new AbortController();
    let resolveFirstRecord!: (record: PersistedWorkspaceRecord) => void;
    let resolveSecondRecord!: (record: PersistedWorkspaceRecord) => void;
    const firstLoadedRecord = new Promise<PersistedWorkspaceRecord>((resolve) => {
      resolveFirstRecord = resolve;
    });
    const secondLoadedRecord = new Promise<PersistedWorkspaceRecord>((resolve) => {
      resolveSecondRecord = resolve;
    });
    const loadWorkspaceRecord = vi.fn()
      .mockImplementationOnce(async () => firstLoadedRecord)
      .mockImplementationOnce(async () => secondLoadedRecord);
    const firstHydration = resolveWorkspaceKernelStore(workspaceId, {
      signal: firstAbortController.signal,
      loadWorkspaceRecord,
    });
    void firstHydration.catch(() => {});

    await Promise.resolve();
    firstAbortController.abort(new Error('Workspace route unmounted.'));

    const secondHydration = resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord,
    });
    const persistedRecord: PersistedWorkspaceRecord = {
      workspaceId,
      savedAt: '2026-04-26T10:05:00.000Z',
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
          fileSize: liveFile.size,
          fileLastModified: liveFile.lastModified,
          fileSha256: await sha256Hex(liveFile),
          handle: {
            name: 'live.csv',
            getFile: async () => liveFile,
            createWritable: async () => ({}),
          },
        },
      ],
    };

    resolveFirstRecord(persistedRecord);
    resolveSecondRecord(persistedRecord);

    await expect(firstHydration).rejects.toThrow('Workspace route unmounted.');
    await expect(secondHydration).resolves.toEqual(expect.any(Object));
    expect(loadWorkspaceRecord).toHaveBeenCalledTimes(2);
  });

  it('emits recovery issues and clears source metadata when live handle validation drops a persisted handle', async () => {
    const workspaceId = 'workspace_demo_stale_handle';
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:20:00.000Z',
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
                new File(['changed-content'], 'live.csv', {
                  lastModified: 1713830405000,
                }),
              createWritable: async () => ({}),
            },
          },
        ],
      }),
    });

    expect(store.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(store.getState().snapshot.datasets[0]).not.toHaveProperty('sourceFile');
    expect(store.getState().snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'workspace.reopen.dataset.missing-file-handle',
          source: expect.objectContaining({
            entityId: 'dataset_live',
          }),
        }),
      ]),
    );
  });

  it('fails closed when persisted workspace parsing fails', async () => {
    const workspaceId = 'workspace_demo_corrupt';
    await expect(resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:30:00.000Z',
        snapshot: {
          workspaceId,
          invalid: true,
        },
        ledger: [],
      }),
    })).rejects.toThrow('Invalid input');
  });

  it('validates the persisted workspace contract before reading same-workspace dataset file handles', async () => {
    const workspaceId = 'workspace_demo_corrupt_before_handles';
    const getFile = vi.fn(async () => new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    }));

    await expect(resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => ({
        workspaceId,
        savedAt: '2026-04-22T15:35:00.000Z',
        snapshot: {
          workspaceId,
          invalid: true,
        },
        ledger: [],
        datasetFileHandles: [
          {
            datasetId: 'dataset_live',
            fileName: 'live.csv',
            fileHandleToken: 'live_token',
            fileSize: 4,
            fileLastModified: 1713830400000,
            fileSha256: await sha256Hex(new File(['live'], 'live.csv', {
              lastModified: 1713830400000,
            })),
            handle: {
              name: 'live.csv',
              getFile,
              createWritable: async () => ({}),
            },
          },
        ],
      }),
    })).rejects.toThrow('Invalid input');
    expect(getFile).not.toHaveBeenCalled();
  });

  it('fails closed when loading persisted workspace state rejects', async () => {
    const workspaceId = 'workspace_demo_load_failure';
    await expect(resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => {
        throw new Error('transient IndexedDB read failure');
      },
    })).rejects.toThrow('transient IndexedDB read failure');
  });

  it('fails closed and retries when persisted workspace record loading does not settle', async () => {
    vi.useFakeTimers();

    const workspaceId = 'workspace_demo_hung_load_retry';
    const loadWorkspaceRecord = vi.fn()
      .mockImplementationOnce(async (_workspaceId: string, options?: { signal?: AbortSignal | undefined }) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal);

        return new Promise<PersistedWorkspaceRecord | null>(() => {});
      })
      .mockImplementationOnce(async () => ({
        workspaceId,
        savedAt: '2026-04-26T11:00:00.000Z',
        snapshot: {
          ...structuredClone(workspaceSnapshotFixture),
          workspaceId,
          datasets: [
            {
              ...structuredClone(workspaceSnapshotFixture.datasets[0]),
              datasetId: 'dataset_recovered_after_timeout',
              displayName: 'Recovered after load timeout',
            },
          ],
        },
        ledger: structuredClone(workspaceLedgerFixture),
      }));
    const hydration = resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord,
    });
    const expectation = expect(hydration).rejects.toThrow('Workspace persistence did not respond while loading');

    await vi.advanceTimersByTimeAsync(WORKSPACE_HYDRATION_RECORD_LOAD_TIMEOUT_MS);

    await expectation;
    expect(loadWorkspaceRecord).toHaveBeenCalledTimes(1);

    const retriedStore = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord,
    });

    expect(loadWorkspaceRecord).toHaveBeenCalledTimes(2);
    expect(retriedStore.getState().snapshot.datasets).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_recovered_after_timeout',
      }),
    ]);
  });

  it('retries persisted hydration after a transient read failure instead of latching the bootstrap store forever', async () => {
    const workspaceId = 'workspace_demo_retry_after_failure';
    let attemptCount = 0;
    await expect(resolveWorkspaceKernelStore(workspaceId, {
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
    })).rejects.toThrow('transient IndexedDB read failure');
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
    await expect(resolveWorkspaceKernelStore(workspaceId, {
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
    })).rejects.toThrow('Invalid input');
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

  it('persists an explicit empty dataset file-handle list when save preparation drops all handles', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_cache_dropped_handles';
    const store = await resolveWorkspaceKernelStore(workspaceId, {
      loadWorkspaceRecord: async () => null,
    });

    store.getState().commands.replaceDatasetFileHandles([
      {
        datasetId: 'dataset_import_stale_handle',
        fileName: 'stale.csv',
        fileHandleToken: 'dataset.dataset_import_stale_handle.source-file',
        handle: {
          name: 'stale.csv',
          async getFile() {
            throw new Error('handle no longer available');
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    ]);

    await saveWorkspaceKernel({
      repository,
      kernelStore: store,
      savedAt: '2026-04-25T13:30:00.000Z',
    });

    const record = await storage.getRecord(workspaceId);

    expect(record?.datasetFileHandles).toEqual([]);
    expect(store.getState().selectors.datasetFileHandles()).toEqual([]);
  });
});
