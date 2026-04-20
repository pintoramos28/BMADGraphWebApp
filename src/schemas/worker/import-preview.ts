import { z } from 'zod';

import { importPreviewDatasetSchema, importSourceKindSchema } from '../../features/import/preview-model';
import { nonEmptyStringSchema, strictObject, positiveIntegerSchema } from '../validation';
import { workerMessageEnvelopeSchema } from './message-envelope';

const arrayBufferSchema = z.custom<ArrayBuffer>(
  (value) => value instanceof ArrayBuffer,
  'Expected an ArrayBuffer payload for workbook import.',
);

export const importPreviewRequestPayloadSchema = strictObject({
  sourceKind: importSourceKindSchema,
  sourceLabel: nonEmptyStringSchema,
  fileName: nonEmptyStringSchema.optional(),
  mimeType: nonEmptyStringSchema.nullable().optional(),
  textContent: nonEmptyStringSchema.nullable().optional(),
  binaryContent: arrayBufferSchema.nullable().optional(),
});

export const importPreviewProgressPayloadSchema = strictObject({
  phase: z.enum(['loading', 'parsing', 'normalizing']),
  message: nonEmptyStringSchema,
});

export const importPreviewSuccessPayloadSchema = strictObject({
  preview: importPreviewDatasetSchema,
});

export const importPreviewFailurePayloadSchema = strictObject({
  code: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  detail: nonEmptyStringSchema,
  retryable: z.boolean(),
});

export const importPreviewRequestMessageSchema = workerMessageEnvelopeSchema.extend({
  workspaceVersion: positiveIntegerSchema,
  type: z.literal('import.preview.request'),
  payload: importPreviewRequestPayloadSchema,
});

export const importPreviewProgressMessageSchema = workerMessageEnvelopeSchema.extend({
  workspaceVersion: positiveIntegerSchema,
  type: z.literal('import.preview.progress'),
  payload: importPreviewProgressPayloadSchema,
});

export const importPreviewSuccessMessageSchema = workerMessageEnvelopeSchema.extend({
  workspaceVersion: positiveIntegerSchema,
  type: z.literal('import.preview.success'),
  payload: importPreviewSuccessPayloadSchema,
});

export const importPreviewFailureMessageSchema = workerMessageEnvelopeSchema.extend({
  workspaceVersion: positiveIntegerSchema,
  type: z.literal('import.preview.failure'),
  payload: importPreviewFailurePayloadSchema,
});

export type ImportPreviewRequestMessage = z.infer<typeof importPreviewRequestMessageSchema>;
export type ImportPreviewProgressMessage = z.infer<typeof importPreviewProgressMessageSchema>;
export type ImportPreviewSuccessMessage = z.infer<typeof importPreviewSuccessMessageSchema>;
export type ImportPreviewFailureMessage = z.infer<typeof importPreviewFailureMessageSchema>;
