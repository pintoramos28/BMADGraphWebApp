import { z } from 'zod';

import { graphDefinitionSchema } from './graph-definition';
import { issueRecordSchema } from './issue-record';
import {
  dateVersionSchema,
  identifierSchema,
  isoDateTimeSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  semverSchema,
  strictObject,
  stringArraySchema,
  versionRangeSchema,
} from '../validation';

export const datasetColumnSchema = strictObject({
  columnId: identifierSchema,
  sourceName: nonEmptyStringSchema,
  dataType: z.enum(['string', 'number', 'integer', 'boolean', 'date', 'datetime']),
  semanticRole: nonEmptyStringSchema,
  unit: z.string().nullable(),
  status: z.enum(['inferred', 'confirmed', 'rejected']),
});

export const datasetSourceFileSchema = strictObject({
  fileName: nonEmptyStringSchema,
  fileHandleToken: identifierSchema,
});

export const datasetSchema = strictObject({
  datasetId: identifierSchema,
  displayName: nonEmptyStringSchema,
  sourceKind: nonEmptyStringSchema,
  fingerprint: nonEmptyStringSchema,
  rowCount: nonNegativeIntegerSchema,
  columnCount: nonNegativeIntegerSchema,
  columns: z.array(datasetColumnSchema),
  sourceFile: datasetSourceFileSchema.optional(),
});

export const transformSchema = strictObject({
  transformId: identifierSchema,
  kind: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  order: nonNegativeIntegerSchema,
  expression: nonEmptyStringSchema,
  dependencyMetadata: strictObject({
    datasetId: identifierSchema,
    dependsOnColumnIds: z.array(identifierSchema),
    producesColumnIds: z.array(identifierSchema),
    upstreamTransformIds: z.array(identifierSchema),
  }).optional(),
});

export const formulaColumnSchema = strictObject({
  formulaId: identifierSchema,
  columnId: identifierSchema,
  label: nonEmptyStringSchema,
  expression: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  dependsOn: stringArraySchema,
});

export const evidenceSchema = strictObject({
  evidenceId: identifierSchema,
  graphId: identifierSchema,
  note: nonEmptyStringSchema,
  provenanceRefs: stringArraySchema,
  status: nonEmptyStringSchema,
});

export const readinessSchema = strictObject({
  status: z.enum(['ready', 'warning', 'blocked']),
  blockingIssueIds: z.array(identifierSchema),
  warningIssueIds: z.array(identifierSchema),
  provenanceCompleteness: z.enum(['none', 'partial', 'complete']),
});

export const telemetrySnapshotSchema = strictObject({
  lastGraphRenderMs: nonNegativeIntegerSchema,
  offlineQueueDepth: nonNegativeIntegerSchema,
  status: z.enum(['idle', 'queued', 'flushed']),
});

export const exportSummarySchema = strictObject({
  lastExportedAt: z.union([isoDateTimeSchema, z.null()]),
  includedReferenceGraphId: identifierSchema,
  manifestVersion: semverSchema,
});

export const workspaceSnapshotSchema = strictObject({
  workspaceId: identifierSchema,
  workspaceFormatVersion: semverSchema,
  appBuildVersion: semverSchema,
  schemaVersion: dateVersionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  compatibility: strictObject({
    minReadableAppBuild: semverSchema,
    maxTestedAppBuild: versionRangeSchema,
  }),
  datasets: z.array(datasetSchema),
  transformPipeline: z.array(transformSchema),
  formulaColumns: z.array(formulaColumnSchema),
  graphDefinitions: z.array(graphDefinitionSchema).min(1),
  activeGraphId: identifierSchema,
  referenceGraphId: identifierSchema,
  evidence: z.array(evidenceSchema),
  issues: z.array(issueRecordSchema),
  readiness: readinessSchema,
  telemetrySnapshot: telemetrySnapshotSchema,
  exportSummary: exportSummarySchema,
}).superRefine((snapshot, ctx) => {
  const graphIds = new Set(snapshot.graphDefinitions.map((graph) => graph.graphId));

  if (!graphIds.has(snapshot.activeGraphId)) {
    ctx.addIssue({
      code: 'custom',
      message: 'activeGraphId must reference a graphDefinitions entry.',
      path: ['activeGraphId'],
    });
  }

  if (!graphIds.has(snapshot.referenceGraphId)) {
    ctx.addIssue({
      code: 'custom',
      message: 'referenceGraphId must reference a graphDefinitions entry.',
      path: ['referenceGraphId'],
    });
  }
});

export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
