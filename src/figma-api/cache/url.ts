import { createHash } from "node:crypto";

export function normalizeRequestUrl(url: string | URL): string {
  const parsed = new URL(url.toString());
  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.toString();
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function extractFileKey(url: string): string | undefined {
  const match = new URL(url).pathname.match(/^\/v1\/files\/([^/]+)(?:\/|$)/);
  return match?.[1];
}

export function buildFileProbeUrl(fileKey: string): string {
  const url = new URL(
    `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}`,
  );
  url.searchParams.set("depth", "1");
  return url.toString();
}
