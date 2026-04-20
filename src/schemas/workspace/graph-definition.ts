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

export const graphFamilySchema = z.enum(['scatter', 'line', 'bar', 'histogram', 'boxplot']);
export const graphTemplateIdSchema = z.enum([
  'tpl_scatter_regression',
  'tpl_line_trend',
  'tpl_bar_grouped_compare',
  'tpl_histogram_distribution',
  'tpl_boxplot_by_category',
]);
export const graphCatalogOverlayIdSchema = z.enum([
  'regression_linear',
  'reference_line',
  'threshold_band',
]);

export const graphOverlaySchema = strictObject({
  overlayId: identifierSchema,
  kind: dottedTypeSchema.or(nonEmptyStringSchema),
  method: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  catalogOverlayId: graphCatalogOverlayIdSchema.optional(),
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
  family: graphFamilySchema.optional(),
  templateId: z.union([graphTemplateIdSchema, z.null()]).optional(),
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
export type GraphFamily = z.infer<typeof graphFamilySchema>;
export type GraphTemplateId = z.infer<typeof graphTemplateIdSchema>;
export type GraphPresentation = z.infer<typeof graphPresentationSchema>;
export type GraphOverlay = z.infer<typeof graphOverlaySchema>;
export type GraphCatalogOverlayId = z.infer<typeof graphCatalogOverlayIdSchema>;

export const graphDefinitionMetaSchema = looseObjectSchema;
