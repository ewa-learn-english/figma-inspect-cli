import { describe, expect, it } from "vitest";
import { isNode, isRef, isVar, nodeKey } from "./slim-node-guards.js";

describe("slim-node-guards", () => {
  it("detects ref, var, and node shapes", () => {
    expect(isRef({ $ref: "sharedFrame" })).toBe(true);
    expect(isRef({ $ref: 1 })).toBe(false);
    expect(isVar({ $var: "gap" })).toBe(true);
    expect(isNode({ type: "frame", name: "Root" })).toBe(true);
    expect(isNode({ name: "Root" })).toBe(false);
  });

  it("derives stable node keys", () => {
    expect(nodeKey({ type: "frame", name: "Field name" }, { root: true })).toBe(
      "root",
    );
    expect(nodeKey({ type: "text", name: "Field name" })).toBe("fieldName");
    expect(nodeKey({ type: "instance", prop: "icon" })).toBe("icon");
    expect(
      nodeKey({
        type: "instance",
        component: { name: "SearchIcon" },
      }),
    ).toBe("searchIcon");
    expect(nodeKey({ type: "vector" })).toBe("vector");
  });
});
