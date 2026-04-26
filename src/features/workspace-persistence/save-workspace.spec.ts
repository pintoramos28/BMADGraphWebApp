import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createWorkspaceRepository,
  InMemoryWorkspaceStorage,
  type WorkspacePersistenceStorage,
} from '../../services/persistence';
import type { WorkspaceFileHandle } from '../../services/persistence/fs-access/portable-workspace-files';
import { createImportWorkspaceSnapshot, createWorkspaceKernelStore } from '../../stores/workspace-kernel';
import { preparePersistedDatasetFileHandlesForSave } from './persisted-dataset-file-handles';
import { saveWorkspaceKernel } from './save-workspace';
import { getPersistedWorkspaceKernelVersion, markWorkspaceKernelStorePersisted } from './workspace-kernel-persistence-state';

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

describe('saveWorkspaceKernel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops before repository persistence when the kernel changes during source-handle preparation', async () => {
    const workspaceId = 'workspace_save_concurrent_prepare_mutation';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const sourceFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const graphId = kernelStore.getState().snapshot.referenceGraphId;
    const saveCanonicalWorkspace = vi.fn();
    const fileSha256 = await sha256Hex(sourceFile);
    const sourceFileArrayBuffer = vi.spyOn(sourceFile, 'arrayBuffer');

    await expect(saveWorkspaceKernel({
      repository: {
        saveCanonicalWorkspace,
        async loadWorkspaceRecord() {
          return null;
        },
        async listWorkspaces() {
          return [];
        },
      },
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256,
        handle: {
          name: 'live.csv',
          async getFile() {
            kernelStore.getState().commands.promoteReferenceGraph({
              graphId,
              actorId: 'test-worker',
              actorKind: 'test',
              correlationId: 'concurrent-prepare-mutation',
              occurredAt: '2026-04-26T00:00:00.000Z',
              reason: 'Concurrent mutation during save preparation.',
            });

            return sourceFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      }],
    })).rejects.toThrow('Workspace changed while save was in progress');

    expect(saveCanonicalWorkspace).not.toHaveBeenCalled();
    expect(sourceFileArrayBuffer).not.toHaveBeenCalled();
  });

  it('keeps committed saves successful without marking newer kernel mutations persisted', async () => {
    const workspaceId = 'workspace_save_concurrent_repository_mutation';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const initialWorkspaceVersion = kernelStore.getState().workspaceVersion;
    const graphId = kernelStore.getState().snapshot.referenceGraphId;

    markWorkspaceKernelStorePersisted(kernelStore, initialWorkspaceVersion);

    await expect(saveWorkspaceKernel({
      repository: {
        async saveCanonicalWorkspace(input) {
          kernelStore.getState().commands.promoteReferenceGraph({
            graphId,
            actorId: 'test-worker',
            actorKind: 'test',
            correlationId: 'concurrent-repository-mutation',
            occurredAt: '2026-04-26T00:00:00.000Z',
            reason: 'Concurrent mutation during repository save.',
          });

          return {
            workspaceId: input.snapshot.workspaceId,
            savedAt: input.savedAt,
            datasetCount: input.snapshot.datasets.length,
            graphCount: input.snapshot.graphDefinitions.length,
            snapshot: input.snapshot,
            ...(input.datasetFileHandles ? { datasetFileHandles: input.datasetFileHandles } : {}),
          };
        },
        async loadWorkspaceRecord() {
          return null;
        },
        async listWorkspaces() {
          return [];
        },
      },
      kernelStore,
    })).resolves.toMatchObject({
      workspaceId,
    });

    expect(kernelStore.getState().workspaceVersion).toBeGreaterThan(initialWorkspaceVersion);
    expect(getPersistedWorkspaceKernelVersion(kernelStore)).toBe(initialWorkspaceVersion);
  });

  it('aborts storage persistence when the kernel changes while the repository write is in flight', async () => {
    const workspaceId = 'workspace_save_aborts_inflight_stale_write';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const graphId = kernelStore.getState().snapshot.referenceGraphId;
    let persisted = false;
    const storage: WorkspacePersistenceStorage = {
      async putRecord(_record, options) {
        kernelStore.getState().commands.promoteReferenceGraph({
          graphId,
          actorId: 'test-worker',
          actorKind: 'test',
          correlationId: 'concurrent-storage-mutation',
          occurredAt: '2026-04-26T00:00:00.000Z',
          reason: 'Concurrent mutation while storage persistence is in flight.',
        });

        if (options?.abortSignal?.aborted) {
          throw options.abortSignal.reason instanceof Error
            ? options.abortSignal.reason
            : new Error('Workspace persistence was aborted.');
        }

        persisted = true;
      },
      async getRecord() {
        return null;
      },
      async listRecords() {
        return [];
      },
    };

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(storage),
      kernelStore,
    })).rejects.toThrow('Workspace changed while save was in progress');

    expect(persisted).toBe(false);
  });

  it('aborts hung persistence after the save timeout even without a concurrent mutation', async () => {
    vi.useFakeTimers();

    const workspaceId = 'workspace_save_hung_persistence_timeout';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const storage: WorkspacePersistenceStorage = {
      async putRecord(_record, options) {
        return new Promise<void>((_resolve, reject) => {
          options?.abortSignal?.addEventListener('abort', () => {
            reject(options.abortSignal?.reason ?? new Error('Workspace persistence was aborted.'));
          }, { once: true });
        });
      },
      async getRecord() {
        return null;
      },
      async listRecords() {
        return [];
      },
    };
    const save = saveWorkspaceKernel({
      repository: createWorkspaceRepository(storage),
      kernelStore,
      persistenceTimeoutMs: 50,
    });
    const expectation = expect(save).rejects.toThrow('Workspace persistence did not respond before the safety timeout');

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it('rejects on save timeout even when the repository ignores abort and never settles', async () => {
    vi.useFakeTimers();

    const workspaceId = 'workspace_save_noncooperative_repository_timeout';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const save = saveWorkspaceKernel({
      repository: {
        async saveCanonicalWorkspace() {
          return new Promise<never>(() => {});
        },
        async loadWorkspaceRecord() {
          return null;
        },
        async listWorkspaces() {
          return [];
        },
      },
      kernelStore,
      persistenceTimeoutMs: 50,
    });
    const expectation = expect(save).rejects.toThrow('Workspace persistence did not respond before the safety timeout');

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it('rejects stale non-cooperative repository saves as soon as the kernel changes', async () => {
    const workspaceId = 'workspace_save_noncooperative_stale_abort';
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    const graphId = kernelStore.getState().snapshot.referenceGraphId;
    const save = saveWorkspaceKernel({
      repository: {
        async saveCanonicalWorkspace(input) {
          return new Promise((resolve) => {
            void input;
            void resolve;
            // Intentionally never settle: this repository ignores abort and stale
            // callbacks, so saveWorkspaceKernel must race its own stale signal.
          });
        },
        async loadWorkspaceRecord() {
          return null;
        },
        async listWorkspaces() {
          return [];
        },
      },
      kernelStore,
      persistenceTimeoutMs: 10_000,
    });

    await Promise.resolve();
    kernelStore.getState().commands.promoteReferenceGraph({
      graphId,
      actorId: 'test-worker',
      actorKind: 'test',
      correlationId: 'noncooperative-stale-save',
      occurredAt: '2026-04-26T00:00:00.000Z',
      reason: 'Concurrent mutation while repository ignores abort.',
    });

    await expect(save).rejects.toThrow('Workspace changed while save was in progress');
  });

  it('aborts stale saves when live dataset file-handle provenance changes without a workspace-version change', async () => {
    const workspaceId = 'workspace_save_aborts_inflight_handle_replacement';
    const sourceFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: sourceFile.size,
        fileLastModified: sourceFile.lastModified,
        fileSha256: await sha256Hex(sourceFile),
        handle: {
          name: 'live.csv',
          async getFile() {
            return sourceFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      }],
    });
    const initialWorkspaceVersion = kernelStore.getState().workspaceVersion;
    let persisted = false;
    const storage: WorkspacePersistenceStorage = {
      async putRecord(_record, options) {
        kernelStore.getState().commands.replaceDatasetFileHandles([]);

        if (options?.abortSignal?.aborted) {
          throw options.abortSignal.reason instanceof Error
            ? options.abortSignal.reason
            : new Error('Workspace persistence was aborted.');
        }

        persisted = true;
      },
      async getRecord() {
        return null;
      },
      async listRecords() {
        return [];
      },
    };

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(storage),
      kernelStore,
    })).rejects.toThrow('Workspace changed while save was in progress');

    expect(kernelStore.getState().workspaceVersion).toBe(initialWorkspaceVersion);
    expect(persisted).toBe(false);
  });

  it('aborts stale saves when a same-metadata dataset handle is swapped without a workspace-version change', async () => {
    const workspaceId = 'workspace_save_aborts_same_metadata_handle_swap';
    const sourceFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const createHandle = (): WorkspaceFileHandle => ({
      name: 'live.csv',
      async getFile() {
        return sourceFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    });
    const fileSha256 = await sha256Hex(sourceFile);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: sourceFile.size,
        fileLastModified: sourceFile.lastModified,
        fileSha256,
        handle: createHandle(),
      }],
    });
    let persisted = false;
    const storage: WorkspacePersistenceStorage = {
      async putRecord(_record, options) {
        kernelStore.getState().commands.replaceDatasetFileHandles([{
          datasetId: 'dataset_live',
          fileName: 'live.csv',
          fileHandleToken: 'live_token',
          fileSize: sourceFile.size,
          fileLastModified: sourceFile.lastModified,
          fileSha256,
          handle: createHandle(),
        }]);

        if (options?.abortSignal?.aborted) {
          throw options.abortSignal.reason instanceof Error
            ? options.abortSignal.reason
            : new Error('Workspace persistence was aborted.');
        }

        persisted = true;
      },
      async getRecord() {
        return null;
      },
      async listRecords() {
        return [];
      },
    };

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(storage),
      kernelStore,
    })).rejects.toThrow('Workspace changed while save was in progress');

    expect(persisted).toBe(false);
  });

  it('fails closed when source-backed persistence is required but no handles are available', async () => {
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot('workspace_save_required_empty_source_handles'),
      ledger: [],
    });

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(new InMemoryWorkspaceStorage()),
      kernelStore,
      datasetFileHandles: [],
      requireDatasetFileHandles: true,
    })).rejects.toThrow('Source file provenance could not be verified');
  });

  it('fails closed when a required source-backed handle changes after validation but before save', async () => {
    const workspaceId = 'workspace_save_required_source_handle';
    let currentFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const handle: WorkspaceFileHandle = {
      name: 'live.csv',
      async getFile() {
        return currentFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const [validatedHandle] = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256: await sha256Hex(currentFile),
        handle,
      },
    ]);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });
    currentFile = new File(['evil'], 'live.csv', {
      lastModified: 1713830400000,
    });

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(new InMemoryWorkspaceStorage()),
      kernelStore,
      datasetFileHandles: validatedHandle ? [validatedHandle] : [],
      requireDatasetFileHandles: true,
    })).rejects.toThrow('Source file provenance could not be verified');
  });

  it('fails closed when final repository verification drops a required source-backed handle', async () => {
    const workspaceId = 'workspace_save_repository_required_source_handle';
    const storage = new InMemoryWorkspaceStorage();
    const originalFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const changedFile = new File(['evil'], 'live.csv', {
      lastModified: 1713830400000,
    });
    let getFileCount = 0;
    const handle: WorkspaceFileHandle = {
      name: 'live.csv',
      async getFile() {
        getFileCount += 1;

        return getFileCount === 1 ? originalFile : changedFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: createImportWorkspaceSnapshot(workspaceId),
      ledger: [],
    });

    await expect(saveWorkspaceKernel({
      repository: createWorkspaceRepository(storage),
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256: await sha256Hex(originalFile),
        handle,
      }],
      requireDatasetFileHandles: true,
      requiredDatasetFileHandleDatasetIds: ['dataset_live'],
    })).rejects.toThrow('Source file provenance could not be verified');
    await expect(storage.getRecord(workspaceId)).resolves.toBeNull();
  });

  it('drops unrelated stale handles while preserving a newly required source-backed handle', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_save_new_source_with_stale_old_handle';
    const newFile = new File(['new-live'], 'new.csv', {
      lastModified: 1713830400000,
    });
    const staleOriginalFile = new File(['old-live'], 'old.csv', {
      lastModified: 1713830400000,
    });
    const staleChangedFile = new File(['old-changed'], 'old.csv', {
      lastModified: 1713830400000,
    });
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const baseDataset = bootstrapSnapshot.datasets[0];
    const baseGraphDefinition = bootstrapSnapshot.graphDefinitions[0];

    if (!baseDataset || !baseGraphDefinition) {
      throw new Error('Import bootstrap fixture is missing required canonical entities.');
    }

    const oldDataset = {
      ...baseDataset,
      datasetId: 'dataset_old',
      displayName: 'Old source-backed dataset',
      sourceFile: {
        fileName: 'old.csv',
        fileHandleToken: 'old_token',
      },
    };
    const newDataset = {
      ...baseDataset,
      datasetId: 'dataset_new',
      displayName: 'New source-backed dataset',
      sourceFile: {
        fileName: 'new.csv',
        fileHandleToken: 'new_token',
      },
    };
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: [oldDataset, newDataset],
        graphDefinitions: [
          {
            ...baseGraphDefinition,
            datasetId: 'dataset_new',
          },
        ],
      },
      ledger: [],
    });
    const oldHandle = {
      name: 'old.csv',
      async getFile() {
        return staleChangedFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const newHandle = {
      name: 'new.csv',
      async getFile() {
        return newFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };

    await expect(saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [
        {
          datasetId: 'dataset_old',
          fileName: 'old.csv',
          fileHandleToken: 'old_token',
          fileSha256: await sha256Hex(staleOriginalFile),
          handle: oldHandle,
        },
        {
          datasetId: 'dataset_new',
          fileName: 'new.csv',
          fileHandleToken: 'new_token',
          fileSha256: await sha256Hex(newFile),
          handle: newHandle,
        },
      ],
      requireDatasetFileHandles: true,
      requiredDatasetFileHandleDatasetIds: ['dataset_new'],
    })).resolves.toBeDefined();

    const record = await storage.getRecord(workspaceId);

    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_new',
        fileName: 'new.csv',
        fileHandleToken: 'new_token',
      }),
    ]);
    expect((record?.snapshot as { datasets: unknown[] } | undefined)?.datasets).toEqual([
      expect.not.objectContaining({
        sourceFile: expect.anything(),
      }),
      expect.objectContaining({
        datasetId: 'dataset_new',
        sourceFile: {
          fileName: 'new.csv',
          fileHandleToken: 'new_token',
        },
      }),
    ]);
  });

  it('rejects required source-backed saves when a same-dataset handle does not match the current source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_save_rejects_foreign_same_dataset_handle';
    const sourceFile = new File(['foreign-live'], 'foreign.csv', {
      lastModified: 1713830400000,
    });
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => ({
          ...dataset,
          datasetId: 'dataset_live',
          sourceFile: {
            fileName: 'expected.csv',
            fileHandleToken: 'expected_token',
          },
        })),
        graphDefinitions: bootstrapSnapshot.graphDefinitions.map((graph) => ({
          ...graph,
          datasetId: 'dataset_live',
        })),
      },
      ledger: [],
    });
    const foreignHandle: WorkspaceFileHandle = {
      name: 'foreign.csv',
      async getFile() {
        return sourceFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };

    await expect(saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'foreign.csv',
        fileHandleToken: 'foreign_token',
        fileSha256: await sha256Hex(sourceFile),
        handle: foreignHandle,
      }],
      requireDatasetFileHandles: true,
      requiredDatasetFileHandleDatasetIds: ['dataset_live'],
    })).rejects.toThrow('Source file provenance could not be verified');

    await expect(storage.getRecord(workspaceId)).resolves.toBeNull();
    expect(kernelStore.getState().selectors.persistedWorkspace().datasets[0]).toMatchObject({
      sourceFile: {
        fileName: 'expected.csv',
        fileHandleToken: 'expected_token',
      },
    });
  });

  it('drops optional same-dataset handles that do not match the current source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_save_drops_optional_foreign_same_dataset_handle';
    const foreignFile = new File(['foreign-live'], 'foreign.csv', {
      lastModified: 1713830400000,
    });
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => ({
          ...dataset,
          datasetId: 'dataset_live',
          sourceFile: {
            fileName: 'expected.csv',
            fileHandleToken: 'expected_token',
          },
        })),
        graphDefinitions: bootstrapSnapshot.graphDefinitions.map((graph) => ({
          ...graph,
          datasetId: 'dataset_live',
        })),
      },
      ledger: [],
    });
    const foreignHandle: WorkspaceFileHandle = {
      name: 'foreign.csv',
      async getFile() {
        return foreignFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'foreign.csv',
        fileHandleToken: 'foreign_token',
        fileSha256: await sha256Hex(foreignFile),
        handle: foreignHandle,
      }],
    });

    const record = await storage.getRecord(workspaceId);

    expect(record?.datasetFileHandles).toEqual([]);
    expect((record?.snapshot as { datasets: Array<{ sourceFile?: unknown }> } | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
    expect(kernelStore.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(kernelStore.getState().selectors.persistedWorkspace().datasets[0]).not.toHaveProperty('sourceFile');
  });

  it('preserves required source provenance when a later same-dataset handle is foreign', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_save_preserves_required_source_with_duplicate_handles';
    const expectedFile = new File(['expected-live'], 'expected.csv', {
      lastModified: 1713830400000,
    });
    const foreignFile = new File(['foreign-live'], 'foreign.csv', {
      lastModified: 1713830400000,
    });
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => ({
          ...dataset,
          datasetId: 'dataset_live',
          sourceFile: {
            fileName: 'expected.csv',
            fileHandleToken: 'expected_token',
          },
        })),
        graphDefinitions: bootstrapSnapshot.graphDefinitions.map((graph) => ({
          ...graph,
          datasetId: 'dataset_live',
        })),
      },
      ledger: [],
    });
    const expectedHandle: WorkspaceFileHandle = {
      name: 'expected.csv',
      async getFile() {
        return expectedFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const foreignHandle: WorkspaceFileHandle = {
      name: 'foreign.csv',
      async getFile() {
        return foreignFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };

    await expect(saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [
        {
          datasetId: 'dataset_live',
          fileName: 'expected.csv',
          fileHandleToken: 'expected_token',
          fileSha256: await sha256Hex(expectedFile),
          handle: expectedHandle,
        },
        {
          datasetId: 'dataset_live',
          fileName: 'foreign.csv',
          fileHandleToken: 'foreign_token',
          fileSha256: await sha256Hex(foreignFile),
          handle: foreignHandle,
        },
      ],
      requireDatasetFileHandles: true,
      requiredDatasetFileHandleDatasetIds: ['dataset_live'],
    })).resolves.toBeDefined();

    const record = await storage.getRecord(workspaceId);

    expect((record?.snapshot as { datasets: Array<{ sourceFile?: unknown }> } | undefined)?.datasets[0]?.sourceFile).toEqual({
      fileName: 'expected.csv',
      fileHandleToken: 'expected_token',
    });
    expect(record?.datasetFileHandles).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        fileName: 'expected.csv',
        fileHandleToken: 'expected_token',
      }),
    ]);
  });

  it('drops stale dataset file handles when the dataset no longer declares source metadata', async () => {
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const workspaceId = 'workspace_save_drops_handleless_dataset_provenance';
    const staleFile = new File(['stale-live'], 'stale.csv', {
      lastModified: 1713830400000,
    });
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => {
          const datasetWithoutSourceFile = {
            ...dataset,
            datasetId: 'dataset_handleless',
          };

          return datasetWithoutSourceFile;
        }),
        graphDefinitions: bootstrapSnapshot.graphDefinitions.map((graph) => ({
          ...graph,
          datasetId: 'dataset_handleless',
        })),
      },
      ledger: [],
    });
    const staleHandle: WorkspaceFileHandle = {
      name: 'stale.csv',
      async getFile() {
        return staleFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_handleless',
        fileName: 'stale.csv',
        fileHandleToken: 'stale_token',
        fileSha256: await sha256Hex(staleFile),
        handle: staleHandle,
      }],
    });

    const record = await storage.getRecord(workspaceId);

    expect(record?.datasetFileHandles).toEqual([]);
    expect((record?.snapshot as { datasets: Array<{ sourceFile?: unknown }> } | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
    expect(kernelStore.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(kernelStore.getState().selectors.persistedWorkspace().datasets[0]).not.toHaveProperty('sourceFile');
  });

  it('strips stale source-file metadata from the live kernel when no handle survives save sanitation', async () => {
    const workspaceId = 'workspace_save_strips_live_stale_source_metadata';
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => ({
          ...dataset,
          sourceFile: {
            fileName: 'missing.csv',
            fileHandleToken: 'missing_token',
          },
        })),
      },
      ledger: [],
    });
    const repository = createWorkspaceRepository(new InMemoryWorkspaceStorage());

    await saveWorkspaceKernel({
      repository,
      kernelStore,
    });

    expect(kernelStore.getState().selectors.persistedWorkspace().datasets[0]).not.toHaveProperty('sourceFile');
  });

  it('strips optional source-file metadata from live and persisted snapshots when final repository verification drops the handle', async () => {
    const workspaceId = 'workspace_save_repository_optional_source_handle';
    const storage = new InMemoryWorkspaceStorage();
    const repository = createWorkspaceRepository(storage);
    const originalFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const changedFile = new File(['evil'], 'live.csv', {
      lastModified: 1713830400000,
    });
    let getFileCount = 0;
    const handle: WorkspaceFileHandle = {
      name: 'live.csv',
      async getFile() {
        getFileCount += 1;

        return getFileCount === 1 ? originalFile : changedFile;
      },
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const bootstrapSnapshot = createImportWorkspaceSnapshot(workspaceId);
    const kernelStore = createWorkspaceKernelStore({
      snapshot: {
        ...bootstrapSnapshot,
        datasets: bootstrapSnapshot.datasets.map((dataset) => ({
          ...dataset,
          datasetId: 'dataset_live',
          sourceFile: {
            fileName: 'live.csv',
            fileHandleToken: 'live_token',
          },
        })),
        graphDefinitions: bootstrapSnapshot.graphDefinitions.map((graph) => ({
          ...graph,
          datasetId: 'dataset_live',
        })),
      },
      ledger: [],
    });

    await saveWorkspaceKernel({
      repository,
      kernelStore,
      datasetFileHandles: [{
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256: await sha256Hex(originalFile),
        handle,
      }],
    });

    const persistedRecord = await storage.getRecord(workspaceId);

    expect(persistedRecord?.datasetFileHandles).toEqual([]);
    expect((persistedRecord?.snapshot as { datasets: unknown[] } | undefined)?.datasets[0]).not.toHaveProperty('sourceFile');
    expect(kernelStore.getState().selectors.datasetFileHandles()).toEqual([]);
    expect(kernelStore.getState().selectors.persistedWorkspace().datasets[0]).not.toHaveProperty('sourceFile');
  });
});
