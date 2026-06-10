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
        "--file-key",
        "fk",
        "--node-id",
        "1:2",
        "--json",
      ]),
    ).toEqual({
      kind: "inspect-file-node",
      fileKey: "fk",
      nodeId: "1:2",
      format: "json",
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
      contractFormat: "yaml",
      outputFormat: "yaml",
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
      expect(command.contractFormat).toBe("yaml");
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

  it("rejects missing required flags", () => {
    expect(() => parseCommand(["--verify-component-contract"])).toThrow(
      CliError,
    );
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
      parseCommand([
        "--inspect-component-set",
        "--file-key",
        "fk",
        "--node-id",
        "1:2",
      ]),
    ).toThrow(/component-set-key or --component-set-name/);
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
  });
});
