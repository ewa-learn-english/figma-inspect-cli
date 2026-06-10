import { describe, expect, it } from "vitest";
import { stableStringify } from "./stable-stringify.js";

describe("stableStringify", () => {
  it("sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("stringifies nested structures deterministically", () => {
    const value = { z: [3, { y: 1, x: 2 }] };
    expect(stableStringify(value)).toBe(stableStringify(value));
  });
});
