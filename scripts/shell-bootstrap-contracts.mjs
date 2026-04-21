import { z } from 'zod';

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const dateVersionPattern = /^\d{4}-\d{2}-\d{2}$/;
const versionRangePattern = /^\d+(?:\.\d+)?\.x$/;
const sha256Pattern = /^sha256:[A-Fa-f0-9]{64}$/;

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDateTimeSchema = nonEmptyStringSchema.refine(
  (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value)),
  'Expected an ISO-8601 UTC timestamp.',
);
const semverSchema = nonEmptyStringSchema.regex(semverPattern, 'Expected a semantic version like 1.0.0.');
const versionRangeSchema = nonEmptyStringSchema.regex(versionRangePattern, 'Expected a version range like 1.x.');
const dateVersionSchema = nonEmptyStringSchema.regex(dateVersionPattern, 'Expected a YYYY-MM-DD contract version.');
const sha256TokenSchema = nonEmptyStringSchema.regex(sha256Pattern, 'Expected a sha256 token.');
const positiveIntegerSchema = z.number().int().positive();

function strictObject(shape) {
  return z.object(shape).strict();
}

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

const browserSupportSchema = strictObject({
  family: z.enum(['chrome', 'edge', 'firefox', 'safari']),
  supportLevel: z.enum(['supported', 'secondary', 'unsupported']),
  minimumMajorVersion: positiveIntegerSchema.optional(),
  desktopOnly: z.literal(true),
  notes: nonEmptyStringSchema.optional(),
});

export const supportMatrixSchema = strictObject({
  version: dateVersionSchema,
  publishedAt: isoDateTimeSchema,
  standardZoom: nonEmptyStringSchema,
  supportedBrowsers: z.array(browserSupportSchema).min(1),
  workspaceCompatibility: strictObject({
    minimumReadableFormat: semverSchema,
    maximumReadableFormat: versionRangeSchema,
  }),
});
