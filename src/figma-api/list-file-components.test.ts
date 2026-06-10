import { describe, expect, it } from "vitest";
import { filterFileComponentsForComponentSet } from "./list-file-components.js";
import type { FigmaFileComponent } from "./schemas.js";

function component(
  overrides: Partial<FigmaFileComponent> & Pick<FigmaFileComponent, "name">,
): FigmaFileComponent {
  return {
    key: "key",
    file_key: "file-key",
    node_id: "1:1",
    updated_at: "2024-01-01T00:00:00Z",
    containing_component_set_node_id: undefined,
    ...overrides,
  };
}

describe("filterFileComponentsForComponentSet", () => {
  it("keeps variants for the requested component set and sorts by name", () => {
    const components = [
      component({
        name: "State=Hover",
        containing_component_set_node_id: "1:2",
      }),
      component({
        name: "State=Default",
        containing_component_set_node_id: "1:2",
      }),
      component({
        name: "Other",
        containing_component_set_node_id: "9:9",
      }),
    ];

    expect(filterFileComponentsForComponentSet(components, "1:2")).toEqual([
      component({
        name: "State=Default",
        containing_component_set_node_id: "1:2",
      }),
      component({
        name: "State=Hover",
        containing_component_set_node_id: "1:2",
      }),
    ]);
  });
});
