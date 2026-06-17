import { describe, expect, it } from "vitest";
import { CliError } from "./errors.js";
import { parseCommand } from "./parse-args.js";

describe("parseCommand", () => {
  it("parses help", () => {
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["-h"])).toEqual({ kind: "help" });
  });

  it("parses list commands with optional json output", () => {
    expect(parseCommand(["--list-team-projects"])).toEqual({
      kind: "list-team-projects",
      format: "yaml",
    });
    expect(parseCommand(["--list-team-project-files", "--json"])).toEqual({
      kind: "list-team-project-files",
      format: "json",
    });
    expect(parseCommand(["--list-team-component-sets"])).toEqual({
      kind: "list-team-component-sets",
      format: "yaml",
    });
    expect(
      parseCommand(["--list-project-files", "--project-id", "123"]),
    ).toEqual({
      kind: "list-project-files",
      projectId: "123",
      format: "yaml",
    });
    expect(parseCommand(["--list-file-pages", "--file-key", "abc"])).toEqual({
      kind: "list-file-pages",
      fileKey: "abc",
      format: "yaml",
    });
    expect(
      parseCommand([
        "--list-file-component-sets",
        "--file-key",
        "abc",
        "--json",
      ]),
    ).toEqual({
      kind: "list-file-component-sets",
      fileKey: "abc",
      format: "json",
    });
  });

  it("parses component-set scoped inspect commands", () => {
    const scope = {
      kind: "lookup" as const,
      fileKey: "fk",
      nodeId: "1:2",
      componentSet: { kind: "key" as const, value: "set-key" },
    };

    expect(
      parseCommand([
        "--inspect-component-set-properties",
        "--file-key",
        "fk",
        "--node-id",
        "1:2",
        "--component-set-key",
        "set-key",
      ]),
    ).toEqual({
      kind: "inspect-component-set-properties",
      scope,
      format: "yaml",
    });

    expect(
      parseCommand([
        "--inspect-component-set",
        "--file-key",
        "fk",
        "--node-id",
        "1:2",
        "--component-set-name",
        "Button",
      ]),
    ).toEqual({
      kind: "inspect-component-set",
      scope: {
        kind: "lookup",
        fileKey: "fk",
        nodeId: "1:2",
        componentSet: { kind: "name", value: "Button" },
      },
      format: "yaml",
    });

    expect(
      parseCommand([
        "--inspect-team-component-set",
        "--component-set-name",
        "Button",
      ]),
    ).toEqual({
      kind: "inspect-team-component-set",
      componentSet: { kind: "name", value: "Button" },
      format: "yaml",
    });

    expect(
      parseCommand([
        "--inspect-file-node",
        "--url",
        "https://www.figma.com/design/fk/File?node-id=1-2",
        "--json",
      ]),
    ).toEqual({
      kind: "inspect-file-node",
      fileKey: "fk",
      nodeId: "1:2",
      sourceUrl: "https://www.figma.com/design/fk/File?node-id=1-2",
      format: "json",
    });
  });

  it("parses component-set scoped commands from a Figma URL", () => {
    expect(
      parseCommand([
        "--inspect-component-set",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=213-695&m=dev",
      ]),
    ).toEqual({
      kind: "inspect-component-set",
      scope: {
        kind: "node",
        fileKey: "fileKey",
        nodeId: "213:695",
      },
      format: "yaml",
    });

    expect(
      parseCommand([
        "--inspect-component-set-properties",
        "--url",
        "https://www.figma.com/file/fileKey/Settings?node-id=213%3A695",
      ]),
    ).toEqual({
      kind: "inspect-component-set-properties",
      scope: {
        kind: "node",
        fileKey: "fileKey",
        nodeId: "213:695",
      },
      format: "yaml",
    });
  });

  it("parses local build commands", () => {
    expect(
      parseCommand([
        "--build-component-set-spec",
        "--input",
        "in.json",
        "--variables",
        "vars.json",
        "--team-components",
        "team.json",
      ]),
    ).toEqual({
      kind: "build-component-set-spec",
      inputPath: "in.json",
      variablesPath: "vars.json",
      teamComponentsPath: "team.json",
      format: "yaml",
    });

    expect(
      parseCommand([
        "--build-component-set-pseudocode",
        "--input",
        "in.json",
        "--variables",
        "vars.json",
        "--output",
        "out-dir",
      ]),
    ).toEqual({
      kind: "build-component-set-pseudocode",
      inputPath: "in.json",
      variablesPath: "vars.json",
      outputDir: "out-dir",
      teamComponentsPath: undefined,
      format: "yaml",
    });
  });

  it("parses verify-component-contract with contract dir", () => {
    expect(
      parseCommand([
        "--verify-component-contract",
        "--contract-dir",
        "tmp",
        "--component-name",
        "Cell",
      ]),
    ).toEqual({
      kind: "verify-component-contract",
      contractDir: "tmp",
      componentName: "Cell",
      outputFormat: "yaml",
    });
  });

  it("parses verify-node-contract with contract dir", () => {
    expect(
      parseCommand([
        "--verify-node-contract",
        "--contract-dir",
        "tmp",
        "--node-name",
        "Settings",
        "--json",
      ]),
    ).toEqual({
      kind: "verify-node-contract",
      contractDir: "tmp",
      nodeName: "Settings",
      outputFormat: "json",
    });
  });

  it("uses json only for verify stdout format", () => {
    const command = parseCommand([
      "--verify-component-contract",
      "--contract-dir",
      "tmp",
      "--json",
    ]);
    expect(command.kind).toBe("verify-component-contract");
    if (command.kind === "verify-component-contract") {
      expect(command.outputFormat).toBe("json");
    }
  });

  it("parses export-component-set with asset flags", () => {
    expect(
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--component-set-key",
        "set-key",
        "--export-assets",
        "--asset-format",
        "svg",
        "--json",
      ]),
    ).toEqual({
      kind: "export-component-set",
      outputDir: "out",
      componentSet: { kind: "key", value: "set-key" },
      variablesPath: "vars.json",
      exportAssets: true,
      assetFormat: "svg",
      format: "json",
    });
  });

  it("parses export-component-set by Figma URL", () => {
    expect(
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=213-695&m=dev",
      ]),
    ).toEqual({
      kind: "export-component-set",
      outputDir: "out",
      componentSet: {
        kind: "node",
        fileKey: "fileKey",
        nodeId: "213:695",
      },
      sourceUrl:
        "https://www.figma.com/design/fileKey/Settings?node-id=213-695&m=dev",
      variablesPath: "vars.json",
      exportAssets: false,
      assetFormat: undefined,
      format: "yaml",
    });
  });

  it("parses export-node-contract by Figma URL", () => {
    const sourceUrl =
      "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev";

    expect(
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        sourceUrl,
      ]),
    ).toEqual({
      kind: "export-node-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      format: "yaml",
    });
  });

  it("parses export-node-contract by file key and node id", () => {
    expect(
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "900:1",
        "--json",
      ]),
    ).toEqual({
      kind: "export-node-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "900:1",
      sourceUrl: undefined,
      variablesPath: "vars.json",
      format: "json",
    });
  });

  it("rejects missing required flags", () => {
    expect(() => parseCommand(["--verify-component-contract"])).toThrow(
      CliError,
    );
    expect(() => parseCommand(["--verify-node-contract"])).toThrow(CliError);
    expect(() => parseCommand(["--list-project-files"])).toThrow(CliError);
    expect(() => parseCommand(["--list-file-pages"])).toThrow(
      /Missing --file-key/,
    );
    expect(() =>
      parseCommand(["--build-component-set-spec", "--input", "in.json"]),
    ).toThrow(/Missing --variables/);
    expect(() =>
      parseCommand(["--build-component-set-pseudocode", "--input", "in.json"]),
    ).toThrow(/Missing --variables/);
    expect(() =>
      parseCommand(["--export-component-set", "--output-dir", "out"]),
    ).toThrow(CliError);
    expect(() =>
      parseCommand(["--export-node-contract", "--output-dir", "out"]),
    ).toThrow(CliError);
    expect(() =>
      parseCommand([
        "--inspect-component-set",
        "--file-key",
        "fk",
        "--node-id",
        "1:2",
      ]),
    ).toThrow(/component-set-key or --component-set-name/);
    expect(() =>
      parseCommand(["--inspect-file-node", "--url", "not-a-url"]),
    ).toThrow(/Invalid Figma URL/);
  });

  it("rejects invalid flag combinations", () => {
    expect(() => parseCommand([])).toThrow(/Nothing to do/);
    expect(() =>
      parseCommand([
        "--list-team-projects",
        "--list-file-pages",
        "--file-key",
        "abc",
      ]),
    ).toThrow(/only one command/);
    expect(() => parseCommand(["--unknown-flag"])).toThrow(/Unknown option/);
    expect(() => parseCommand(["--project-id"])).toThrow(
      /Missing value for --project-id/,
    );
    expect(() =>
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--component-set-key",
        "a",
        "--component-set-name",
        "b",
      ]),
    ).toThrow(/either --component-set-key or --component-set-name/);
    expect(() =>
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--component-set-key",
        "a",
        "--asset-format",
        "png",
      ]),
    ).toThrow(/Unsupported --asset-format/);
    expect(() =>
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=213-695&m=dev",
        "--component-set-name",
        "Settings",
      ]),
    ).toThrow(/Pass either --url or --component-set-key/);
    expect(() =>
      parseCommand([
        "--inspect-file-node",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=213-695&m=dev",
        "--file-key",
        "fileKey",
      ]),
    ).toThrow(/Pass either --url or --file-key\/--node-id/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev",
        "--node-id",
        "208:43935",
      ]),
    ).toThrow(/Pass either --url or --file-key\/--node-id/);
  });
});
