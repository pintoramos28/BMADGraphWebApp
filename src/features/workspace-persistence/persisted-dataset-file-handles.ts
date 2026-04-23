import { z } from 'zod';

import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { identifierSchema, nonEmptyStringSchema, strictObject } from '../../schemas/validation';
import type { PersistedDatasetFileHandle } from '../../services/persistence';
import type { WorkspaceFileHandle } from '../../services/persistence/fs-access/portable-workspace-files';

const persistedDatasetFileHandleSchema = strictObject({
  datasetId: identifierSchema,
  fileName: nonEmptyStringSchema,
  fileHandleToken: identifierSchema,
  fileSize: z.number().int().nonnegative().optional(),
  fileLastModified: z.number().int().nonnegative().optional(),
  handle: z.custom<WorkspaceFileHandle>((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<WorkspaceFileHandle>;

    return typeof candidate.name === 'string'
      && typeof candidate.getFile === 'function'
      && typeof candidate.createWritable === 'function';
  }, 'Expected a WorkspaceFileHandle-compatible object.'),
}).refine((value) => value.handle.name === value.fileName, {
  message: 'Expected the persisted file handle name to match the dataset source file name.',
  path: ['handle'],
});

const hydrationPersistedDatasetFileHandleSchema = persistedDatasetFileHandleSchema.safeExtend({
  fileSize: z.number().int().nonnegative(),
  fileLastModified: z.number().int().nonnegative(),
});

async function readHandleFile(handle: WorkspaceFileHandle) {
  try {
    return await handle.getFile();
  } catch {
    return null;
  }
}

function clonePersistedDatasetFileHandle(entry: PersistedDatasetFileHandle) {
  return {
    datasetId: entry.datasetId,
    fileName: entry.fileName,
    fileHandleToken: entry.fileHandleToken,
    ...(entry.fileSize !== undefined ? { fileSize: entry.fileSize } : {}),
    ...(entry.fileLastModified !== undefined ? { fileLastModified: entry.fileLastModified } : {}),
    handle: entry.handle,
  } satisfies PersistedDatasetFileHandle;
}

export function parsePersistedDatasetFileHandles(values: unknown[]) {
  const accepted: PersistedDatasetFileHandle[] = [];

  values.forEach((value) => {
    const parsed = persistedDatasetFileHandleSchema.safeParse(value);

    if (!parsed.success) {
      return;
    }

    accepted.push(clonePersistedDatasetFileHandle(parsed.data));
  });

  return accepted;
}

export async function preparePersistedDatasetFileHandlesForSave(entries: PersistedDatasetFileHandle[]) {
  const accepted: PersistedDatasetFileHandle[] = [];

  for (const entry of entries) {
    const parsed = persistedDatasetFileHandleSchema.safeParse(entry);

    if (!parsed.success) {
      continue;
    }

    const file = await readHandleFile(parsed.data.handle);

    if (!file || file.name !== parsed.data.fileName) {
      continue;
    }

    accepted.push({
      ...parsed.data,
      fileSize: file.size,
      fileLastModified: file.lastModified,
    });
  }

  return accepted;
}

export async function sanitizePersistedDatasetFileHandlesForHydration(values: unknown[]) {
  const accepted: PersistedDatasetFileHandle[] = [];
  const seenHandles = new WeakSet<object>();

  for (const value of values) {
    const parsed = hydrationPersistedDatasetFileHandleSchema.safeParse(value);

    if (!parsed.success) {
      continue;
    }

    if (seenHandles.has(parsed.data.handle as object)) {
      continue;
    }

    const file = await readHandleFile(parsed.data.handle);

    if (
      !file
      || file.name !== parsed.data.fileName
      || file.size !== parsed.data.fileSize
      || file.lastModified !== parsed.data.fileLastModified
    ) {
      continue;
    }

    seenHandles.add(parsed.data.handle as object);
    accepted.push(clonePersistedDatasetFileHandle(parsed.data));
  }

  return accepted;
}

export function isCompatibleDatasetFileHandle(
  dataset: Pick<WorkspaceSnapshot['datasets'][number], 'datasetId' | 'sourceFile'>,
  entry: Pick<PersistedDatasetFileHandle, 'datasetId' | 'fileName' | 'fileHandleToken'>,
) {
  return dataset.sourceFile !== undefined
    && dataset.sourceFile.fileHandleToken === entry.fileHandleToken
    && dataset.datasetId === entry.datasetId
    && dataset.sourceFile.fileName === entry.fileName;
}

export function retainDatasetFileHandlesForSnapshot(
  snapshot: WorkspaceSnapshot,
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  return datasetFileHandles
    .filter((entry) =>
      snapshot.datasets.some((dataset) => isCompatibleDatasetFileHandle(dataset, entry)),
    )
    .map((entry) => ({
      ...entry,
    }));
}
