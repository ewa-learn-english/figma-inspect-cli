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
      path.join(directory, "TextInput.component-set.meta.yaml"),
    );
    expect(resolveGeometryContractPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.component-set.geometry.yaml"),
    );
    expect(resolveVisualsContractPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.component-set.visuals.yaml"),
    );
    expect(resolveStructureDslPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.component-set.structure.dsl"),
    );
    expect(resolveContractLockPath(directory, "TextInput")).toBe(
      path.join(directory, "TextInput.component-set.lock.yaml"),
    );
  });

  it("honors json format for data artifacts only", () => {
    expect(resolveMetaContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.component-set.meta.json"),
    );
    expect(resolveGeometryContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.component-set.geometry.json"),
    );
    expect(resolveVisualsContractPath(directory, "Cell", "json")).toBe(
      path.join(directory, "Cell.component-set.visuals.json"),
    );
    expect(resolveStructureDslPath(directory, "Cell")).toBe(
      path.join(directory, "Cell.component-set.structure.dsl"),
    );
  });
});
