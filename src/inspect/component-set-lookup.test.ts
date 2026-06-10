import { describe, expect, it } from "vitest";
import {
  indexComponentSetsByName,
  resolveComponentSetId,
} from "./component-set-lookup.js";
import { FigmaInspectError } from "./errors.js";
import type { FigmaComponentSet } from "./schemas.js";

const componentSets: Record<string, FigmaComponentSet> = {
  "1:10": { id: "1:10", key: "key-a", name: "Button" },
  "1:20": { id: "1:20", key: "key-b", name: "Cell" },
};

describe("indexComponentSetsByName", () => {
  it("maps unique component set names to node ids", () => {
    const index = indexComponentSetsByName(componentSets);
    expect(index.get("Button")).toBe("1:10");
    expect(index.get("Cell")).toBe("1:20");
  });

  it("throws when two component sets share a name", () => {
    const duplicateName: Record<string, FigmaComponentSet> = {
      "1:1": { id: "1:1", key: "k1", name: "Toast" },
      "1:2": { id: "1:2", key: "k2", name: "Toast" },
    };

    expect(() => indexComponentSetsByName(duplicateName)).toThrow(
      FigmaInspectError,
    );
    expect(() => indexComponentSetsByName(duplicateName)).toThrow(
      /Multiple component sets named "Toast"/,
    );
  });
});

describe("resolveComponentSetId", () => {
  it("resolves by published key", () => {
    expect(
      resolveComponentSetId(
        componentSets,
        { kind: "key", value: "key-b" },
        "0:1",
      ),
    ).toBe("1:20");
  });

  it("resolves by display name via name index", () => {
    expect(
      resolveComponentSetId(
        componentSets,
        { kind: "name", value: "Button" },
        "0:1",
      ),
    ).toBe("1:10");
  });

  it("throws when key is missing from the node", () => {
    expect(() =>
      resolveComponentSetId(
        componentSets,
        { kind: "key", value: "missing-key" },
        "99:1",
      ),
    ).toThrow(/No component set with key missing-key found in node 99:1/);
  });

  it("throws when name is missing from the node", () => {
    expect(() =>
      resolveComponentSetId(
        componentSets,
        { kind: "name", value: "Missing" },
        "99:1",
      ),
    ).toThrow(/No component set with name "Missing" found in node 99:1/);
  });

  it("throws when name lookup matches multiple component sets", () => {
    const duplicateName: Record<string, FigmaComponentSet> = {
      "1:1": { id: "1:1", key: "k1", name: "Toast" },
      "1:2": { id: "1:2", key: "k2", name: "Toast" },
    };

    expect(() =>
      resolveComponentSetId(
        duplicateName,
        { kind: "name", value: "Toast" },
        "0:1",
      ),
    ).toThrow(/Multiple component sets named "Toast"/);
  });
});
