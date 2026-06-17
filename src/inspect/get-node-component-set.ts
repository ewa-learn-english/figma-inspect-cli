import {
  loadComponentSetContext,
  loadComponentSetContextByNodeRef,
} from "./component-set-context.js";
import type { DocumentNode } from "./schemas.js";
import type {
  ComponentSetNodeRefOptions,
  ComponentSetScopeOptions,
} from "./types.js";

export async function getNodeComponentSet(
  options: ComponentSetScopeOptions,
): Promise<DocumentNode> {
  const { tree } = await loadComponentSetContext(options);
  return tree;
}

export async function getNodeComponentSetByRef(
  options: ComponentSetNodeRefOptions,
): Promise<DocumentNode> {
  const { tree } = await loadComponentSetContextByNodeRef(options);
  return tree;
}
