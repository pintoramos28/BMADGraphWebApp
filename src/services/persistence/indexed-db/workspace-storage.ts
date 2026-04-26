import type { PersistedWorkspaceRecord, WorkspacePersistenceStorage } from '../repositories/workspace-repository';

interface IndexedDbWorkspaceStorageOptions {
  databaseName?: string;
  objectStoreName?: string;
  version?: number;
}

const defaultOptions: Required<IndexedDbWorkspaceStorageOptions> = {
  databaseName: 'bmad-graph-web-app',
  objectStoreName: 'workspaceRecords',
  version: 1,
};

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function createPersistenceAbortError(signal: AbortSignal | undefined) {
  return signal?.reason instanceof Error ? signal.reason : new Error('Workspace persistence was aborted.');
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw createPersistenceAbortError(signal);
  }
}

async function awaitWithAbort<T>(operation: Promise<T>, signal: AbortSignal | undefined) {
  if (!signal) {
    return operation;
  }

  throwIfAborted(signal);

  let cleanup = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    const rejectIfAborted = () => reject(createPersistenceAbortError(signal));

    signal.addEventListener('abort', rejectIfAborted, { once: true });
    cleanup = () => signal.removeEventListener('abort', rejectIfAborted);
  });

  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    cleanup();
  }
}

export class IndexedDbWorkspaceStorage implements WorkspacePersistenceStorage {
  readonly #options: Required<IndexedDbWorkspaceStorageOptions>;
  #databasePromise: Promise<IDBDatabase> | undefined;
  #databaseOpenWaiterCount = 0;

  constructor(options: IndexedDbWorkspaceStorageOptions = {}) {
    this.#options = {
      ...defaultOptions,
      ...options,
    };
  }

  async putRecord(record: PersistedWorkspaceRecord, options: { abortSignal?: AbortSignal | undefined } = {}) {
    throwIfAborted(options.abortSignal);
    let database: IDBDatabase;
    const openDatabasePromise = this.#openDatabase();
    this.#databaseOpenWaiterCount += 1;

    try {
      database = await awaitWithAbort(openDatabasePromise, options.abortSignal);
    } catch (error) {
      if (
        options.abortSignal?.aborted
        && this.#databaseOpenWaiterCount === 1
        && this.#databasePromise === openDatabasePromise
      ) {
        this.#databasePromise = undefined;
        void openDatabasePromise.then((lateDatabase) => {
          lateDatabase.close();
        }, () => {
          // The original open failed after the caller already observed abort.
        });
      }

      throw error;
    } finally {
      this.#databaseOpenWaiterCount -= 1;
    }

    const throwIfPutAborted = () => throwIfAborted(options.abortSignal);

    throwIfPutAborted();

    const transaction = database.transaction(this.#options.objectStoreName, 'readwrite');
    const abortTransaction = () => {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be complete or aborted; in either case the
        // awaiting caller will observe either completion plus a post-save guard or
        // the transaction rejection.
      }
    };

    options.abortSignal?.addEventListener('abort', abortTransaction, { once: true });

    try {
      throwIfPutAborted();
      transaction.objectStore(this.#options.objectStoreName).put(structuredClone(record));
      await transactionToPromise(transaction);
    } finally {
      options.abortSignal?.removeEventListener('abort', abortTransaction);
    }
  }

  async getRecord(workspaceId: string, options: { abortSignal?: AbortSignal | undefined } = {}) {
    throwIfAborted(options.abortSignal);
    let database: IDBDatabase;
    const openDatabasePromise = this.#openDatabase();
    this.#databaseOpenWaiterCount += 1;

    try {
      database = await awaitWithAbort(openDatabasePromise, options.abortSignal);
    } catch (error) {
      if (
        options.abortSignal?.aborted
        && this.#databaseOpenWaiterCount === 1
        && this.#databasePromise === openDatabasePromise
      ) {
        this.#databasePromise = undefined;
        void openDatabasePromise.then((lateDatabase) => {
          lateDatabase.close();
        }, () => {
          // The original open failed after the caller already observed abort.
        });
      }

      throw error;
    } finally {
      this.#databaseOpenWaiterCount -= 1;
    }

    throwIfAborted(options.abortSignal);

    const transaction = database.transaction(this.#options.objectStoreName, 'readonly');
    const abortTransaction = () => {
      try {
        transaction.abort();
      } catch {
        // The read may already have completed or been aborted; the awaiting
        // operation will observe whichever state won the race.
      }
    };

    options.abortSignal?.addEventListener('abort', abortTransaction, { once: true });

    try {
      const result = await awaitWithAbort(
        requestToPromise(transaction.objectStore(this.#options.objectStoreName).get(workspaceId)),
        options.abortSignal,
      );

      await awaitWithAbort(transactionToPromise(transaction), options.abortSignal);

      return result ? structuredClone(result as PersistedWorkspaceRecord) : null;
    } finally {
      options.abortSignal?.removeEventListener('abort', abortTransaction);
    }
  }

  async listRecords() {
    const openDatabasePromise = this.#openDatabase();
    this.#databaseOpenWaiterCount += 1;
    let database: IDBDatabase;

    try {
      database = await openDatabasePromise;
    } finally {
      this.#databaseOpenWaiterCount -= 1;
    }

    const transaction = database.transaction(this.#options.objectStoreName, 'readonly');
    const result = await requestToPromise(
      transaction.objectStore(this.#options.objectStoreName).getAll(),
    );

    await transactionToPromise(transaction);

    return (result as PersistedWorkspaceRecord[]).map((record) => structuredClone(record));
  }

  #openDatabase() {
    if (!this.#databasePromise) {
      this.#databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.#options.databaseName, this.#options.version);

        request.onupgradeneeded = () => {
          const database = request.result;

          if (!database.objectStoreNames.contains(this.#options.objectStoreName)) {
            database.createObjectStore(this.#options.objectStoreName, {
              keyPath: 'workspaceId',
            });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
      });
    }

    return this.#databasePromise;
  }
}
