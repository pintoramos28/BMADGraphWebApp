import { z } from 'zod';

import { nonEmptyStringSchema, strictObject } from '../validation';
import { issueSeveritySchema } from '../workspace';

export const errorDetailsSchema = strictObject({
  code: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  detail: nonEmptyStringSchema,
  severity: issueSeveritySchema,
  retryable: z.boolean(),
  contextRef: nonEmptyStringSchema.optional(),
});

export const errorEnvelopeSchema = strictObject({
  ok: z.literal(false),
  error: errorDetailsSchema,
});

export const successEnvelopeSchema = strictObject({
  ok: z.literal(true),
  data: z.unknown(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const apiResponseSchema = z.union([successEnvelopeSchema, errorEnvelopeSchema]);

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
