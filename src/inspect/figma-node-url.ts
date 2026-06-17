import { FigmaInspectError } from "./errors.js";
import type { FigmaNodeRef } from "./types.js";

const supportedFilePathKinds = new Set(["design", "file"]);

function normalizeNodeId(nodeId: string): string {
  return nodeId.includes(":") ? nodeId : nodeId.replace(/-/g, ":");
}

export function parseFigmaNodeUrl(rawUrl: string): FigmaNodeRef {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FigmaInspectError(`Invalid Figma URL: ${rawUrl}`);
  }

  if (url.hostname !== "figma.com" && url.hostname !== "www.figma.com") {
    throw new FigmaInspectError(`Invalid Figma URL host: ${url.hostname}`);
  }

  const [, pathKind, fileKey] = url.pathname.split("/");
  if (!supportedFilePathKinds.has(pathKind) || !fileKey) {
    throw new FigmaInspectError(
      "Figma URL must use /design/<fileKey>/... or /file/<fileKey>/...",
    );
  }

  const rawNodeId = url.searchParams.get("node-id");
  if (!rawNodeId) {
    throw new FigmaInspectError("Figma URL is missing node-id.");
  }

  return {
    fileKey,
    nodeId: normalizeNodeId(rawNodeId),
  };
}
