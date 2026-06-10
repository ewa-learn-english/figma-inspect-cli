import type { ComponentSetSpec } from "../component-set-spec/types.js";
import type { AssetContractMap } from "./assets-contract.js";
import { hasAssetContractMap } from "./assets-contract.js";
import { extractGeometryFromNode } from "./universal.js";

function setNestedValue(
  root: Record<string, unknown>,
  axes: string[],
  when: Record<string, string>,
  value: Record<string, unknown>,
): void {
  if (axes.length === 0) {
    return;
  }

  const [axis, ...rest] = axes;
  const axisValue = when[axis ?? ""];
  if (!axisValue) {
    return;
  }

  if (rest.length === 0) {
    root[axisValue] = value;
    return;
  }

  const current = root[axisValue];
  if (
    typeof current !== "object" ||
    current === null ||
    Array.isArray(current)
  ) {
    root[axisValue] = {};
  }

  setNestedValue(root[axisValue] as Record<string, unknown>, rest, when, value);
}

function buildAssetBackedRootBundle(
  spec: ComponentSetSpec,
): Record<string, unknown> {
  const axes = Object.keys(spec.variantAxes);
  const root: Record<string, unknown> = {};

  for (const variant of spec.variants) {
    const geometry = extractGeometryFromNode(
      variant.layout as unknown as Record<string, unknown>,
    );
    if (Object.keys(geometry).length === 0) {
      continue;
    }

    setNestedValue(root, axes, variant.when, { root: geometry });
  }

  return root;
}

export function buildAssetBackedVisuals(
  spec: ComponentSetSpec,
): Record<string, unknown> {
  return buildAssetBackedRootBundle(spec);
}

export function buildAssetBackedGeometry(
  spec: ComponentSetSpec,
): Record<string, unknown> {
  return buildAssetBackedRootBundle(spec);
}

export function hasAssetMapAssets(
  assets: AssetContractMap | undefined,
): boolean {
  return hasAssetContractMap(assets);
}
