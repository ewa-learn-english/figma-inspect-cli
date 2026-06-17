import { access, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import type { ContractFormat } from "../contract/contract-format.js";
import { FigmaInspectError } from "../errors.js";
import {
  nodeContractArtifactFileName,
  resolveNodeGeometryContractPath,
  resolveNodeMetaContractPath,
  resolveNodeStructureDslPath,
  resolveNodeVisualsContractPath,
} from "./paths.js";
import type { NodeContractKind, NodeContractMeta } from "./types.js";

const dependencySchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  fileKey: z.string().min(1).optional(),
  componentSetId: z.string().min(1).optional(),
  componentSetName: z.string().min(1).optional(),
  componentSetKey: z.string().min(1).optional(),
});

const metaContractSchema: z.ZodType<NodeContractMeta> = z.object({
  version: z.literal(1),
  kind: z.enum(["component", "frame"]),
  node: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["COMPONENT", "FRAME"]),
  }),
  componentProperties: z
    .record(
      z.string(),
      z.object({
        type: z.string().min(1).optional(),
        default: z.union([z.boolean(), z.string()]).optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  dependencies: z.object({
    componentSets: z.array(dependencySchema),
    components: z.array(dependencySchema),
  }),
});

const contractTreeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.unknown()),
      contractTreeSchema,
    ]),
  ),
);

export interface NodeContractArtifacts {
  nodeName: string;
  kind: NodeContractKind;
  meta: NodeContractMeta;
  geometry: Record<string, unknown>;
  visuals: Record<string, unknown>;
  structureDsl: string;
}

function formatSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${pathLabel}: ${issue.message}`;
  });
}

function parseRecord(
  raw: string,
  label: string,
  format: ContractFormat,
): Record<string, unknown> {
  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new FigmaInspectError(`Invalid JSON in ${label}.`);
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new FigmaInspectError(`${label} must be a JSON object.`);
    }

    return parsed as Record<string, unknown>;
  }

  const parsed = parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new FigmaInspectError(`${label} must be a YAML mapping.`);
  }

  return parsed as Record<string, unknown>;
}

function validateRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new FigmaInspectError(
      `Invalid ${label}:\n${formatSchemaIssues(result.error).join("\n")}`,
    );
  }

  return result.data;
}

function validateStructureDsl(options: {
  structureDsl: string;
  nodeName: string;
  kind: NodeContractKind;
  format: ContractFormat;
}): void {
  const header = options.structureDsl.split("\n")[0]?.trim();
  const expectedHeader = `node ${options.kind} ${JSON.stringify(options.nodeName)}`;
  if (header !== expectedHeader) {
    throw new FigmaInspectError(
      `Invalid node structure DSL: expected first line ${JSON.stringify(expectedHeader)}.`,
    );
  }

  const requiredSnippets = [
    "contracts {",
    nodeContractArtifactFileName(
      options.nodeName,
      options.kind,
      "visuals",
      options.format,
    ),
    nodeContractArtifactFileName(
      options.nodeName,
      options.kind,
      "geometry",
      options.format,
    ),
    nodeContractArtifactFileName(
      options.nodeName,
      options.kind,
      "meta",
      options.format,
    ),
    "resolve {",
    "tree {",
  ];

  for (const snippet of requiredSnippets) {
    if (!options.structureDsl.includes(snippet)) {
      throw new FigmaInspectError(
        `Invalid node structure DSL: missing ${JSON.stringify(snippet)}.`,
      );
    }
  }
}

export async function detectNodeContractFormat(
  contractDir: string,
  nodeName: string,
  kind: NodeContractKind,
): Promise<ContractFormat> {
  try {
    await access(
      resolveNodeMetaContractPath(contractDir, nodeName, kind, "json"),
    );
    return "json";
  } catch {
    return "yaml";
  }
}

export async function readNodeContractArtifacts(
  contractDir: string,
  nodeName: string,
  kind: NodeContractKind,
  format: ContractFormat = "yaml",
): Promise<NodeContractArtifacts> {
  const [metaRaw, geometryRaw, visualsRaw, structureDsl] = await Promise.all([
    readFile(
      resolveNodeMetaContractPath(contractDir, nodeName, kind, format),
      "utf8",
    ),
    readFile(
      resolveNodeGeometryContractPath(contractDir, nodeName, kind, format),
      "utf8",
    ),
    readFile(
      resolveNodeVisualsContractPath(contractDir, nodeName, kind, format),
      "utf8",
    ),
    readFile(resolveNodeStructureDslPath(contractDir, nodeName, kind), "utf8"),
  ]);

  const meta = validateRecord(
    metaContractSchema,
    parseRecord(metaRaw, "node meta contract", format),
    "node meta contract",
  );
  const geometry = validateRecord(
    contractTreeSchema,
    parseRecord(geometryRaw, "node geometry contract", format),
    "node geometry contract",
  );
  const visuals = validateRecord(
    contractTreeSchema,
    parseRecord(visualsRaw, "node visuals contract", format),
    "node visuals contract",
  );
  validateStructureDsl({ structureDsl, nodeName, kind, format });

  return {
    nodeName,
    kind,
    meta,
    geometry,
    visuals,
    structureDsl,
  };
}

export function validateNodeContractArtifacts(
  artifacts: NodeContractArtifacts,
  format: ContractFormat = "yaml",
): void {
  validateRecord(metaContractSchema, artifacts.meta, "node meta contract");
  validateRecord(
    contractTreeSchema,
    artifacts.geometry,
    "node geometry contract",
  );
  validateRecord(
    contractTreeSchema,
    artifacts.visuals,
    "node visuals contract",
  );
  validateStructureDsl({
    structureDsl: artifacts.structureDsl,
    nodeName: artifacts.nodeName,
    kind: artifacts.kind,
    format,
  });
}
