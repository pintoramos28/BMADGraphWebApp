import { z } from 'zod';

import type { WorkspaceSnapshot } from '../../schemas/workspace';
import { identifierSchema, nonEmptyStringSchema, strictObject } from '../../schemas/validation';
import type { PersistedDatasetFileHandle } from '../../services/persistence';
import {
  validateWorkspaceFileHandleSnapshot,
  type WorkspaceFileHandle,
} from '../../services/persistence/fs-access/portable-workspace-files';

export const HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS = 5_000;
export const MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES = 1_000;

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
}).refine((value) => value.handle.name === value.fileName, {
  message: 'Expected the persisted file handle name to match the dataset source file name.',
  path: ['handle'],
});

const hydrationPersistedDatasetFileHandleSchema = persistedDatasetFileHandleSchema.safeExtend({
  fileSize: z.number().int().nonnegative(),
  fileLastModified: z.number().int().nonnegative(),
  fileSha256: nonEmptyStringSchema,
});

function assertPreparationNotAborted(
  signal: AbortSignal | undefined,
  assertNotStale: (() => void) | undefined,
) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Dataset file-handle preparation was canceled.');
  }

  assertNotStale?.();
}

function clonePersistedDatasetFileHandle(entry: PersistedDatasetFileHandle) {
  return {
    datasetId: entry.datasetId,
    fileName: entry.fileName,
    fileHandleToken: entry.fileHandleToken,
    ...(entry.fileSize !== undefined ? { fileSize: entry.fileSize } : {}),
    ...(entry.fileLastModified !== undefined ? { fileLastModified: entry.fileLastModified } : {}),
    ...(entry.fileSha256 !== undefined ? { fileSha256: entry.fileSha256 } : {}),
    handle: entry.handle,
  } satisfies PersistedDatasetFileHandle;
}

function createHydrationHandleValidationKey(
  entry: Pick<PersistedDatasetFileHandle, 'fileName' | 'fileSize' | 'fileLastModified' | 'fileSha256'>,
) {
  return `${entry.fileName}\u0000${entry.fileSize}\u0000${entry.fileLastModified}\u0000${entry.fileSha256}`;
}

export function parsePersistedDatasetFileHandles(
  values: unknown[],
  options: { maxEntries?: number | undefined } = {},
) {
  const accepted: PersistedDatasetFileHandle[] = [];
  const maxEntries = Math.max(
    0,
    Math.floor(options.maxEntries ?? MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES),
  );

  for (let index = 0; index < Math.min(values.length, maxEntries); index += 1) {
    const value = values[index];
    const parsed = persistedDatasetFileHandleSchema.safeParse(value);

    if (!parsed.success) {
      continue;
    }

    accepted.push(clonePersistedDatasetFileHandle(parsed.data));
  }

  return accepted;
}

export async function preparePersistedDatasetFileHandlesForSave(
  entries: PersistedDatasetFileHandle[],
  options: {
    signal?: AbortSignal | undefined;
    assertNotStale?: (() => void) | undefined;
  } = {},
) {
  const accepted: PersistedDatasetFileHandle[] = [];

  for (const entry of entries) {
    assertPreparationNotAborted(options.signal, options.assertNotStale);

    const parsed = persistedDatasetFileHandleSchema.safeParse(entry);

    if (!parsed.success) {
      continue;
    }

    if (parsed.data.fileSha256 === undefined) {
      continue;
    }

    const validatedFile = await validateWorkspaceFileHandleSnapshot(parsed.data.handle, {
      fileName: parsed.data.fileName,
      ...(parsed.data.fileSize !== undefined ? { fileSize: parsed.data.fileSize } : {}),
      ...(parsed.data.fileLastModified !== undefined ? { fileLastModified: parsed.data.fileLastModified } : {}),
      fileSha256: parsed.data.fileSha256,
    }, options);
    assertPreparationNotAborted(options.signal, options.assertNotStale);

    if (!validatedFile) {
      continue;
    }

    accepted.push({
      ...parsed.data,
      fileSize: validatedFile.fileSize,
      fileLastModified: validatedFile.fileLastModified,
      fileSha256: validatedFile.fileSha256,
    });
  }

  return accepted;
}

export async function sanitizePersistedDatasetFileHandlesForHydration(
  values: unknown[],
  options: {
    signal?: AbortSignal | undefined;
    timeoutMs?: number | undefined;
  } = {},
) {
  const accepted: PersistedDatasetFileHandle[] = [];
  const seenEntries = new Set<string>();
  const validHandleSnapshots = new WeakMap<object, Set<string>>();
  const failedHandleSnapshotsByEntry = new WeakMap<object, Set<string>>();
  const hydrationTimeoutMs = options.timeoutMs ?? HYDRATION_DATASET_FILE_HANDLE_TIMEOUT_MS;
  const hydrationDeadline = Number.isFinite(hydrationTimeoutMs) && hydrationTimeoutMs >= 0
    ? Date.now() + hydrationTimeoutMs
    : null;
  const validatableEntriesByKey = new Map<string, Array<z.infer<typeof hydrationPersistedDatasetFileHandleSchema>>>();
  const validatableEntryKeys: string[] = [];
  const handleObjectIds = new WeakMap<object, number>();
  let nextHandleObjectId = 0;
  const getHandleObjectId = (handleObject: object) => {
    const existingId = handleObjectIds.get(handleObject);

    if (existingId !== undefined) {
      return existingId;
    }

    const nextId = nextHandleObjectId;
    nextHandleObjectId += 1;
    handleObjectIds.set(handleObject, nextId);

    return nextId;
  };

  let processedRawEntries = 0;

  for (const value of values) {
    assertPreparationNotAborted(options.signal, undefined);

    if (hydrationDeadline !== null && Date.now() >= hydrationDeadline) {
      break;
    }

    processedRawEntries += 1;

    if (processedRawEntries > MAX_HYDRATION_DATASET_FILE_HANDLE_RAW_ENTRIES) {
      break;
    }

    const parsed = hydrationPersistedDatasetFileHandleSchema.safeParse(value);

    if (!parsed.success) {
      continue;
    }

    const entryKey = `${parsed.data.datasetId}\u0000${parsed.data.fileHandleToken}\u0000${parsed.data.fileName}`;
    const entries = validatableEntriesByKey.get(entryKey);

    if (entries) {
      entries.push(parsed.data);

      continue;
    }

    validatableEntriesByKey.set(entryKey, [parsed.data]);
    validatableEntryKeys.push(entryKey);
  }

  const effectiveCandidateCountsByEntryKey = new Map<string, number>();
  const compatibleEntryCountsByValidationAttemptKey = new Map<string, number>();
  const createHydrationValidationAttemptKey = (
    entryCandidate: z.infer<typeof hydrationPersistedDatasetFileHandleSchema>,
  ) => `${getHandleObjectId(entryCandidate.handle as object)}\u0000${createHydrationHandleValidationKey(entryCandidate)}`;

  for (const [entryKey, entryCandidates] of validatableEntriesByKey) {
    const uniqueValidationCandidates = new Set<string>();

    for (const entryCandidate of entryCandidates) {
      uniqueValidationCandidates.add(createHydrationValidationAttemptKey(entryCandidate));
    }

    for (const validationAttemptKey of uniqueValidationCandidates) {
      compatibleEntryCountsByValidationAttemptKey.set(
        validationAttemptKey,
        (compatibleEntryCountsByValidationAttemptKey.get(validationAttemptKey) ?? 0) + 1,
      );
    }

    effectiveCandidateCountsByEntryKey.set(entryKey, Math.max(uniqueValidationCandidates.size, 1));
  }

  const perEntryTimeoutMs = hydrationDeadline === null
    ? undefined
    : Math.max(1, Math.ceil(hydrationTimeoutMs / Math.max(validatableEntryKeys.length, 1)));
  const getRemainingHydrationTimeoutMs = () => {
    if (hydrationDeadline === null) {
      return undefined;
    }

    return Math.max(0, hydrationDeadline - Date.now());
  };
  const hydrationDeadlineExpired = () => hydrationDeadline !== null && Date.now() >= hydrationDeadline;
  const createValidationOptions = (
    entryKey: string,
    parsed: z.infer<typeof hydrationPersistedDatasetFileHandleSchema>,
  ) => {
    const remainingTimeoutMs = getRemainingHydrationTimeoutMs();
    const effectiveCandidateCount = effectiveCandidateCountsByEntryKey.get(entryKey) ?? 1;
    const compatibleEntryCount = compatibleEntryCountsByValidationAttemptKey.get(createHydrationValidationAttemptKey(parsed)) ?? 1;
    const compatibleBackfillBudgetMultiplier = Math.max(1, compatibleEntryCount - 1);
    const perCandidateTimeoutMs = perEntryTimeoutMs === undefined
      ? undefined
      : Math.max(
          1,
          Math.ceil((perEntryTimeoutMs * compatibleBackfillBudgetMultiplier) / Math.max(effectiveCandidateCount, 1)),
        );
    const timeoutMs = remainingTimeoutMs === undefined
      ? undefined
      : Math.min(remainingTimeoutMs, perCandidateTimeoutMs ?? remainingTimeoutMs);

    return {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    };
  };
  const acceptValidatedCompatibleEntries = (
    parsed: z.infer<typeof hydrationPersistedDatasetFileHandleSchema>,
    handleValidationKey: string,
  ) => {
    const handleObject = parsed.handle as object;

    // A successful byte/digest validation proves the current handle object and
    // metadata snapshot for this hydration pass. Immediately backfill every
    // compatible entry instead of lazily reusing the success later, which keeps
    // shared-handle provenance consistent while avoiding extra same-pass reads.
    for (const candidateEntryKey of validatableEntryKeys) {
      if (seenEntries.has(candidateEntryKey)) {
        continue;
      }

      const compatibleCandidate = (validatableEntriesByKey.get(candidateEntryKey) ?? [])
        .find((entryCandidate) =>
          entryCandidate.handle === handleObject
          && createHydrationHandleValidationKey(entryCandidate) === handleValidationKey,
        );

      if (!compatibleCandidate) {
        continue;
      }

      accepted.push(clonePersistedDatasetFileHandle(compatibleCandidate));
      seenEntries.add(candidateEntryKey);
    }
  };

  let candidateIndex = 0;
  let attemptedCandidate = true;

  while (attemptedCandidate && !hydrationDeadlineExpired()) {
    attemptedCandidate = false;

    for (const entryKey of validatableEntryKeys) {
      if (hydrationDeadlineExpired()) {
        break;
      }

      if (seenEntries.has(entryKey)) {
        continue;
      }

      const entryCandidates = validatableEntriesByKey.get(entryKey) ?? [];
      const parsed = entryCandidates[candidateIndex];

      if (!parsed) {
        continue;
      }

      attemptedCandidate = true;

      assertPreparationNotAborted(options.signal, undefined);

      const handleValidationKey = createHydrationHandleValidationKey(parsed);
      const handleObject = parsed.handle as object;
      let validHandleSnapshotKeys = validHandleSnapshots.get(handleObject);

      if (!validHandleSnapshotKeys) {
        validHandleSnapshotKeys = new Set<string>();
        validHandleSnapshots.set(handleObject, validHandleSnapshotKeys);
      }

      let failedHandleSnapshotKeys = failedHandleSnapshotsByEntry.get(handleObject);

      if (!failedHandleSnapshotKeys) {
        failedHandleSnapshotKeys = new Set<string>();
        failedHandleSnapshotsByEntry.set(handleObject, failedHandleSnapshotKeys);
      }

      const failedEntryValidationKey = `${entryKey}\u0000${handleValidationKey}`;
      let isValid = validHandleSnapshotKeys.has(handleValidationKey);

      if (!isValid && failedHandleSnapshotKeys.has(failedEntryValidationKey)) {
        continue;
      }

      if (!isValid) {
        const validatedFile = await validateWorkspaceFileHandleSnapshot(parsed.handle, {
          fileName: parsed.fileName,
          fileSize: parsed.fileSize,
          fileLastModified: parsed.fileLastModified,
          fileSha256: parsed.fileSha256,
        }, createValidationOptions(entryKey, parsed));
        assertPreparationNotAborted(options.signal, undefined);

        isValid = Boolean(validatedFile);

        if (isValid) {
          validHandleSnapshotKeys.add(handleValidationKey);
        } else {
          failedHandleSnapshotKeys.add(failedEntryValidationKey);
        }
      }

      if (!isValid) {
        continue;
      }

      acceptValidatedCompatibleEntries(parsed, handleValidationKey);
    }

    candidateIndex += 1;
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
