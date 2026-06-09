import type { z } from "zod";

export function parseValidEntries<T extends z.ZodType>(
  schema: T,
  entries: readonly unknown[],
): z.infer<T>[] {
  return entries.flatMap((entry) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseValidRecord<T extends z.ZodType>(
  schema: T,
  value: unknown,
): Record<string, z.infer<T>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, z.infer<T>> = {};
  for (const [id, entry] of Object.entries(value)) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      result[id] = parsed.data;
    }
  }

  return result;
}
