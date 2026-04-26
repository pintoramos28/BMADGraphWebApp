import { z } from 'zod';

import {
  workspaceLedgerEntrySchema,
  workspaceSnapshotSchema,
  type WorkspaceLedgerEntry,
  type WorkspaceSnapshot,
} from '../../../schemas/workspace';
import { identifierSchema, isoDateTimeSchema, looseObjectSchema, nonEmptyStringSchema, strictObject } from '../../../schemas/validation';
import type { WorkspaceFileHandle } from '../fs-access/portable-workspace-files';

export interface PersistedWorkspaceRecord {
  workspaceId: string;
  savedAt: string;
  snapshot: unknown;
  ledger: unknown[];
  datasetFileHandles?: unknown[] | undefined;
  benchmarkKey?: string | undefined;
}

export interface PersistedDatasetFileHandle {
  datasetId: string;
  fileName: string;
  fileHandleToken: string;
  fileSize?: number | undefined;
  fileLastModified?: number | undefined;
  fileSha256?: string | undefined;
  handle: WorkspaceFileHandle;
}

export interface SaveCanonicalWorkspaceInput {
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedgerEntry[];
  savedAt: string;
  datasetFileHandles?: PersistedDatasetFileHandle[];
  requiredDatasetFileHandleDatasetIds?: string[];
  benchmarkKey?: string;
  abortSignal?: AbortSignal | undefined;
  assertNotStale?: (() => void) | undefined;
}

export interface WorkspaceRecordSummary {
  workspaceId: string;
  savedAt: string;
  datasetCount: number;
  graphCount: number;
  benchmarkKey?: string | undefined;
}

export interface SaveCanonicalWorkspaceResult extends WorkspaceRecordSummary {
  snapshot: WorkspaceSnapshot;
  datasetFileHandles?: PersistedDatasetFileHandle[] | undefined;
}

export interface WorkspacePersistenceStorage {
  putRecord(record: PersistedWorkspaceRecord, options?: { abortSignal?: AbortSignal | undefined }): Promise<void>;
  getRecord(workspaceId: string, options?: { abortSignal?: AbortSignal | undefined }): Promise<PersistedWorkspaceRecord | null>;
  listRecords(): Promise<PersistedWorkspaceRecord[]>;
}

export interface WorkspaceRepository {
  saveCanonicalWorkspace(input: SaveCanonicalWorkspaceInput): Promise<SaveCanonicalWorkspaceResult>;
  loadWorkspaceRecord(workspaceId: string, options?: { abortSignal?: AbortSignal | undefined }): Promise<PersistedWorkspaceRecord | null>;
  listWorkspaces(): Promise<WorkspaceRecordSummary[]>;
}

const persistedWorkspaceRecordSchema = strictObject({
  workspaceId: identifierSchema,
  savedAt: isoDateTimeSchema,
  snapshot: looseObjectSchema,
  ledger: z.array(z.unknown()),
  datasetFileHandles: z.array(z.unknown()).optional(),
  benchmarkKey: nonEmptyStringSchema.optional(),
});

const persistedDatasetFileHandleSchema = strictObject({
  datasetId: identifierSchema,
  fileName: nonEmptyStringSchema,
  fileHandleToken: identifierSchema,
  fileSize: z.number().int().nonnegative().optional(),
  fileLastModified: z.number().int().nonnegative().optional(),
  fileSha256: nonEmptyStringSchema.optional(),
  handle: z.custom<WorkspaceFileHandle>((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<WorkspaceFileHandle>;

    return typeof candidate.name === 'string'
      && typeof candidate.getFile === 'function'
      && typeof candidate.createWritable === 'function';
  }, 'Expected a WorkspaceFileHandle-compatible object.'),
});

async function sha256Hex(binaryContent: ArrayBuffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Browser source-file verification is unavailable in this environment.');
  }

  const digest = await crypto.subtle.digest('SHA-256', binaryContent);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function createSaveCancellationError(input: Pick<SaveCanonicalWorkspaceInput, 'abortSignal'>) {
  return input.abortSignal?.reason instanceof Error
    ? input.abortSignal.reason
    : new Error('Workspace persistence was aborted.');
}

async function awaitSaveOperation<T>(
  operation: Promise<T>,
  input: Pick<SaveCanonicalWorkspaceInput, 'abortSignal' | 'assertNotStale'>,
) {
  if (!input.abortSignal && !input.assertNotStale) {
    return operation;
  }

  let cleanup = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    const rejectIfAborted = () => reject(createSaveCancellationError(input));
    let staleCheckTimer: ReturnType<typeof setInterval> | undefined;

    if (input.abortSignal) {
      if (input.abortSignal.aborted) {
        rejectIfAborted();
        return;
      }

      input.abortSignal.addEventListener('abort', rejectIfAborted, { once: true });
    }

    if (input.assertNotStale) {
      staleCheckTimer = setInterval(() => {
        try {
          input.assertNotStale?.();
        } catch (error) {
          reject(error);
        }
      }, 10);
    }

    cleanup = () => {
      if (input.abortSignal) {
        input.abortSignal.removeEventListener('abort', rejectIfAborted);
      }

      if (staleCheckTimer !== undefined) {
        clearInterval(staleCheckTimer);
      }
    };
  });

  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    cleanup();
  }
}

function assertSaveCanContinue(input: Pick<SaveCanonicalWorkspaceInput, 'abortSignal' | 'assertNotStale'>) {
  if (input.abortSignal?.aborted) {
    throw input.abortSignal.reason instanceof Error
      ? input.abortSignal.reason
      : new Error('Workspace persistence was aborted.');
  }

  input.assertNotStale?.();
}

async function preparePersistedDatasetFileHandleForSave(
  entry: PersistedDatasetFileHandle,
  options: Pick<SaveCanonicalWorkspaceInput, 'abortSignal' | 'assertNotStale'> = {},
) {
  assertSaveCanContinue(options);
  const parsed = persistedDatasetFileHandleSchema.safeParse(entry);

  if (!parsed.success) {
    return null;
  }

  if (parsed.data.fileSha256 === undefined) {
    return null;
  }

  let file: File;

  try {
    assertSaveCanContinue(options);
    file = await awaitSaveOperation(parsed.data.handle.getFile(), options);
    assertSaveCanContinue(options);
  } catch {
    assertSaveCanContinue(options);
    return null;
  }

  if (file.name !== parsed.data.fileName || parsed.data.handle.name !== parsed.data.fileName) {
    return null;
  }

  if (
    (parsed.data.fileSize !== undefined && file.size !== parsed.data.fileSize)
    || (parsed.data.fileLastModified !== undefined && file.lastModified !== parsed.data.fileLastModified)
  ) {
    return null;
  }

  let fileSha256: string;

  try {
    assertSaveCanContinue(options);
    const fileContent = await awaitSaveOperation(file.arrayBuffer(), options);
    fileSha256 = await awaitSaveOperation(sha256Hex(fileContent), options);
    assertSaveCanContinue(options);
  } catch {
    assertSaveCanContinue(options);
    return null;
  }

  if (fileSha256 !== parsed.data.fileSha256) {
    return null;
  }

  return persistedDatasetFileHandleSchema.parse({
    ...parsed.data,
    fileSize: file.size,
    fileLastModified: file.lastModified,
    fileSha256,
  });
}

function synchronizeSnapshotSourceFileMetadata(
  snapshot: WorkspaceSnapshot,
  datasetFileHandles: PersistedDatasetFileHandle[] | undefined,
) {
  if (datasetFileHandles === undefined) {
    return snapshot;
  }

  const sourceFilesByDatasetId = new Map(
    datasetFileHandles.map((entry) => [
      entry.datasetId,
      {
        fileName: entry.fileName,
        fileHandleToken: entry.fileHandleToken,
      },
    ]),
  );
  let snapshotChanged = false;
  const datasets = snapshot.datasets.map((dataset) => {
    const sourceFile = sourceFilesByDatasetId.get(dataset.datasetId);

    if (!sourceFile) {
      if (!dataset.sourceFile) {
        return dataset;
      }

      snapshotChanged = true;

      const datasetWithoutSourceFile = { ...dataset };
      delete datasetWithoutSourceFile.sourceFile;
      return datasetWithoutSourceFile;
    }

    if (
      dataset.sourceFile?.fileName === sourceFile.fileName
      && dataset.sourceFile?.fileHandleToken === sourceFile.fileHandleToken
    ) {
      return dataset;
    }

    snapshotChanged = true;

    return {
      ...dataset,
      sourceFile,
    };
  });

  return snapshotChanged
    ? workspaceSnapshotSchema.parse({
        ...snapshot,
        datasets,
      } satisfies WorkspaceSnapshot)
    : snapshot;
}

async function preparePersistedDatasetFileHandlesForSaveSequentially(
  datasetFileHandles: PersistedDatasetFileHandle[],
  options: Pick<SaveCanonicalWorkspaceInput, 'abortSignal' | 'assertNotStale'> = {},
) {
  const preparedDatasetFileHandles: PersistedDatasetFileHandle[] = [];

  for (const entry of datasetFileHandles) {
    assertSaveCanContinue(options);
    const preparedEntry = await preparePersistedDatasetFileHandleForSave(entry, options);
    assertSaveCanContinue(options);

    if (preparedEntry) {
      preparedDatasetFileHandles.push(preparedEntry);
    }
  }

  return preparedDatasetFileHandles;
}

function sortBySavedAtDescending<T extends { savedAt: string }>(values: T[]) {
  return [...values].sort((left, right) => {
    const leftTime = Date.parse(left.savedAt);
    const rightTime = Date.parse(right.savedAt);

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.savedAt.localeCompare(left.savedAt);
  });
}

function validateLedgerOrdering(ledger: WorkspaceLedgerEntry[]) {
  let previousSequence = 0;
  let previousWorkspaceVersion = 0;

  for (const entry of ledger) {
    workspaceLedgerEntrySchema.parse(entry);

    if (entry.sequence <= previousSequence) {
      throw new Error('Workspace persistence requires sequence-ordered ledger entries.');
    }

    if (entry.workspaceVersion <= previousWorkspaceVersion) {
      throw new Error('Workspace persistence requires strictly increasing workspace versions.');
    }

    previousSequence = entry.sequence;
    previousWorkspaceVersion = entry.workspaceVersion;
  }
}

function deriveArrayCount(snapshot: unknown, key: 'datasets' | 'graphDefinitions') {
  if (!snapshot || typeof snapshot !== 'object') {
    return 0;
  }

  const value = (snapshot as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : 0;
}

function toRecordSummary(record: PersistedWorkspaceRecord): WorkspaceRecordSummary {
  return {
    workspaceId: record.workspaceId,
    savedAt: record.savedAt,
    datasetCount: deriveArrayCount(record.snapshot, 'datasets'),
    graphCount: deriveArrayCount(record.snapshot, 'graphDefinitions'),
    ...(record.benchmarkKey ? { benchmarkKey: record.benchmarkKey } : {}),
  };
}

function clonePersistedDatasetFileHandle(entry: unknown) {
  if (!entry || typeof entry !== 'object') {
    return structuredClone(entry);
  }

  const candidate = entry as Record<string, unknown>;

  if (!('handle' in candidate)) {
    return structuredClone(entry);
  }

  const { handle, ...rest } = candidate;

  return {
    ...structuredClone(rest),
    handle,
  };
}

function clonePersistedWorkspaceRecord(record: PersistedWorkspaceRecord): PersistedWorkspaceRecord {
  const { datasetFileHandles, ...rest } = record;

  return {
    ...structuredClone(rest),
    ...(datasetFileHandles
      ? {
          datasetFileHandles: datasetFileHandles.map((entry) => clonePersistedDatasetFileHandle(entry)),
        }
      : {}),
  };
}

function hasRequiredDatasetSourceFileHandle(
  snapshot: WorkspaceSnapshot,
  datasetId: string,
  datasetFileHandles: PersistedDatasetFileHandle[] | undefined,
) {
  const dataset = snapshot.datasets.find((candidate) => candidate.datasetId === datasetId);

  if (!dataset?.sourceFile) {
    return false;
  }

  return (datasetFileHandles ?? []).some((entry) =>
    entry.datasetId === datasetId
    && entry.fileName === dataset.sourceFile?.fileName
    && entry.fileHandleToken === dataset.sourceFile?.fileHandleToken,
  );
}

function retainDatasetFileHandlesForSnapshot(
  snapshot: WorkspaceSnapshot,
  datasetFileHandles: PersistedDatasetFileHandle[] | undefined,
) {
  if (datasetFileHandles === undefined) {
    return undefined;
  }

  return datasetFileHandles.filter((entry) => {
    const dataset = snapshot.datasets.find((candidate) => candidate.datasetId === entry.datasetId);

    if (!dataset) {
      return false;
    }

    if (!dataset.sourceFile) {
      return false;
    }

    const hasCurrentSourceHandle = datasetFileHandles.some((candidate) =>
      candidate.datasetId === dataset.datasetId
      && candidate.fileName === dataset.sourceFile?.fileName
      && candidate.fileHandleToken === dataset.sourceFile?.fileHandleToken,
    );

    if (!hasCurrentSourceHandle) {
      return false;
    }

    return entry.fileName === dataset.sourceFile.fileName
      && entry.fileHandleToken === dataset.sourceFile.fileHandleToken;
  });
}

export class InMemoryWorkspaceStorage implements WorkspacePersistenceStorage {
  readonly #records = new Map<string, PersistedWorkspaceRecord>();

  constructor(seedRecords: PersistedWorkspaceRecord[] = []) {
    for (const record of seedRecords) {
      this.#records.set(record.workspaceId, clonePersistedWorkspaceRecord(record));
    }
  }

  async putRecord(record: PersistedWorkspaceRecord, options: { abortSignal?: AbortSignal | undefined } = {}) {
    if (options.abortSignal?.aborted) {
      throw options.abortSignal.reason instanceof Error ? options.abortSignal.reason : new Error('Workspace persistence was aborted.');
    }

    this.#records.set(record.workspaceId, clonePersistedWorkspaceRecord(record));
  }

  async getRecord(workspaceId: string, options: { abortSignal?: AbortSignal | undefined } = {}) {
    if (options.abortSignal?.aborted) {
      throw options.abortSignal.reason instanceof Error ? options.abortSignal.reason : new Error('Workspace persistence was aborted.');
    }

    const record = this.#records.get(workspaceId);

    return record ? clonePersistedWorkspaceRecord(record) : null;
  }

  async listRecords() {
    return sortBySavedAtDescending(
      [...this.#records.values()].map((record) => clonePersistedWorkspaceRecord(record)),
    );
  }
}

export function createWorkspaceRepository(storage: WorkspacePersistenceStorage): WorkspaceRepository {
  return {
    async saveCanonicalWorkspace(input) {
      const snapshot = workspaceSnapshotSchema.parse(input.snapshot);
      const ledger = input.ledger.map((entry) => workspaceLedgerEntrySchema.parse(entry));
      const savedAt = isoDateTimeSchema.parse(input.savedAt);
      const preparedDatasetFileHandles = input.datasetFileHandles
        ? await preparePersistedDatasetFileHandlesForSaveSequentially(input.datasetFileHandles, input)
        : undefined;
      const datasetFileHandles = retainDatasetFileHandlesForSnapshot(snapshot, preparedDatasetFileHandles);
      const requiredDatasetFileHandleDatasetIds = new Set(input.requiredDatasetFileHandleDatasetIds ?? []);

      if (requiredDatasetFileHandleDatasetIds.size > 0) {
        const isMissingRequiredDatasetFileHandle = Array.from(requiredDatasetFileHandleDatasetIds).some(
          (datasetId) => !hasRequiredDatasetSourceFileHandle(snapshot, datasetId, datasetFileHandles),
        );

        if (isMissingRequiredDatasetFileHandle) {
          throw new Error('Source file provenance could not be verified for this workspace save. Reselect the source file and confirm again.');
        }
      }

      validateLedgerOrdering(ledger);

      const snapshotToPersist = synchronizeSnapshotSourceFileMetadata(snapshot, datasetFileHandles);
      input.assertNotStale?.();

      const record = persistedWorkspaceRecordSchema.parse({
        workspaceId: snapshotToPersist.workspaceId,
        savedAt,
        snapshot: structuredClone(snapshotToPersist),
        ledger: structuredClone(ledger),
        ...(datasetFileHandles
          ? {
              datasetFileHandles: datasetFileHandles.map((entry) =>
                persistedDatasetFileHandleSchema.parse(entry),
              ),
            }
          : {}),
        ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
      });

      input.assertNotStale?.();
      await storage.putRecord(record, { abortSignal: input.abortSignal });

      return {
        ...toRecordSummary(record),
        snapshot: snapshotToPersist,
        ...(datasetFileHandles !== undefined ? { datasetFileHandles } : {}),
      };
    },

    async loadWorkspaceRecord(workspaceId, options = {}) {
      const record = await storage.getRecord(workspaceId, {
        abortSignal: options.abortSignal,
      });

      if (!record) {
        return null;
      }

      return persistedWorkspaceRecordSchema.parse(record);
    },

    async listWorkspaces() {
      const records = await storage.listRecords();

      return sortBySavedAtDescending(
        records.map((record) => toRecordSummary(persistedWorkspaceRecordSchema.parse(record))),
      );
    },
  };
}
