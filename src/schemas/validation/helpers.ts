import type { z } from 'zod';

export function parseContract<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

export function validateContract<T>(schema: z.ZodType<T>, input: unknown) {
  return schema.safeParse(input);
}

export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
}
