import { describe, expect, it } from "vitest";
import { extractInstanceSlots, instanceSlotKey } from "./extract-slots.js";
import { TeamComponentRegistry } from "./team-component-registry.js";

describe("instanceSlotKey", () => {
  it("maps Icon instances to the icon slot", () => {
    expect(instanceSlotKey("CloseIcon")).toBe("icon");
  });

  it("lowercases the first character of other names", () => {
    expect(instanceSlotKey("Trailing")).toBe("trailing");
  });
});

describe("extractInstanceSlots", () => {
  it("reads swap values from componentProperties first", () => {
    expect(
      extractInstanceSlots(
        {
          componentProperties: {
            CloseIcon: { value: "DismissIcon" },
          },
        },
        undefined,
      ),
    ).toEqual({ icon: "DismissIcon" });
  });

  it("collects nested instance names when properties are absent", () => {
    expect(
      extractInstanceSlots(
        {
          type: "INSTANCE",
          name: "Button",
          children: [
            {
              type: "INSTANCE",
              name: "LeadingIcon",
              componentId: "1:2",
            },
          ],
        },
        undefined,
      ),
    ).toEqual({ icon: "LeadingIcon" });
  });

  it("stops at known team components instead of walking their children", () => {
    const registry = TeamComponentRegistry.fromEntries([
      {
        id: "1:99",
        key: "avatar-key",
        name: "Avatar",
        fileKey: "file-key",
        projectId: "project-id",
      },
    ]);

    expect(
      extractInstanceSlots(
        {
          type: "INSTANCE",
          name: "Card",
          children: [
            {
              type: "INSTANCE",
              name: "Avatar",
              componentId: "1:99",
              children: [
                {
                  type: "INSTANCE",
                  name: "BadgeIcon",
                  componentId: "1:100",
                },
              ],
            },
          ],
        },
        registry,
      ),
    ).toEqual({ avatar: "Avatar" });
  });
});
