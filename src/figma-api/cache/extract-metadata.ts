import type { FetchedResponse } from "./types.js";

export function extractVersionMetadata(
  body: unknown,
): Pick<FetchedResponse, "version" | "lastModified"> {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const record = body as Record<string, unknown>;

  return {
    version:
      record.version === undefined || record.version === null
        ? undefined
        : String(record.version),
    lastModified:
      typeof record.lastModified === "string" ? record.lastModified : undefined,
  };
}
