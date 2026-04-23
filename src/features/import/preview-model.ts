import { z } from 'zod';

import { issueRecordSchema } from '../../schemas/workspace/issue-record';
import {
  identifierSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  strictObject,
} from '../../schemas/validation';

export const importSourceKindSchema = z.enum(['csv-file', 'excel-file', 'pasted-table']);
export type ImportSourceKind = z.infer<typeof importSourceKindSchema>;

export const importBenchmarkScenarioSchema = z.enum([
  'import.clean.csv-preview',
  'import.clean.excel-preview',
  'import.clean.paste-preview',
  'import.dirty.delimiter-repair',
  'import.dirty.header-repair',
  'import.dirty.type-repair',
  'import.dirty.missing-value-repair',
]);
export type ImportBenchmarkScenario = z.infer<typeof importBenchmarkScenarioSchema>;

export const importAssumptionCategorySchema = z.enum(['delimiter', 'header', 'numeric', 'date', 'uncertainty']);
export type ImportAssumptionCategory = z.infer<typeof importAssumptionCategorySchema>;

export const importConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type ImportConfidence = z.infer<typeof importConfidenceSchema>;

export const importColumnTypeSchema = z.enum(['text', 'numeric', 'date', 'mixed', 'empty']);
export type ImportColumnType = z.infer<typeof importColumnTypeSchema>;

export const importRepairDelimiterSchema = z.enum([',', '\t', ';', '|']);
export type ImportRepairDelimiter = z.infer<typeof importRepairDelimiterSchema>;

export const importHeaderSelectionSchema = z.enum(['first-row-header', 'first-row-data']);
export type ImportHeaderSelection = z.infer<typeof importHeaderSelectionSchema>;

export const importConfirmedColumnTypeSchema = z.enum(['text', 'numeric', 'date']);
export type ImportConfirmedColumnType = z.infer<typeof importConfirmedColumnTypeSchema>;

export const importMissingValuePolicySchema = z.enum(['mark-empty', 'drop-invalid-rows']);
export type ImportMissingValuePolicy = z.infer<typeof importMissingValuePolicySchema>;

export const importRepairSelectionsSchema = strictObject({
  delimiter: importRepairDelimiterSchema.nullable(),
  headerSelection: importHeaderSelectionSchema.nullable(),
  columnTypeOverrides: z.record(identifierSchema, importConfirmedColumnTypeSchema),
  missingValuePolicy: importMissingValuePolicySchema.nullable(),
  additionalColumnsAcknowledgement: identifierSchema.nullable().optional(),
});
export type ImportRepairSelections = z.infer<typeof importRepairSelectionsSchema>;

export function createDefaultImportRepairSelections(): ImportRepairSelections {
  return {
    delimiter: null,
    headerSelection: null,
    columnTypeOverrides: {},
    missingValuePolicy: null,
    additionalColumnsAcknowledgement: null,
  };
}

export const importPreviewSourceSchema = strictObject({
  sourceKind: importSourceKindSchema,
  sourceLabel: nonEmptyStringSchema,
  fileName: nonEmptyStringSchema.optional(),
  mimeType: nonEmptyStringSchema.nullable(),
  sheetName: nonEmptyStringSchema.nullable(),
  benchmarkScenario: importBenchmarkScenarioSchema.nullable(),
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

export const importConfirmedDatasetColumnSchema = strictObject({
  columnId: identifierSchema,
  sourceName: nonEmptyStringSchema,
  dataType: z.enum(['string', 'number', 'date']),
});
export type ImportConfirmedDatasetColumn = z.infer<typeof importConfirmedDatasetColumnSchema>;

export const importConfirmedDatasetRowSchema = z.record(identifierSchema, z.string());
export type ImportConfirmedDatasetRow = z.infer<typeof importConfirmedDatasetRowSchema>;

export const importConfirmedDatasetSchema = strictObject({
  rowCount: nonNegativeIntegerSchema,
  columnCount: nonNegativeIntegerSchema,
  fingerprint: nonEmptyStringSchema,
  columns: z.array(importConfirmedDatasetColumnSchema),
  rows: z.array(importConfirmedDatasetRowSchema),
});
export type ImportConfirmedDataset = z.infer<typeof importConfirmedDatasetSchema>;

export const importPreviewDatasetSchema = strictObject({
  previewId: identifierSchema,
  source: importPreviewSourceSchema,
  rowCount: nonNegativeIntegerSchema,
  isPartialPreview: z.boolean(),
  columnCount: nonNegativeIntegerSchema,
  columns: z.array(importPreviewColumnSchema),
  sampleRows: z.array(importPreviewRowSchema),
  assumptions: z.array(importPreviewAssumptionSchema),
  uncertainties: z.array(importPreviewUncertaintySchema),
  issues: z.array(issueRecordSchema),
  repairSelections: importRepairSelectionsSchema,
  confirmedDataset: importConfirmedDatasetSchema.optional(),
  timing: importPreviewTimingSchema,
});
export type ImportPreviewDataset = z.infer<typeof importPreviewDatasetSchema>;

export function hasMaterializedConfirmedDataset(
  preview: ImportPreviewDataset,
): preview is ImportPreviewDataset & {
  confirmedDataset: NonNullable<ImportPreviewDataset['confirmedDataset']>;
} {
  return preview.confirmedDataset !== undefined;
}
