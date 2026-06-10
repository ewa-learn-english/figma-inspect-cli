import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readComponentContractArtifacts } from "./contract-schema.js";

const contractDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tmp",
);

describe("readComponentContractArtifacts", () => {
  it("loads and validates TextInput contract files from tmp", async () => {
    const artifacts = await readComponentContractArtifacts(
      contractDir,
      "TextInput",
      "yaml",
    );
    expect(artifacts.componentName).toBe("TextInput");
    expect(artifacts.meta.version).toBe(1);
    expect(artifacts.structureDsl).toContain("component TextInput");
    expect(artifacts.visuals).toBeTypeOf("object");
  });
});
