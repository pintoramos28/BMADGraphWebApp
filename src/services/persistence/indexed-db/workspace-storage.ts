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

export class IndexedDbWorkspaceStorage implements WorkspacePersistenceStorage {
  readonly #options: Required<IndexedDbWorkspaceStorageOptions>;
  #databasePromise?: Promise<IDBDatabase>;

  constructor(options: IndexedDbWorkspaceStorageOptions = {}) {
    this.#options = {
      ...defaultOptions,
      ...options,
    };
  }

  async putRecord(record: PersistedWorkspaceRecord) {
    const database = await this.#openDatabase();
    const transaction = database.transaction(this.#options.objectStoreName, 'readwrite');

    transaction.objectStore(this.#options.objectStoreName).put(structuredClone(record));
    await transactionToPromise(transaction);
  }

  async getRecord(workspaceId: string) {
    const database = await this.#openDatabase();
    const transaction = database.transaction(this.#options.objectStoreName, 'readonly');
    const result = await requestToPromise(
      transaction.objectStore(this.#options.objectStoreName).get(workspaceId),
    );

    await transactionToPromise(transaction);

    return result ? structuredClone(result as PersistedWorkspaceRecord) : null;
  }

  async listRecords() {
    const database = await this.#openDatabase();
    const transaction = database.transaction(this.#options.objectStoreName, 'readonly');
    const result = await requestToPromise(
      transaction.objectStore(this.#options.objectStoreName).getAll(),
    );

    await transactionToPromise(transaction);

    return (result as PersistedWorkspaceRecord[]).map((record) => structuredClone(record));
  }

  async #openDatabase() {
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
