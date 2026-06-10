import { readChildren, readString } from "../component-set-spec/figma-node.js";
import { parseComponentSetProps } from "../component-set-spec/parse-props.js";
import { FigmaInspectError } from "../errors.js";

function variantTreesContainTextNodes(
  componentSet: Record<string, unknown>,
): boolean {
  for (const variant of readChildren(componentSet)) {
    if (readString(variant, "type") !== "COMPONENT") {
      continue;
    }

    if (treeContainsTextNode(variant)) {
      return true;
    }
  }

  return false;
}

function treeContainsTextNode(node: Record<string, unknown>): boolean {
  if (readString(node, "type") === "TEXT") {
    return true;
  }

  for (const child of readChildren(node)) {
    if (treeContainsTextNode(child)) {
      return true;
    }
  }

  return false;
}

export function assertComponentSetSupportsAssetExport(
  componentSet: Record<string, unknown>,
): void {
  const { props } = parseComponentSetProps(componentSet);
  const nonVariantProps = Object.entries(props).filter(
    ([, definition]) => definition.type !== "variant",
  );

  if (nonVariantProps.length > 0) {
    const summary = nonVariantProps
      .map(([name, definition]) => `${name} (${definition.type})`)
      .join(", ");
    throw new FigmaInspectError(
      `Component set is not asset-exportable: ${summary}. --export-assets supports component sets with variant props only.`,
    );
  }

  if (variantTreesContainTextNodes(componentSet)) {
    throw new FigmaInspectError(
      "Component set is not asset-exportable: variant trees contain TEXT nodes. Render labels in app code instead of baking them into exported SVG assets.",
    );
  }
}

export function assertExportedSvgBytes(
  bytes: Uint8Array,
  context: string,
): void {
  const text = new TextDecoder().decode(bytes).trimStart();
  if (!text.startsWith("<svg")) {
    throw new FigmaInspectError(`Exported asset for ${context} is not SVG.`);
  }
}
