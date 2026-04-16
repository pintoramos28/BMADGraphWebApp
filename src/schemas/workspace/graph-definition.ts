import { z } from 'zod';

import {
  dottedTypeSchema,
  identifierSchema,
  looseObjectSchema,
  nonEmptyStringSchema,
  strictObject,
  stringArraySchema,
} from '../validation';

export const graphRoleAssignmentsSchema = strictObject({
  x: stringArraySchema,
  y: stringArraySchema,
  color: stringArraySchema,
  size: stringArraySchema,
  facetRow: stringArraySchema,
  facetColumn: stringArraySchema,
});

export const graphOverlaySchema = strictObject({
  overlayId: identifierSchema,
  kind: dottedTypeSchema.or(nonEmptyStringSchema),
  method: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
});

export const graphPresentationSchema = strictObject({
  xAxisLabel: nonEmptyStringSchema.optional(),
  yAxisLabel: nonEmptyStringSchema.optional(),
  legendPosition: nonEmptyStringSchema.optional(),
});

const forbiddenRendererArtifacts = ['renderer', 'vegaLiteSpec', 'vegaSpec', 'echartsOption', 'rendererSpec'];

export const graphDefinitionSchema = strictObject({
  graphId: identifierSchema,
  title: nonEmptyStringSchema,
  status: z.enum(['candidate', 'reference', 'stale', 'superseded']),
  datasetId: identifierSchema,
  roleAssignments: graphRoleAssignmentsSchema,
  marks: stringArraySchema.min(1),
  overlays: z.array(graphOverlaySchema),
  presentation: graphPresentationSchema,
  issueIds: z.array(identifierSchema),
  evidenceIds: z.array(identifierSchema),
}).superRefine((graph, ctx) => {
  for (const key of forbiddenRendererArtifacts) {
    if (Object.prototype.hasOwnProperty.call(graph, key)) {
      ctx.addIssue({
        code: 'custom',
        message: `Canonical graph definitions must not persist raw renderer artifacts such as "${key}".`,
        path: [key],
      });
    }
  }
});

export type GraphDefinition = z.infer<typeof graphDefinitionSchema>;
export type GraphPresentation = z.infer<typeof graphPresentationSchema>;
export type GraphOverlay = z.infer<typeof graphOverlaySchema>;

export const graphDefinitionMetaSchema = looseObjectSchema;
