import { readFile } from "node:fs/promises";
import { FigmaInspectError } from "../errors.js";
import { isRecord, readRecord, readString } from "./figma-node.js";

export class VariableRegistry {
  private readonly byKey = new Map<string, string>();
  private readonly byId = new Map<string, string>();

  resolve(alias: string): string | undefined {
    const normalized = alias.replace(/^VariableID:/, "");

    const byId = this.byId.get(normalized);
    if (byId) {
      return byId;
    }

    const key = normalized.split("/")[0];
    if (key) {
      return this.byKey.get(key);
    }

    return undefined;
  }

  static fromExport(payload: Record<string, unknown>): VariableRegistry {
    const registry = new VariableRegistry();
    const variables = readVariablesRecord(payload);

    for (const variable of Object.values(variables)) {
      if (!isRecord(variable)) {
        continue;
      }

      const name = readString(variable, "name");
      if (!name) {
        continue;
      }

      const id = readString(variable, "id");
      if (id) {
        registry.byId.set(id.replace(/^VariableID:/, ""), name);
      }

      const key = readString(variable, "key");
      if (key) {
        registry.byKey.set(key, name);
      }
    }

    return registry;
  }
}

function readVariablesRecord(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const meta = readRecord(payload, "meta");
  const fromMeta = meta ? readRecord(meta, "variables") : undefined;
  if (fromMeta) {
    return fromMeta;
  }

  return readRecord(payload, "variables") ?? {};
}

export async function loadVariableRegistry(
  variablesPath: string,
): Promise<VariableRegistry> {
  let rawText: string;
  try {
    rawText = await readFile(variablesPath, "utf8");
  } catch {
    throw new FigmaInspectError(`Cannot read variables file: ${variablesPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new FigmaInspectError(
      `Invalid JSON in variables file: ${variablesPath}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new FigmaInspectError("Variables JSON must be an object.");
  }

  const variables = readVariablesRecord(parsed);
  if (Object.keys(variables).length === 0) {
    throw new FigmaInspectError(
      "Variables JSON does not contain a variables map.",
    );
  }

  return VariableRegistry.fromExport(parsed);
}
