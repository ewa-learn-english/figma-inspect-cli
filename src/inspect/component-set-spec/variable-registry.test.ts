import { describe, expect, it } from "vitest";
import { VariableRegistry } from "./variable-registry.js";

describe("VariableRegistry", () => {
  it("resolves aliases by id and by key prefix", () => {
    const registry = VariableRegistry.fromExport({
      variables: {
        spacing: {
          id: "VariableID:var-spacing",
          key: "spacing-md",
          name: "spacing/md",
        },
      },
    });

    expect(registry.resolve("VariableID:var-spacing")).toBe("spacing/md");
    expect(registry.resolve("spacing-md/extra")).toBe("spacing/md");
  });

  it("returns undefined for unknown aliases", () => {
    const registry = VariableRegistry.fromExport({ variables: {} });
    expect(registry.resolve("missing")).toBeUndefined();
  });
});
