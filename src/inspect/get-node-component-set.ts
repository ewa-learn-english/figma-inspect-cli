import { loadComponentSetContext } from "./component-set-context.js";
import type { DocumentNode } from "./schemas.js";
import type { ComponentSetScopeOptions } from "./types.js";

export async function getNodeComponentSet(
  options: ComponentSetScopeOptions,
): Promise<DocumentNode> {
  const { tree } = await loadComponentSetContext(options);
  return tree;
}
