import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceFileHandle } from '../../services/persistence/fs-access/portable-workspace-files';
import {
  HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
  MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES,
  parsePersistedDatasetFileHandles,
  preparePersistedDatasetFileHandlesForSave,
  sanitizePersistedDatasetFileHandlesForHydration,
} from './persisted-dataset-file-handles';

function createFileHandle(file: File): WorkspaceFileHandle {
  return {
    name: file.name,
    async getFile() {
      return file;
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

describe('persisted dataset file handle helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('caps persisted handle parsing before hydration sanitation is reached', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const trustedHandle = createFileHandle(file);
    const malformedEntries = Array.from(
      { length: MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES + 1 },
      (_, index) => ({ datasetId: `malformed_${index}` }),
    );

    expect(parsePersistedDatasetFileHandles([
      ...malformedEntries,
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: file.size,
        fileLastModified: file.lastModified,
        fileSha256: await sha256Hex(file),
        handle: trustedHandle,
      },
    ])).toEqual([]);
  });

  it('preserves verified file metadata before persisting dataset file handles', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(file);
    const prepared = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256,
        handle: createFileHandle(file),
      },
    ]);

    expect(prepared).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: 4,
        fileLastModified: 1713830400000,
        fileSha256,
      }),
    ]);
  });

  it('rejects digest-less handles during save preparation instead of rebaselining live bytes', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });

    await expect(preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        handle: createFileHandle(file),
      },
    ])).resolves.toEqual([]);
  });

  it('rejects a same-metadata source handle when the live bytes no longer match the validated digest', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const sameMetadataForeignFile = new File(['evil'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const prepared = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256: await sha256Hex(trustedFile),
        handle: createFileHandle(trustedFile),
      },
    ]);
    const trustedEntry = prepared[0];

    if (!trustedEntry) {
      throw new Error('Expected trusted entry to be prepared.');
    }

    await expect(preparePersistedDatasetFileHandlesForSave([
      {
        ...trustedEntry,
        handle: createFileHandle(sameMetadataForeignFile),
      },
    ])).resolves.toEqual([]);
  });

  it('rejects promptly when save preparation is aborted during a pending file byte read', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(file);
    const pendingByteRead = new Promise<ArrayBuffer>(() => {});
    const hangingFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    vi.spyOn(hangingFile, 'arrayBuffer').mockReturnValue(pendingByteRead);
    const abortController = new AbortController();
    const preparation = preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: hangingFile.size,
        fileLastModified: hangingFile.lastModified,
        fileSha256,
        handle: createFileHandle(hangingFile),
      },
    ], {
      signal: abortController.signal,
    });

    await Promise.resolve();
    abortController.abort(new Error('Workspace save became stale.'));

    await expect(preparation).rejects.toThrow('Workspace save became stale.');
  });

  it('rejects same-name foreign handles during hydration when the live file metadata does not match the persisted metadata', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const foreignFile = new File(['changed-content'], 'live.csv', {
      lastModified: 1713830405000,
    });
    const trustedHandle = createFileHandle(trustedFile);
    const foreignHandle = createFileHandle(foreignFile);
    const prepared = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSha256: await sha256Hex(trustedFile),
        handle: trustedHandle,
      },
    ]);
    const trustedEntry = prepared[0];

    if (!trustedEntry) {
      throw new Error('Expected trusted entry to be prepared.');
    }

    const sanitized = await sanitizePersistedDatasetFileHandlesForHydration([
      {
        ...trustedEntry,
        handle: foreignHandle,
      },
    ]);

    expect(sanitized).toEqual([]);
  });

  it('rejects digest-less persisted handles during hydration even when name, size, and mtime match', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });

    await expect(sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: file.size,
        fileLastModified: file.lastModified,
        handle: createFileHandle(file),
      },
    ])).resolves.toEqual([]);
  });

  it('drops handles that time out during hydration sanitation instead of hanging workspace load', async () => {
    vi.useFakeTimers();

    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: file.size,
        fileLastModified: file.lastModified,
        fileSha256: await sha256Hex(file),
        handle: {
          name: 'live.csv',
          getFile: vi.fn(() => new Promise<File>(() => {})),
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    ], {
      timeoutMs: HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
    });

    await vi.advanceTimersByTimeAsync(HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS);

    await expect(hydration).resolves.toEqual([]);
  });

  it('does not spend one hydration timeout per duplicate invalid persisted handle entry', async () => {
    vi.useFakeTimers();

    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const hangingHandle = {
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>(() => {})),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const duplicateEntry = {
      datasetId: 'dataset_live',
      fileName: 'live.csv',
      fileHandleToken: 'live_token',
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileSha256: await sha256Hex(file),
      handle: hangingHandle,
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration(
      Array.from({ length: 5 }, () => ({ ...duplicateEntry })),
      {
        timeoutMs: HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
      },
    );

    await vi.advanceTimersByTimeAsync(HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS);

    await expect(hydration).resolves.toEqual([]);
    expect(hangingHandle.getFile).toHaveBeenCalledTimes(1);
  });

  it('uses one aggregate hydration timeout across many unique timeout-prone handles', async () => {
    vi.useFakeTimers();

    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const entries = await Promise.all(Array.from({ length: 5 }, async (_, index) => ({
      datasetId: `dataset_${index}`,
      fileName: `live-${index}.csv`,
      fileHandleToken: `live_token_${index}`,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileSha256: await sha256Hex(file),
      handle: {
        name: `live-${index}.csv`,
        getFile: vi.fn(() => new Promise<File>(() => {})),
        async createWritable() {
          return {
            async write() {},
            async close() {},
          };
        },
      },
    })));
    const hydration = sanitizePersistedDatasetFileHandlesForHydration(entries, {
      timeoutMs: HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
    });

    await vi.advanceTimersByTimeAsync(HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS);

    await expect(hydration).resolves.toEqual([]);
    expect(entries.reduce((count, entry) => count + entry.handle.getFile.mock.calls.length, 0)).toBe(entries.length);
  });

  it('continues to later valid handles after a slow invalid handle consumes only its bounded share', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const trustedHandle = createFileHandle(trustedFile);
    const slowInvalidHandle = {
      name: 'slow.csv',
      getFile: vi.fn(() => new Promise<File>(() => {})),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_slow',
        fileName: 'slow.csv',
        fileHandleToken: 'slow_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: slowInvalidHandle,
      },
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: trustedHandle,
      },
    ], {
      timeoutMs: HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
    });

    await vi.advanceTimersByTimeAsync(Math.ceil(HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS / 2));

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        handle: trustedHandle,
      }),
    ]);
    expect(slowInvalidHandle.getFile).toHaveBeenCalledOnce();
  });

  it('does not shrink a valid hydration attempt timeout because earlier raw entries are malformed', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const trustedHandle = {
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>((resolve) => {
        globalThis.setTimeout(() => resolve(trustedFile), 100);
      })),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const malformedEntries = Array.from({ length: 200 }, (_, index) => ({
      datasetId: `malformed_${index}`,
    }));
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      ...malformedEntries,
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: trustedHandle,
      },
    ], {
      timeoutMs: HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        handle: trustedHandle,
      }),
    ]);
    expect(trustedHandle.getFile).toHaveBeenCalledOnce();
  });

  it('budgets duplicate stale hydration entries fairly so a later usable handle can be attempted', async () => {
    const staleFile = new File(['stale'], 'stale.csv', {
      lastModified: 1713830400000,
    });
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const staleEntry = {
      datasetId: 'dataset_stale',
      fileName: 'stale.csv',
      fileHandleToken: 'stale_token',
      fileSize: staleFile.size,
      fileLastModified: staleFile.lastModified,
      fileSha256: await sha256Hex(staleFile),
    };
    const staleDuplicates = Array.from({ length: 20 }, () => ({
      ...staleEntry,
      handle: {
        name: 'stale.csv',
        getFile: vi.fn(() => new Promise<File>(() => {})),
        async createWritable() {
          return {
            async write() {},
            async close() {},
          };
        },
      },
    }));
    const trustedHandle = {
      name: 'live.csv',
      getFile: vi.fn(async () => trustedFile),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      ...staleDuplicates,
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256: await sha256Hex(trustedFile),
        handle: trustedHandle,
      },
    ], {
      timeoutMs: 100,
    });

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        handle: trustedHandle,
      }),
    ]);
    expect(trustedHandle.getFile).toHaveBeenCalledOnce();
  });

  it('budgets same-source duplicate hydration candidates so a stale handle cannot consume the source deadline', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const staleHandles = Array.from({ length: 5 }, () => ({
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>(() => {})),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    }));
    const trustedHandle = {
      name: 'live.csv',
      getFile: vi.fn(async () => trustedFile),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const sharedEntry = {
      datasetId: 'dataset_live',
      fileName: 'live.csv',
      fileHandleToken: 'live_token',
      fileSize: trustedFile.size,
      fileLastModified: trustedFile.lastModified,
      fileSha256,
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      ...staleHandles.map((handle) => ({
        ...sharedEntry,
        handle,
      })),
      {
        ...sharedEntry,
        handle: trustedHandle,
      },
    ], {
      timeoutMs: 100,
    });

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        handle: trustedHandle,
      }),
    ]);
    expect(trustedHandle.getFile).toHaveBeenCalledOnce();
  });

  it('does not cache a timed-out shared hydration handle as invalid for later compatible entries', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'shared.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const sharedHandle = {
      name: 'shared.csv',
      getFile: vi.fn()
        .mockImplementationOnce(() => new Promise<File>(() => {}))
        .mockImplementationOnce(async () => trustedFile),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_first',
        fileName: 'shared.csv',
        fileHandleToken: 'first_source_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
      {
        datasetId: 'dataset_second',
        fileName: 'shared.csv',
        fileHandleToken: 'second_source_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
    ], {
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_first',
        fileName: 'shared.csv',
        fileHandleToken: 'first_source_token',
        handle: sharedHandle,
      }),
      expect.objectContaining({
        datasetId: 'dataset_second',
        fileName: 'shared.csv',
        fileHandleToken: 'second_source_token',
        handle: sharedHandle,
      }),
    ]);
    expect(sharedHandle.getFile).toHaveBeenCalledTimes(2);
  });

  it('backfills earlier compatible shared-handle hydration entries after a later validation succeeds', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'shared.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const sharedHandle = {
      name: 'shared.csv',
      getFile: vi.fn()
        .mockImplementationOnce(() => new Promise<File>(() => {}))
        .mockImplementationOnce(async () => trustedFile),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_first',
        fileName: 'shared.csv',
        fileHandleToken: 'first_source_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
      {
        datasetId: 'dataset_second',
        fileName: 'shared.csv',
        fileHandleToken: 'second_source_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
    ], {
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_first',
        fileHandleToken: 'first_source_token',
        handle: sharedHandle,
      }),
      expect.objectContaining({
        datasetId: 'dataset_second',
        fileHandleToken: 'second_source_token',
        handle: sharedHandle,
      }),
    ]);
    expect(sharedHandle.getFile).toHaveBeenCalledTimes(2);
  });

  it('does not shrink later usable duplicate hydration candidate timeouts because of repeated stale candidates', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const staleHandle = {
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>(() => {})),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const trustedHandle = {
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>((resolve) => {
        globalThis.setTimeout(() => resolve(trustedFile), 20);
      })),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const sharedEntry = {
      datasetId: 'dataset_live',
      fileName: 'live.csv',
      fileHandleToken: 'live_token',
      fileSize: trustedFile.size,
      fileLastModified: trustedFile.lastModified,
      fileSha256,
    };
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      ...Array.from({ length: 20 }, () => ({
        ...sharedEntry,
        handle: staleHandle,
      })),
      {
        ...sharedEntry,
        handle: trustedHandle,
      },
    ], {
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(70);

    await expect(hydration).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        handle: trustedHandle,
      }),
    ]);
    expect(staleHandle.getFile).toHaveBeenCalledOnce();
    expect(trustedHandle.getFile).toHaveBeenCalledOnce();
  });

  it('uses one validation timeout across handle getFile, arrayBuffer, and digest phases', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const delayedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const delayedHandle = {
      name: 'live.csv',
      getFile: vi.fn(() => new Promise<File>((resolve) => {
        globalThis.setTimeout(() => resolve(delayedFile), 40);
      })),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    vi.spyOn(delayedFile, 'arrayBuffer').mockImplementation(() => new Promise<ArrayBuffer>((resolve) => {
      globalThis.setTimeout(() => {
        trustedFile.arrayBuffer().then(resolve);
      }, 40);
    }));
    const hydration = sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: delayedHandle,
      },
    ], {
      timeoutMs: 50,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(hydration).resolves.toEqual([]);
  });

  it('does not shrink one shared-handle validation slice by every compatible entry it can backfill', async () => {
    vi.useFakeTimers();

    const trustedFile = new File(['live'], 'shared.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const sharedHandle = {
      name: 'shared.csv',
      getFile: vi.fn(() => new Promise<File>((resolve) => {
        globalThis.setTimeout(() => resolve(trustedFile), 200);
      })),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const entries = Array.from({ length: 25 }, (_, index) => ({
      datasetId: `dataset_shared_${index}`,
      fileName: 'shared.csv',
      fileHandleToken: `shared_token_${index}`,
      fileSize: trustedFile.size,
      fileLastModified: trustedFile.lastModified,
      fileSha256,
      handle: sharedHandle,
    }));
    const hydration = sanitizePersistedDatasetFileHandlesForHydration(entries, {
      timeoutMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(200);

    await expect(hydration).resolves.toHaveLength(entries.length);
    expect(sharedHandle.getFile).toHaveBeenCalledOnce();
  });

  it('bounds raw malformed persisted handle grouping before validating later entries', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const trustedHandle = {
      name: 'live.csv',
      getFile: vi.fn(async () => trustedFile),
      async createWritable() {
        return {
          async write() {},
          async close() {},
        };
      },
    };
    const malformedEntries = Array.from(
      { length: MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES + 1 },
      (_, index) => ({ datasetId: `malformed_${index}` }),
    );

    await expect(sanitizePersistedDatasetFileHandlesForHydration([
      ...malformedEntries,
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256: await sha256Hex(trustedFile),
        handle: trustedHandle,
      },
    ])).resolves.toEqual([]);
    expect(trustedHandle.getFile).not.toHaveBeenCalled();
  });

  it('accepts a later valid duplicate persisted handle after an earlier duplicate fails validation', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const sameMetadataForeignFile = new File(['evil'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(trustedFile);
    const foreignHandle = createFileHandle(sameMetadataForeignFile);
    const trustedHandle = createFileHandle(trustedFile);

    await expect(sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: foreignHandle,
      },
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: trustedFile.size,
        fileLastModified: trustedFile.lastModified,
        fileSha256,
        handle: trustedHandle,
      },
    ])).resolves.toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        handle: trustedHandle,
      }),
    ]);
  });

  it('preserves shared source handles for multiple compatible datasets during hydration', async () => {
    const file = new File(['live'], 'shared.csv', {
      lastModified: 1713830400000,
    });
    const fileSha256 = await sha256Hex(file);
    const sharedHandle = createFileHandle(file);

    await expect(sanitizePersistedDatasetFileHandlesForHydration([
      {
        datasetId: 'dataset_one',
        fileName: 'shared.csv',
        fileHandleToken: 'dataset.dataset_one.source-file',
        fileSize: file.size,
        fileLastModified: file.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
      {
        datasetId: 'dataset_two',
        fileName: 'shared.csv',
        fileHandleToken: 'dataset.dataset_two.source-file',
        fileSize: file.size,
        fileLastModified: file.lastModified,
        fileSha256,
        handle: sharedHandle,
      },
    ])).resolves.toEqual([
      expect.objectContaining({ datasetId: 'dataset_one' }),
      expect.objectContaining({ datasetId: 'dataset_two' }),
    ]);
  });
});
