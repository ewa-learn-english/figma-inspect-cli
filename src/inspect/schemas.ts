import { z } from "zod";
import { getFileNode } from "../figma-api/get-file-node.js";
import type { GetFileNodeOptions } from "../figma-api/types.js";
import { parseValidRecord } from "../zod/parse-valid-entries.js";
import { FigmaInspectError } from "./errors.js";

const figmaComponentSetFieldsSchema = z.object({
  key: z.string(),
  name: z.string(),
});

export type FigmaComponentSet = z.infer<
  typeof figmaComponentSetFieldsSchema
> & {
  id: string;
};

function parseComponentSets(value: unknown): Record<string, FigmaComponentSet> {
  const entries = parseValidRecord(figmaComponentSetFieldsSchema, value);
  const componentSets: Record<string, FigmaComponentSet> = {};

  for (const [id, fields] of Object.entries(entries)) {
    componentSets[id] = { id, ...fields };
  }

  return componentSets;
}

const componentEntrySchema = z.object({
  key: z.string().optional(),
  name: z.string().optional(),
  componentSetId: z.string().optional(),
});

export type ComponentEntry = z.infer<typeof componentEntrySchema>;

export interface DocumentNode {
  id?: string;
  name?: string;
  type?: string;
  componentId?: string;
  isExposedInstance: boolean;
  children?: DocumentNode[];
}

const documentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      componentId: z.string().optional(),
      isExposedInstance: z.unknown().transform((value) => value === true),
      children: z.array(z.unknown()).optional(),
    })
    .transform((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      componentId: node.componentId,
      isExposedInstance: node.isExposedInstance,
      children: node.children
        ?.map((child) => documentNodeSchema.safeParse(child))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : [])),
    })),
);

const fileNodeEntrySchema = z.object({
  document: documentNodeSchema.optional(),
  componentSets: z.unknown().transform(parseComponentSets),
  components: z
    .unknown()
    .transform((value) => parseValidRecord(componentEntrySchema, value)),
});

export type FileNodeEntry = z.infer<typeof fileNodeEntrySchema>;

const fileNodesResponseSchema = z.object({
  nodes: z.record(z.string(), z.unknown()),
});

function parseFileNodeEntry(payload: unknown, nodeId: string): FileNodeEntry {
  const response = fileNodesResponseSchema.safeParse(payload);
  if (!response.success) {
    throw new FigmaInspectError("Invalid Figma file nodes response.");
  }

  const nodeEntry = response.data.nodes[nodeId];
  if (typeof nodeEntry !== "object" || nodeEntry === null) {
    throw new FigmaInspectError(`Node ${nodeId} not found in Figma response.`);
  }

  const parsed = fileNodeEntrySchema.safeParse(nodeEntry);
  if (!parsed.success) {
    throw new FigmaInspectError("Invalid Figma file nodes response.");
  }

  return parsed.data;
}

export async function fetchFileNodeEntry(
  options: GetFileNodeOptions,
): Promise<FileNodeEntry> {
  const payload = await getFileNode(options);
  return parseFileNodeEntry(payload, options.nodeId);
}
