import { z } from 'zod';

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const dateVersionPattern = /^\d{4}-\d{2}-\d{2}$/;
const versionRangePattern = /^\d+(?:\.\d+)?\.x$/;
const sha256Pattern = /^sha256:[A-Fa-f0-9]{64}$/;
const dottedTypePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;

export const nonEmptyStringSchema = z.string().trim().min(1);
export const identifierSchema = nonEmptyStringSchema.regex(/^[A-Za-z0-9._:-]+$/);
export const isoDateTimeSchema = nonEmptyStringSchema.refine(
  (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value)),
  'Expected an ISO-8601 UTC timestamp.',
);
export const semverSchema = nonEmptyStringSchema.regex(semverPattern, 'Expected a semantic version like 1.0.0.');
export const versionRangeSchema = nonEmptyStringSchema.regex(versionRangePattern, 'Expected a version range like 1.x.');
export const dateVersionSchema = nonEmptyStringSchema.regex(dateVersionPattern, 'Expected a YYYY-MM-DD contract version.');
export const sha256TokenSchema = nonEmptyStringSchema.regex(sha256Pattern, 'Expected a sha256 token.');
export const dottedTypeSchema = nonEmptyStringSchema.regex(
  dottedTypePattern,
  'Expected a dotted lowercase contract type such as graph.render.completed.',
);
export const positiveIntegerSchema = z.number().int().positive();
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const literalFalseSchema = z.literal(false);
export const stringArraySchema = z.array(nonEmptyStringSchema);
export const primitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const looseObjectSchema = z.record(z.string(), z.unknown());

export function strictObject<const T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}
