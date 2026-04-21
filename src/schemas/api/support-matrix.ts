import { z } from 'zod';

import {
  dateVersionSchema,
  isoDateTimeSchema,
  nonEmptyStringSchema,
  positiveIntegerSchema,
  semverSchema,
  strictObject,
  versionRangeSchema,
} from '../validation/index.ts';

export const supportedBrowserFamilySchema = z.enum(['chrome', 'edge', 'firefox', 'safari']);

export const browserSupportSchema = strictObject({
  family: supportedBrowserFamilySchema,
  supportLevel: z.enum(['supported', 'secondary', 'unsupported']),
  minimumMajorVersion: positiveIntegerSchema.optional(),
  desktopOnly: z.literal(true),
  notes: nonEmptyStringSchema.optional(),
});

export const supportMatrixSchema = strictObject({
  version: dateVersionSchema,
  publishedAt: isoDateTimeSchema,
  standardZoom: nonEmptyStringSchema,
  supportedBrowsers: z.array(browserSupportSchema).min(1),
  workspaceCompatibility: strictObject({
    minimumReadableFormat: semverSchema,
    maximumReadableFormat: versionRangeSchema,
  }),
});

export type SupportedBrowserFamily = z.infer<typeof supportedBrowserFamilySchema>;
export type BrowserSupport = z.infer<typeof browserSupportSchema>;
export type SupportMatrix = z.infer<typeof supportMatrixSchema>;
