import { z } from 'zod';

import { dottedTypeSchema, identifierSchema, positiveIntegerSchema, semverSchema, strictObject } from '../validation';

export const workerMessageEnvelopeSchema = strictObject({
  schemaVersion: semverSchema,
  messageId: identifierSchema,
  correlationId: identifierSchema,
  workspaceVersion: positiveIntegerSchema,
  type: dottedTypeSchema,
  payload: z.unknown(),
});

export type WorkerMessageEnvelope = z.infer<typeof workerMessageEnvelopeSchema>;
