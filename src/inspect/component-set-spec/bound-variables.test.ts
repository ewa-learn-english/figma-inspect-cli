import { describe, expect, it } from "vitest";
import {
  readBoundVariable,
  readBoundVariableAt,
  readCornerRadiusUniformVariable,
  readCornerRadiusVariable,
} from "./bound-variables.js";

function variableAlias(id: string) {
  return { type: "VARIABLE_ALIAS", id: `VariableID:${id}` };
}

describe("readBoundVariable", () => {
  it("returns the variable id without the VariableID prefix", () => {
    expect(
      readBoundVariable({ paddingTop: variableAlias("pad-top") }, "paddingTop"),
    ).toBe("pad-top");
  });
});

describe("readBoundVariableAt", () => {
  it("reads indexed bindings from array fields", () => {
    expect(
      readBoundVariableAt(
        { fills: [variableAlias("fill-primary")] },
        "fills",
        0,
      ),
    ).toBe("fill-primary");
  });
});

describe("readCornerRadiusVariable", () => {
  it("reads per-corner radius variable bindings", () => {
    expect(
      readCornerRadiusVariable(
        {
          rectangleCornerRadii: {
            RECTANGLE_TOP_LEFT_CORNER_RADIUS: variableAlias("radius-sm"),
          },
        },
        "topLeft",
      ),
    ).toBe("radius-sm");
  });
});

describe("readCornerRadiusUniformVariable", () => {
  it("falls back through corners until one is bound", () => {
    expect(
      readCornerRadiusUniformVariable({
        rectangleCornerRadii: {
          RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: variableAlias("radius-md"),
        },
      }),
    ).toBe("radius-md");
  });
});
