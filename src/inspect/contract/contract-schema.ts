import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { AssetContractMap } from "../component-set-pseudocode/assets-contract.js";
import {
  resolveMetaContractPath,
  resolveStructureDslPath,
} from "../component-set-pseudocode/build-pseudocode.js";
import { FigmaInspectError } from "../errors.js";
import {
  type ContractFormat,
  contractArtifactFileName,
} from "./contract-format.js";

const teamComponentEntrySchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  fileKey: z.string().min(1),
  projectId: z.string(),
});

const metaPropSchema = z.object({
  type: z.enum(["boolean", "instance", "text", "variant"]),
  default: z.union([z.boolean(), z.string()]).optional(),
  options: z.array(z.string()).optional(),
});

const metaSlotSchema = z.object({
  kind: z.enum(["swap", "nested"]),
  component: z.string().min(1),
});

const assetEntrySchema = z.object({
  path: z.string().min(1),
  format: z.literal("svg"),
});

const assetContractMapSchema: z.ZodType<AssetContractMap> = z.lazy(() =>
  z.record(z.string(), z.union([assetEntrySchema, assetContractMapSchema])),
);

const metaContractSchema = z.object({
  version: z.literal(1),
  component: teamComponentEntrySchema.optional(),
  props: z.record(z.string(), metaPropSchema).optional(),
  slots: z.record(z.string(), metaSlotSchema).optional(),
  dependencies: z.array(teamComponentEntrySchema).optional(),
  assets: assetContractMapSchema.optional(),
});

type MetaContractValidated = z.infer<typeof metaContractSchema>;

const variantTreeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), variantTreeSchema]),
  ),
);

const geometryContractSchema = variantTreeSchema;
const visualsContractSchema = variantTreeSchema;

export interface ComponentContractArtifacts {
  componentName: string;
  meta: MetaContractValidated;
  geometry: Record<string, unknown>;
  visuals: Record<string, unknown>;
  structureDsl: string;
  assetsDir?: string;
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

  return parseYamlRecord(raw, label);
}

function parseYamlRecord(raw: string, label: string): Record<string, unknown> {
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

function validateStructureDsl(
  structureDsl: string,
  componentName: string,
  format: ContractFormat,
): void {
  const lines = structureDsl.split("\n");
  const header = lines[0]?.trim();
  if (header !== `component ${componentName}`) {
    throw new FigmaInspectError(
      `Invalid structure DSL: expected first line "component ${componentName}".`,
    );
  }

  const requiredSnippets = [
    "contracts {",
    contractArtifactFileName(componentName, "visuals", format),
    contractArtifactFileName(componentName, "geometry", format),
    contractArtifactFileName(componentName, "meta", format),
    "resolve {",
    "templates {",
  ];

  for (const snippet of requiredSnippets) {
    if (!structureDsl.includes(snippet)) {
      throw new FigmaInspectError(
        `Invalid structure DSL: missing ${JSON.stringify(snippet)}.`,
      );
    }
  }

  if (structureDsl.includes(".component-set.assets.")) {
    throw new FigmaInspectError(
      "Invalid structure DSL: assets must live in meta.yaml, not a separate assets file.",
    );
  }
}

export async function readComponentContractArtifacts(
  contractDir: string,
  componentName: string,
  format: ContractFormat = "yaml",
): Promise<ComponentContractArtifacts> {
  const [metaRaw, geometryRaw, visualsRaw, structureDsl] = await Promise.all([
    readFile(
      resolveMetaContractPath(contractDir, componentName, format),
      "utf8",
    ),
    readFile(
      path.join(
        contractDir,
        contractArtifactFileName(componentName, "geometry", format),
      ),
      "utf8",
    ),
    readFile(
      path.join(
        contractDir,
        contractArtifactFileName(componentName, "visuals", format),
      ),
      "utf8",
    ),
    readFile(resolveStructureDslPath(contractDir, componentName), "utf8"),
  ]);

  const meta = validateRecord(
    metaContractSchema,
    parseRecord(metaRaw, "meta contract", format),
    "meta contract",
  );
  const geometry = validateRecord(
    geometryContractSchema,
    parseRecord(geometryRaw, "geometry contract", format),
    "geometry contract",
  );
  const visuals = validateRecord(
    visualsContractSchema,
    parseRecord(visualsRaw, "visuals contract", format),
    "visuals contract",
  );
  validateStructureDsl(structureDsl, componentName, format);

  const assetsDir = meta.assets
    ? path.join(contractDir, `${componentName}.assets`)
    : undefined;

  return {
    componentName,
    meta,
    geometry,
    visuals,
    structureDsl,
    assetsDir,
  };
}

export function validateComponentContractArtifacts(
  artifacts: ComponentContractArtifacts,
  format: ContractFormat = "yaml",
): void {
  validateRecord(metaContractSchema, artifacts.meta, "meta contract");
  validateRecord(
    geometryContractSchema,
    artifacts.geometry,
    "geometry contract",
  );
  validateRecord(visualsContractSchema, artifacts.visuals, "visuals contract");
  validateStructureDsl(artifacts.structureDsl, artifacts.componentName, format);
}
