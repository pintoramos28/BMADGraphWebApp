import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PersistedWorkspaceRecord } from '../repositories/workspace-repository';
import { IndexedDbWorkspaceStorage } from './workspace-storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

function createPersistedRecord(): PersistedWorkspaceRecord {
  return {
    workspaceId: 'workspace_abort',
    savedAt: '2026-04-26T00:00:00.000Z',
    snapshot: {},
    ledger: [],
  };
}

describe('IndexedDbWorkspaceStorage', () => {
  it('rejects a save promptly when aborting while IndexedDB open is still pending', async () => {
    const openRequest = {} as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const save = storage.putRecord(createPersistedRecord(), {
      abortSignal: abortController.signal,
    });

    expect(indexedDbHost.open).toHaveBeenCalledTimes(1);

    abortController.abort(new Error('Workspace save became stale.'));

    await expect(save).rejects.toThrow('Workspace save became stale.');
  });

  it('does not reuse a cached pending database open after an aborted save', async () => {
    const indexedDbHost = {
      open: vi.fn(() => ({} as IDBOpenDBRequest)),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const firstAbortController = new AbortController();
    const firstSave = storage.putRecord(createPersistedRecord(), {
      abortSignal: firstAbortController.signal,
    });

    firstAbortController.abort(new Error('First save was aborted.'));

    await expect(firstSave).rejects.toThrow('First save was aborted.');
    expect(indexedDbHost.open).toHaveBeenCalledTimes(1);

    const secondAbortController = new AbortController();
    const secondSave = storage.putRecord(createPersistedRecord(), {
      abortSignal: secondAbortController.signal,
    });

    expect(indexedDbHost.open).toHaveBeenCalledTimes(2);

    secondAbortController.abort(new Error('Second save was aborted.'));

    await expect(secondSave).rejects.toThrow('Second save was aborted.');
  });

  it('closes a stale database connection if an aborted open succeeds later', async () => {
    const database = {
      close: vi.fn(),
      transaction: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };
    const openRequest = {
      result: database,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    } as unknown as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const save = storage.putRecord(createPersistedRecord(), {
      abortSignal: abortController.signal,
    });

    abortController.abort(new Error('Open was aborted.'));

    await expect(save).rejects.toThrow('Open was aborted.');

    (openRequest.onsuccess as (() => void) | null)?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(database.close).toHaveBeenCalledOnce();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('does not close a shared pending open when another caller continues using it', async () => {
    let getRequest: IDBRequest<PersistedWorkspaceRecord | undefined> | undefined;
    const transaction = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      abort: vi.fn(),
      objectStore: vi.fn(() => ({
        get: vi.fn(() => {
          getRequest = {
            result: undefined,
            onsuccess: null,
            onerror: null,
          } as unknown as IDBRequest<PersistedWorkspaceRecord | undefined>;

          return getRequest;
        }),
      })),
    };
    const database = {
      close: vi.fn(),
      transaction: vi.fn(() => transaction),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };
    const openRequest = {
      result: database,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    } as unknown as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const abortedLoad = storage.getRecord('workspace_abort', {
      abortSignal: abortController.signal,
    });
    const activeLoad = storage.getRecord('workspace_abort');

    expect(indexedDbHost.open).toHaveBeenCalledTimes(1);

    abortController.abort(new Error('First shared load was aborted.'));

    await expect(abortedLoad).rejects.toThrow('First shared load was aborted.');

    (openRequest.onsuccess as (() => void) | null)?.();

    for (let index = 0; index < 10 && !getRequest; index += 1) {
      await Promise.resolve();
    }

    expect(database.close).not.toHaveBeenCalled();
    expect(database.transaction).toHaveBeenCalledTimes(1);

    (getRequest?.onsuccess as (() => void) | undefined)?.();

    for (let index = 0; index < 10 && !transaction.oncomplete; index += 1) {
      await Promise.resolve();
    }

    transaction.oncomplete?.();

    await expect(activeLoad).resolves.toBeNull();
    expect(database.close).not.toHaveBeenCalled();
  });

  it('does not close a shared pending open while listRecords is waiting on it', async () => {
    let getAllRequest: IDBRequest<PersistedWorkspaceRecord[]> | undefined;
    const transaction = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      abort: vi.fn(),
      objectStore: vi.fn(() => ({
        getAll: vi.fn(() => {
          getAllRequest = {
            result: [createPersistedRecord()],
            onsuccess: null,
            onerror: null,
          } as unknown as IDBRequest<PersistedWorkspaceRecord[]>;

          return getAllRequest;
        }),
      })),
    };
    const database = {
      close: vi.fn(),
      transaction: vi.fn(() => transaction),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };
    const openRequest = {
      result: database,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    } as unknown as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const records = storage.listRecords();
    const abortController = new AbortController();
    const abortedLoad = storage.getRecord('workspace_abort', {
      abortSignal: abortController.signal,
    });

    expect(indexedDbHost.open).toHaveBeenCalledTimes(1);

    abortController.abort(new Error('Shared open load was aborted.'));

    await expect(abortedLoad).rejects.toThrow('Shared open load was aborted.');

    (openRequest.onsuccess as (() => void) | null)?.();

    for (let index = 0; index < 10 && !getAllRequest; index += 1) {
      await Promise.resolve();
    }

    expect(database.close).not.toHaveBeenCalled();
    expect(database.transaction).toHaveBeenCalledTimes(1);

    (getAllRequest?.onsuccess as (() => void) | undefined)?.();

    for (let index = 0; index < 10 && !transaction.oncomplete; index += 1) {
      await Promise.resolve();
    }

    transaction.oncomplete?.();

    await expect(records).resolves.toEqual([createPersistedRecord()]);
    expect(database.close).not.toHaveBeenCalled();
  });

  it('treats a completed transaction as persisted even if abort fires before the continuation resumes', async () => {
    const transaction = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      abort: vi.fn(),
      objectStore: vi.fn(() => ({
        put: vi.fn(),
      })),
    };
    const database = {
      transaction: vi.fn(() => transaction),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };
    const openRequest = {
      result: database,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    } as unknown as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const save = storage.putRecord(createPersistedRecord(), {
      abortSignal: abortController.signal,
    });

    (openRequest.onsuccess as (() => void) | null)?.();

    for (let index = 0; index < 10 && !transaction.oncomplete; index += 1) {
      await Promise.resolve();
    }

    expect(transaction.oncomplete).toBeTypeOf('function');

    transaction.oncomplete?.();
    abortController.abort(new Error('Late abort after commit.'));

    await expect(save).resolves.toBeUndefined();
  });

  it('rejects a load promptly when aborting while IndexedDB open is still pending', async () => {
    const indexedDbHost = {
      open: vi.fn(() => ({} as IDBOpenDBRequest)),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const load = storage.getRecord('workspace_abort', {
      abortSignal: abortController.signal,
    });

    expect(indexedDbHost.open).toHaveBeenCalledTimes(1);

    abortController.abort(new Error('Workspace hydration was canceled.'));

    await expect(load).rejects.toThrow('Workspace hydration was canceled.');
  });

  it('aborts a readonly transaction when workspace load is canceled after opening', async () => {
    const transaction = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      abort: vi.fn(),
      objectStore: vi.fn(() => ({
        get: vi.fn(() => ({} as IDBRequest<PersistedWorkspaceRecord | undefined>)),
      })),
    };
    const database = {
      transaction: vi.fn(() => transaction),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
    };
    const openRequest = {
      result: database,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    } as unknown as IDBOpenDBRequest;
    const indexedDbHost = {
      open: vi.fn(() => openRequest),
    };
    vi.stubGlobal('indexedDB', indexedDbHost);

    const storage = new IndexedDbWorkspaceStorage();
    const abortController = new AbortController();
    const load = storage.getRecord('workspace_abort', {
      abortSignal: abortController.signal,
    });

    (openRequest.onsuccess as (() => void) | null)?.();

    for (let index = 0; index < 10 && !transaction.objectStore.mock.calls.length; index += 1) {
      await Promise.resolve();
    }

    abortController.abort(new Error('Workspace load was canceled.'));

    await expect(load).rejects.toThrow('Workspace load was canceled.');
    expect(transaction.abort).toHaveBeenCalledOnce();
  });
});
