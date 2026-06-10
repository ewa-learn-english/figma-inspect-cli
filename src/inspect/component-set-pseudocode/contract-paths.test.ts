import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveContractLockPath } from "../contract/contract-lock.js";
import {
  resolveGeometryContractPath,
  resolveMetaContractPath,
  resolveStructureDslPath,
  resolveVisualsContractPath,
} from "./build-pseudocode.js";

const directory = "/contracts/out";

describe("contract artifact paths", () => {
  it("resolves yaml artifact paths under the output directory", () => {
    expect(resolveMetaContractPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.contract.meta.yaml"),
    );
    expect(resolveGeometryContractPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.contract.geometry.yaml"),
    );
    expect(resolveVisualsContractPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.contract.visuals.yaml"),
    );
    expect(resolveStructureDslPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.contract.structure.dsl"),
    );
    expect(resolveContractLockPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.contract.lock.yaml"),
    );
  });

  it("honors json format for data artifacts only", () => {
    expect(resolveMetaContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.contract.meta.json"),
    );
    expect(resolveGeometryContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.contract.geometry.json"),
    );
    expect(resolveVisualsContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.contract.visuals.json"),
    );
    expect(resolveStructureDslPath(directory, "Cell")).toBe(
      path.join(directory, "Cell.contract.structure.dsl"),
    );
  });
});
