import { z } from 'zod';

import {
  dateVersionSchema,
  isoDateTimeSchema,
  nonEmptyStringSchema,
  positiveIntegerSchema,
  semverSchema,
  sha256TokenSchema,
  strictObject,
  versionRangeSchema,
} from '../validation';

export const releaseManifestSchema = strictObject({
  schemaVersion: semverSchema,
  appBuildVersion: semverSchema,
  releaseDate: isoDateTimeSchema,
  channel: nonEmptyStringSchema,
  supportMatrixVersion: dateVersionSchema,
  supportMatrixUrl: nonEmptyStringSchema,
  workspaceCompatibility: strictObject({
    minReadableFormat: semverSchema,
    maxReadableFormat: versionRangeSchema,
    migrationPolicy: z.enum(['migrate-on-open']),
  }),
  serviceWorker: strictObject({
    version: nonEmptyStringSchema,
    scope: nonEmptyStringSchema,
    offlineReadyTimeoutMs: positiveIntegerSchema,
    updatePromptMode: z.enum(['soft-refresh', 'hard-refresh']),
  }),
  telemetry: strictObject({
    endpoint: nonEmptyStringSchema,
    schemaVersion: semverSchema,
  }),
  releaseNotes: strictObject({
    title: nonEmptyStringSchema,
    url: nonEmptyStringSchema,
  }),
  integrity: strictObject({
    manifestSha256: sha256TokenSchema,
  }),
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
