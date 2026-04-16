import { z } from 'zod';

import {
  identifierSchema,
  looseObjectSchema,
  nonEmptyStringSchema,
  isoDateTimeSchema,
  strictObject,
} from '../validation';

export const issueSeveritySchema = z.enum(['info', 'warning', 'blocking']);
export const issueStatusSchema = z.enum(['open', 'deferred', 'resolved']);

export const issueContextRefSchema = strictObject({
  routeKey: nonEmptyStringSchema,
  workspaceId: identifierSchema.optional(),
  graphId: identifierSchema.optional(),
  panel: nonEmptyStringSchema.optional(),
});

export const repairActionSchema = strictObject({
  actionId: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  command: nonEmptyStringSchema,
  args: looseObjectSchema,
});

export const issueRecordSchema = strictObject({
  issueId: identifierSchema,
  kind: nonEmptyStringSchema,
  severity: issueSeveritySchema,
  status: issueStatusSchema,
  detectedAt: isoDateTimeSchema,
  source: strictObject({
    module: nonEmptyStringSchema,
    entityType: nonEmptyStringSchema,
    entityId: identifierSchema,
  }),
  title: nonEmptyStringSchema,
  detail: nonEmptyStringSchema,
  userMessage: nonEmptyStringSchema,
  contextRef: issueContextRefSchema,
  repairActions: z.array(repairActionSchema),
  diagnostics: looseObjectSchema,
});

export type IssueRecord = z.infer<typeof issueRecordSchema>;
