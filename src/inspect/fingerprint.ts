import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable-stringify.js";

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprintTree(tree: Record<string, unknown>): string {
  return sha256Hex(stableStringify(tree));
}

export function fingerprintContracts(
  visuals: Record<string, unknown>,
  geometry: Record<string, unknown>,
  meta: unknown,
  structureDsl: string,
): string {
  return sha256Hex(
    stableStringify({
      visuals,
      geometry,
      meta,
      structureDsl,
    }),
  );
}

export function variantAssetSlug(
  when: Record<string, string>,
  variantAxes: Record<string, string[]>,
): string {
  const orderedAxes = Object.keys(variantAxes).sort((left, right) => {
    if (left === "Size") {
      return 1;
    }
    if (right === "Size") {
      return -1;
    }
    return left.localeCompare(right);
  });
  const parts = orderedAxes
    .map((axis) => when[axis])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return parts.join("-");
}

export async function fingerprintAssetFiles(
  assetsDir: string,
  slugs: string[],
): Promise<Record<string, string>> {
  const fingerprints: Record<string, string> = {};

  for (const slug of slugs.sort()) {
    const absolutePath = path.join(assetsDir, `${slug}.svg`);
    const bytes = await readFile(absolutePath);
    fingerprints[slug] = sha256Hex(bytes);
  }

  return fingerprints;
}
