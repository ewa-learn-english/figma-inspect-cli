import { getFileNode } from "../figma-api/get-file-node.js";
import type { GetFileNodeOptions } from "../figma-api/types.js";
import { type FileNodeEntry, parseFileNodeEntry } from "./schemas.js";

export async function fetchFileNodeEntry(
  options: GetFileNodeOptions,
): Promise<FileNodeEntry> {
  const payload = await getFileNode(options);
  return parseFileNodeEntry(payload, options.nodeId);
}
