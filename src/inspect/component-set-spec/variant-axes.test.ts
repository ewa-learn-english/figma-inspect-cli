import { describe, expect, it } from "vitest";
import { collectVariantAxes } from "./variant-axes.js";

describe("collectVariantAxes", () => {
  it("collects sorted unique axis values", () => {
    expect(
      collectVariantAxes([
        { State: "Default", Size: "M" },
        { State: "Hover", Size: "M" },
        { State: "Default", Size: "L" },
      ]),
    ).toEqual({
      Size: ["L", "M"],
      State: ["Default", "Hover"],
    });
  });
});
