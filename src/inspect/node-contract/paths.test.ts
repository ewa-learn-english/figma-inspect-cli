import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveNodeContractLockPath,
  resolveNodeGeometryContractPath,
  resolveNodeMetaContractPath,
  resolveNodeStructureDslPath,
  resolveNodeVisualsContractPath,
} from "./paths.js";

const directory = "/contracts/out";

describe("node contract paths", () => {
  it("uses node kind in artifact namespaces", () => {
    expect(resolveNodeMetaContractPath(directory, "Settings", "frame")).toBe(
      path.join(directory, "Settings.frame.meta.yaml"),
    );
    expect(
      resolveNodeGeometryContractPath(directory, "Settings", "frame"),
    ).toBe(path.join(directory, "Settings.frame.geometry.yaml"));
    expect(resolveNodeVisualsContractPath(directory, "Settings", "frame")).toBe(
      path.join(directory, "Settings.frame.visuals.yaml"),
    );
    expect(resolveNodeStructureDslPath(directory, "Settings", "frame")).toBe(
      path.join(directory, "Settings.frame.structure.dsl"),
    );
    expect(resolveNodeContractLockPath(directory, "Settings", "frame")).toBe(
      path.join(directory, "Settings.frame.lock.yaml"),
    );
  });

  it("honors json format for node data artifacts only", () => {
    expect(
      resolveNodeMetaContractPath(directory, "Icon", "component", "json"),
    ).toBe(path.join(directory, "Icon.component.meta.json"));
    expect(resolveNodeStructureDslPath(directory, "Icon", "component")).toBe(
      path.join(directory, "Icon.component.structure.dsl"),
    );
  });
});
