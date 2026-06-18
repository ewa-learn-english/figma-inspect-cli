import { getFile } from "../figma-api/get-file.js";
import type { GetFileOptions } from "../figma-api/types.js";
import { type FileNodeEntry, parseFileEntry } from "./schemas.js";

export async function fetchFileEntry(
  options: GetFileOptions,
): Promise<FileNodeEntry> {
  const payload = await getFile(options);
  return parseFileEntry(payload);
}
