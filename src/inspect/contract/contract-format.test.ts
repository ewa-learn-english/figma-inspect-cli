import { describe, expect, it } from "vitest";
import {
  contractArtifactFileName,
  serializeContractData,
} from "./contract-format.js";

describe("contractArtifactFileName", () => {
  it("uses yaml extensions by default", () => {
    expect(contractArtifactFileName("TextInput", "meta")).toBe(
      "TextInput.contract.meta.yaml",
    );
    expect(contractArtifactFileName("TextInput", "geometry")).toBe(
      "TextInput.contract.geometry.yaml",
    );
    expect(contractArtifactFileName("TextInput", "visuals")).toBe(
      "TextInput.contract.visuals.yaml",
    );
  });

  it("uses json extensions when requested", () => {
    expect(contractArtifactFileName("Cell", "meta", "json")).toBe(
      "Cell.contract.meta.json",
    );
  });
});

describe("serializeContractData", () => {
  it("serializes yaml mappings", () => {
    const output = serializeContractData({ version: 1, ok: true }, "yaml");
    expect(output).toContain("version: 1");
    expect(output).toContain("ok: true");
  });

  it("serializes json with trailing newline", () => {
    expect(serializeContractData({ a: 1 }, "json")).toBe('{\n  "a": 1\n}\n');
  });
});
