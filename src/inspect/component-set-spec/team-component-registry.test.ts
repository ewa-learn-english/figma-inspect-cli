import { describe, expect, it } from "vitest";
import { TeamComponentRegistry } from "./team-component-registry.js";

const avatarEntry = {
  id: "1:99",
  key: "avatar-key",
  name: "Avatar",
  fileKey: "file-key",
  projectId: "project-id",
};

describe("TeamComponentRegistry", () => {
  it("matches known components by published name or component id", () => {
    const registry = TeamComponentRegistry.fromEntries([avatarEntry]);

    expect(registry.isKnownComponent("Avatar")).toBe(true);
    expect(registry.isKnownComponent(undefined, "1:99")).toBe(true);
    expect(registry.isKnownComponent("Unknown")).toBe(false);
  });

  it("finds entries by id, key, and name", () => {
    const registry = TeamComponentRegistry.fromEntries([avatarEntry]);

    expect(registry.findById("1:99")).toEqual(avatarEntry);
    expect(registry.findByKey("avatar-key")).toEqual(avatarEntry);
    expect(registry.findByName("Avatar")).toEqual(avatarEntry);
  });
});
