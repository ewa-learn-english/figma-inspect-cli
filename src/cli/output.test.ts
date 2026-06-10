import { describe, expect, it } from "vitest";
import {
  writeComponentSetProperties,
  writeComponentSets,
  writeData,
  writeFiles,
  writePages,
  writeProjects,
  writeTeamComponentSets,
  writeTeamProjectFiles,
} from "./output.js";

function captureStdout(): { stdout: NodeJS.WriteStream; output: () => string } {
  let text = "";
  const stdout = {
    write(chunk: string | Uint8Array): boolean {
      text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return true;
    },
  } as NodeJS.WriteStream;

  return {
    stdout,
    output: () => text,
  };
}

describe("writeData", () => {
  it("writes yaml by default", () => {
    const { stdout, output } = captureStdout();
    writeData({ ok: true }, "yaml", stdout);
    expect(output()).toContain("ok: true");
  });

  it("writes json with trailing newline", () => {
    const { stdout, output } = captureStdout();
    writeData({ a: 1 }, "json", stdout);
    expect(output()).toBe('{\n  "a": 1\n}\n');
  });
});

describe("write list helpers", () => {
  it("serializes projects, files, pages, and component sets", () => {
    const { stdout, output } = captureStdout();

    writeProjects([{ id: "1", name: "Alpha" }], "yaml", stdout);
    expect(output()).toContain("name: Alpha");

    writeFiles(
      [{ key: "fk", name: "Design", last_modified: "2026-01-01" }],
      "json",
      stdout,
    );
    expect(output()).toContain('"key": "fk"');

    writeTeamProjectFiles(
      [
        {
          key: "fk",
          name: "Design",
          project_id: "p1",
          last_modified: "2026-01-01",
        },
      ],
      "yaml",
      stdout,
    );
    expect(output()).toContain("project_id: p1");

    writePages([{ id: "0:1", name: "Page 1" }], "yaml", stdout);
    expect(output()).toContain("Page 1");

    writeComponentSets(
      [{ id: "1:2", key: "k", name: "Button" }],
      "yaml",
      stdout,
    );
    expect(output()).toContain("Button");

    writeTeamComponentSets(
      [
        {
          id: "1:2",
          key: "k",
          name: "Button",
          fileKey: "fk",
          projectId: "p1",
        },
      ],
      "yaml",
      stdout,
    );
    expect(output()).toContain("fileKey: fk");

    writeComponentSetProperties(
      [
        {
          property: "State",
          type: "VARIANT",
          defaultValue: "Default",
          variantOptions: ["Default"],
        },
      ],
      "yaml",
      stdout,
    );
    expect(output()).toContain("property: State");
  });
});
