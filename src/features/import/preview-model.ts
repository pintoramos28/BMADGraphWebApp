import { z } from 'zod';

import {
  identifierSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  strictObject,
} from '../../schemas/validation';

export const importSourceKindSchema = z.enum(['csv-file', 'excel-file', 'pasted-table']);
export type ImportSourceKind = z.infer<typeof importSourceKindSchema>;

export const importAssumptionCategorySchema = z.enum(['delimiter', 'header', 'numeric', 'date', 'uncertainty']);
export type ImportAssumptionCategory = z.infer<typeof importAssumptionCategorySchema>;

export const importConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type ImportConfidence = z.infer<typeof importConfidenceSchema>;

export const importColumnTypeSchema = z.enum(['text', 'numeric', 'date', 'mixed', 'empty']);
export type ImportColumnType = z.infer<typeof importColumnTypeSchema>;

export const importPreviewSourceSchema = strictObject({
  sourceKind: importSourceKindSchema,
  sourceLabel: nonEmptyStringSchema,
  fileName: nonEmptyStringSchema.optional(),
  mimeType: nonEmptyStringSchema.nullable(),
  sheetName: nonEmptyStringSchema.nullable(),
  benchmarkScenario: z.enum([
    'import.clean.csv-preview',
    'import.clean.excel-preview',
    'import.clean.paste-preview',
  ]),
});
export type ImportPreviewSource = z.infer<typeof importPreviewSourceSchema>;

export const importPreviewColumnSchema = strictObject({
  columnId: identifierSchema,
  sourceName: nonEmptyStringSchema,
  sampleValues: z.array(z.string()),
  inferredType: importColumnTypeSchema,
  confidence: importConfidenceSchema,
  nonEmptyCount: nonNegativeIntegerSchema,
  nullCount: nonNegativeIntegerSchema,
});
export type ImportPreviewColumn = z.infer<typeof importPreviewColumnSchema>;

export const importPreviewCellSchema = strictObject({
  columnId: identifierSchema,
  value: z.string(),
});
export type ImportPreviewCell = z.infer<typeof importPreviewCellSchema>;

export const importPreviewRowSchema = strictObject({
  rowId: identifierSchema,
  cells: z.array(importPreviewCellSchema),
});
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;

export const importPreviewAssumptionSchema = strictObject({
  assumptionId: identifierSchema,
  category: importAssumptionCategorySchema,
  label: nonEmptyStringSchema,
  value: nonEmptyStringSchema,
  confidence: importConfidenceSchema,
  details: nonEmptyStringSchema.optional(),
});
export type ImportPreviewAssumption = z.infer<typeof importPreviewAssumptionSchema>;

export const importPreviewUncertaintySchema = strictObject({
  uncertaintyId: identifierSchema,
  category: importAssumptionCategorySchema,
  severity: z.enum(['low', 'medium', 'high']),
  message: nonEmptyStringSchema,
  columnId: identifierSchema.optional(),
});
export type ImportPreviewUncertainty = z.infer<typeof importPreviewUncertaintySchema>;

export const importPreviewTimingSchema = strictObject({
  durationMs: nonNegativeIntegerSchema,
  budgetMs: nonNegativeIntegerSchema,
  exceededBudget: z.boolean(),
});
export type ImportPreviewTiming = z.infer<typeof importPreviewTimingSchema>;

export const importPreviewDatasetSchema = strictObject({
  previewId: identifierSchema,
  source: importPreviewSourceSchema,
  rowCount: nonNegativeIntegerSchema,
  columnCount: nonNegativeIntegerSchema,
  columns: z.array(importPreviewColumnSchema),
  sampleRows: z.array(importPreviewRowSchema),
  assumptions: z.array(importPreviewAssumptionSchema),
  uncertainties: z.array(importPreviewUncertaintySchema),
  timing: importPreviewTimingSchema,
});
export type ImportPreviewDataset = z.infer<typeof importPreviewDatasetSchema>;
