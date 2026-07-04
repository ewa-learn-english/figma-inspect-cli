import { describe, expect, it } from "vitest";
import { CliError } from "./errors.js";
import { parseCommand } from "./parse-args.js";

describe("parseCommand", () => {
  it("parses help", () => {
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["-h"])).toEqual({ kind: "help" });
  });

  it("parses version", () => {
    expect(parseCommand(["--version"])).toEqual({ kind: "version" });
    expect(parseCommand(["-v"])).toEqual({ kind: "version" });
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
      parseCommand([
        "--list-component-set-usages",
        "--index-dir",
        "tmp/figma-index",
        "--component-set-name",
        "RatingsDivider",
        "--screen-group",
        "Leagues scroll",
        "--full",
        "--json",
      ]),
    ).toEqual({
      kind: "list-component-set-usages",
      indexDir: "tmp/figma-index",
      componentSet: { kind: "name", value: "RatingsDivider" },
      screenGroup: "Leagues scroll",
      full: true,
      format: "json",
    });
    expect(
      parseCommand([
        "--inspect-component-set-responsive-usage",
        "--index-dir",
        "tmp/figma-index",
        "--component-set-key",
        "set-key",
      ]),
    ).toEqual({
      kind: "inspect-component-set-responsive-usage",
      indexDir: "tmp/figma-index",
      componentSet: { kind: "key", value: "set-key" },
      screenGroup: undefined,
      format: "yaml",
    });
    expect(
      parseCommand(["--list-project-files", "--project-id", "123"]),
    ).toEqual({
      kind: "list-project-files",
      projectId: "123",
      format: "yaml",
    });
    expect(
      parseCommand([
        "--export-team-index",
        "--output-dir",
        "tmp/figma-index",
        "--screen-similarity-threshold",
        "0.92",
        "--screen-size-tolerance",
        "3",
      ]),
    ).toEqual({
      kind: "export-team-index",
      outputDir: "tmp/figma-index",
      screenSimilarityThreshold: 0.92,
      screenSizeTolerance: 3,
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

  it("parses verify-component-lock with lock file", () => {
    expect(
      parseCommand([
        "--verify-component-lock",
        "--lock-file",
        "tmp/Cell.component-set.lock.yaml",
        "--json",
      ]),
    ).toEqual({
      kind: "verify-component-lock",
      lockFile: "tmp/Cell.component-set.lock.yaml",
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

  it("parses export-contract by Figma URL", () => {
    const sourceUrl =
      "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev";

    expect(
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        sourceUrl,
        "--export-assets",
        "--asset-format",
        "svg",
      ]),
    ).toEqual({
      kind: "export-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      exportAssets: true,
      assetFormat: "svg",
      format: "yaml",
    });
  });

  it("parses export-contract preview options", () => {
    const sourceUrl =
      "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev";

    expect(
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        sourceUrl,
        "--export-preview",
      ]),
    ).toEqual({
      kind: "export-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      exportAssets: false,
      assetFormat: undefined,
      preview: { format: "png", scale: 2 },
      format: "yaml",
    });
  });

  it("parses export-contract nested asset options", () => {
    const sourceUrl =
      "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev";

    expect(
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        sourceUrl,
        "--export-nested-assets",
        "--asset-node-id",
        "401-2",
        "--asset-include-regex",
        "icon|logo",
        "--asset-node-types",
        "instance,vector",
        "--asset-max",
        "4",
        "--asset-format",
        "svg",
        "--asset-format",
        "png",
        "--asset-scale",
        "3",
      ]),
    ).toEqual({
      kind: "export-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      exportAssets: false,
      assetFormat: undefined,
      nestedAssets: {
        nodeIds: ["401:2"],
        includeRegex: "icon|logo",
        nodeTypes: ["INSTANCE", "VECTOR"],
        maxAssets: 4,
        formats: ["svg", "png"],
        scale: 3,
      },
      format: "yaml",
    });
  });

  it("parses export-contract by file key and node id", () => {
    expect(
      parseCommand([
        "--export-contract",
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
      kind: "export-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "900:1",
      sourceUrl: undefined,
      variablesPath: "vars.json",
      exportAssets: false,
      assetFormat: undefined,
      format: "json",
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

  it("parses export-node-contract SVG preview options", () => {
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
        "--export-preview",
        "--preview-format",
        "svg",
      ]),
    ).toEqual({
      kind: "export-node-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      preview: { format: "svg" },
      format: "yaml",
    });
  });

  it("parses export-node-contract nested asset defaults", () => {
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
        "--export-nested-assets",
        "--asset-node-id",
        "401-2",
      ]),
    ).toEqual({
      kind: "export-node-contract",
      outputDir: "out",
      fileKey: "fileKey",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      nestedAssets: {
        nodeIds: ["401:2"],
        formats: ["svg"],
        scale: 2,
      },
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
    expect(() => parseCommand(["--verify-component-lock"])).toThrow(CliError);
    expect(() => parseCommand(["--verify-node-contract"])).toThrow(CliError);
    expect(() => parseCommand(["--list-project-files"])).toThrow(CliError);
    expect(() => parseCommand(["--export-team-index"])).toThrow(
      /Missing --output-dir/,
    );
    expect(() =>
      parseCommand([
        "--export-team-index",
        "--output-dir",
        "tmp/figma-index",
        "--json",
      ]),
    ).toThrow(/not supported/);
    expect(() =>
      parseCommand([
        "--list-team-project-files",
        "--screen-similarity-threshold",
        "0.8",
      ]),
    ).toThrow(/require --export-team-index/);
    expect(() => parseCommand(["--list-component-set-usages"])).toThrow(
      /Missing --index-dir/,
    );
    expect(() =>
      parseCommand([
        "--inspect-component-set-responsive-usage",
        "--index-dir",
        "tmp/figma-index",
      ]),
    ).toThrow(/component-set-key or --component-set-name/);
    expect(() =>
      parseCommand([
        "--list-team-component-sets",
        "--index-dir",
        "tmp/figma-index",
      ]),
    ).toThrow(/require --list-component-set-usages/);
    expect(() =>
      parseCommand(["--list-team-component-sets", "--full"]),
    ).toThrow(/--full require --list-component-set-usages/);
    expect(() =>
      parseCommand([
        "--export-team-index",
        "--output-dir",
        "tmp/figma-index",
        "--screen-size-tolerance",
        "bad",
      ]),
    ).toThrow(/non-negative/);
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
      parseCommand(["--export-contract", "--output-dir", "out"]),
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
    ).toThrow(/requires --export-assets or --export-nested-assets/);
    expect(() =>
      parseCommand([
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--component-set-key",
        "a",
        "--export-assets",
        "--asset-format",
        "png",
      ]),
    ).toThrow(/--export-assets supports svg/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-assets",
      ]),
    ).toThrow(/Use --export-nested-assets/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-nested-assets",
      ]),
    ).toThrow(/requires --asset-node-id or --asset-include-regex/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--asset-node-id",
        "401:2",
      ]),
    ).toThrow(/require --export-nested-assets/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-nested-assets",
        "--asset-node-id",
        "401:2",
        "--asset-format",
        "pdf",
      ]),
    ).toThrow(/Unsupported --asset-format/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-nested-assets",
        "--asset-node-id",
        "401:2",
        "--asset-max",
        "0",
      ]),
    ).toThrow(/Invalid --asset-max/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-nested-assets",
        "--asset-node-id",
        "401:2",
        "--asset-node-types",
        "TEXT",
      ]),
    ).toThrow(/Unsupported --asset-node-types entry/);
    expect(() =>
      parseCommand([
        "--export-node-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-nested-assets",
        "--asset-node-id",
        "401:2",
        "--asset-scale",
        "3",
      ]),
    ).toThrow(/only supported with --asset-format png/);
    expect(() =>
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-preview",
        "--preview-format",
        "pdf",
      ]),
    ).toThrow(/Unsupported --preview-format/);
    expect(() =>
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-preview",
        "--preview-scale",
        "0",
      ]),
    ).toThrow(/Invalid --preview-scale/);
    expect(() =>
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--export-preview",
        "--preview-format",
        "svg",
        "--preview-scale",
        "2",
      ]),
    ).toThrow(/only supported with --preview-format png/);
    expect(() =>
      parseCommand([
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--file-key",
        "fileKey",
        "--node-id",
        "208:43935",
        "--preview-format",
        "png",
      ]),
    ).toThrow(/require --export-preview/);
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
        "--export-contract",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--url",
        "https://www.figma.com/design/fileKey/Settings?node-id=208-43935&m=dev",
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
