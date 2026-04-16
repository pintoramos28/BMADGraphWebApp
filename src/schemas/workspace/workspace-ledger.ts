import { z } from 'zod';

import {
  dottedTypeSchema,
  identifierSchema,
  isoDateTimeSchema,
  looseObjectSchema,
  nonEmptyStringSchema,
  positiveIntegerSchema,
  strictObject,
} from '../validation';

const readinessStatusSchema = z.enum(['ready', 'warning', 'blocked']);

export const workspaceLedgerEntrySchema = strictObject({
  ledgerEntryId: identifierSchema,
  sequence: positiveIntegerSchema,
  occurredAt: isoDateTimeSchema,
  type: dottedTypeSchema,
  actor: strictObject({
    kind: nonEmptyStringSchema,
    id: identifierSchema,
  }),
  workspaceVersion: positiveIntegerSchema,
  entityRefs: z.record(z.string(), nonEmptyStringSchema),
  payload: looseObjectSchema,
  trustImpact: strictObject({
    readinessBefore: readinessStatusSchema,
    readinessAfter: readinessStatusSchema,
  }).optional(),
  correlationId: identifierSchema,
});

export type WorkspaceLedgerEntry = z.infer<typeof workspaceLedgerEntrySchema>;
