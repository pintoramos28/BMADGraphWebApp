import { z } from 'zod';

import {
  dateVersionSchema,
  dottedTypeSchema,
  isoDateTimeSchema,
  literalFalseSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  primitiveValueSchema,
  semverSchema,
  strictObject,
} from '../validation';

const telemetryMetricsSchema = z.record(z.string(), nonNegativeIntegerSchema.or(z.number()));
const telemetryDimensionsSchema = z.record(z.string(), primitiveValueSchema);

export const telemetryBatchSchema = strictObject({
  schemaVersion: semverSchema,
  batchId: nonEmptyStringSchema,
  sentAt: isoDateTimeSchema,
  appBuildVersion: semverSchema,
  sessionId: nonEmptyStringSchema,
  queueState: strictObject({
    status: z.enum(['queued', 'flushing', 'flushed']),
    queuedCountBeforeFlush: nonNegativeIntegerSchema,
  }),
  environment: strictObject({
    browserName: nonEmptyStringSchema,
    browserVersion: nonEmptyStringSchema,
    osFamily: nonEmptyStringSchema,
    online: z.boolean(),
    supportedEnvironment: z.boolean(),
    viewportWidth: nonNegativeIntegerSchema,
    viewportHeight: nonNegativeIntegerSchema,
  }),
  privacy: strictObject({
    containsDatasetRows: literalFalseSchema,
    containsFormulas: literalFalseSchema,
    containsWorkspaceBlob: literalFalseSchema,
    containsEvidenceText: literalFalseSchema,
  }),
  events: z.array(
    strictObject({
      eventId: nonEmptyStringSchema,
      type: dottedTypeSchema,
      occurredAt: isoDateTimeSchema,
      workspaceRef: nonEmptyStringSchema,
      graphId: nonEmptyStringSchema.optional(),
      metrics: telemetryMetricsSchema,
      dimensions: telemetryDimensionsSchema,
      outcome: z.enum(['success', 'failure']),
    }),
  ),
});

export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
export const telemetrySchemaVersionSchema = dateVersionSchema.or(semverSchema);
