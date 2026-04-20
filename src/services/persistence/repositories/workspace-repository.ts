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
  handle: WorkspaceFileHandle;
}

export interface SaveCanonicalWorkspaceInput {
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedgerEntry[];
  savedAt: string;
  datasetFileHandles?: PersistedDatasetFileHandle[];
  benchmarkKey?: string;
}

export interface WorkspaceRecordSummary {
  workspaceId: string;
  savedAt: string;
  datasetCount: number;
  graphCount: number;
  benchmarkKey?: string | undefined;
}

export interface WorkspacePersistenceStorage {
  putRecord(record: PersistedWorkspaceRecord): Promise<void>;
  getRecord(workspaceId: string): Promise<PersistedWorkspaceRecord | null>;
  listRecords(): Promise<PersistedWorkspaceRecord[]>;
}

export interface WorkspaceRepository {
  saveCanonicalWorkspace(input: SaveCanonicalWorkspaceInput): Promise<WorkspaceRecordSummary>;
  loadWorkspaceRecord(workspaceId: string): Promise<PersistedWorkspaceRecord | null>;
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

export class InMemoryWorkspaceStorage implements WorkspacePersistenceStorage {
  readonly #records = new Map<string, PersistedWorkspaceRecord>();

  constructor(seedRecords: PersistedWorkspaceRecord[] = []) {
    for (const record of seedRecords) {
      this.#records.set(record.workspaceId, clonePersistedWorkspaceRecord(record));
    }
  }

  async putRecord(record: PersistedWorkspaceRecord) {
    this.#records.set(record.workspaceId, clonePersistedWorkspaceRecord(record));
  }

  async getRecord(workspaceId: string) {
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

      validateLedgerOrdering(ledger);

      const record = persistedWorkspaceRecordSchema.parse({
        workspaceId: snapshot.workspaceId,
        savedAt,
        snapshot: structuredClone(snapshot),
        ledger: structuredClone(ledger),
        ...(input.datasetFileHandles
          ? {
              datasetFileHandles: input.datasetFileHandles.map((entry) =>
                persistedDatasetFileHandleSchema.parse(entry),
              ),
            }
          : {}),
        ...(input.benchmarkKey ? { benchmarkKey: input.benchmarkKey } : {}),
      });

      await storage.putRecord(record);

      return toRecordSummary(record);
    },

    async loadWorkspaceRecord(workspaceId) {
      const record = await storage.getRecord(workspaceId);

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
