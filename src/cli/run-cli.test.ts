import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FigmaApiError } from "../figma-api/figma-api-error.js";
import { FigmaInspectError } from "../inspect/errors.js";
import { CliError } from "./errors.js";

const mocks = vi.hoisted(() => ({
  listTeamProjects: vi.fn(),
  verifyComponentContracts: vi.fn(),
  buildComponentSetSpecFromFile: vi.fn(),
  buildComponentSetPseudocodeFromFile: vi.fn(),
  exportComponentSet: vi.fn(),
  listProjectFiles: vi.fn(),
}));

vi.mock("../figma-api/index.js", () => ({
  FigmaApiError,
  getFileNode: vi.fn(),
  listFileComponentSets: vi.fn(),
  listFilePages: vi.fn(),
  listProjectFiles: mocks.listProjectFiles,
  listTeamProjectFiles: vi.fn(),
  listTeamProjects: mocks.listTeamProjects,
}));

vi.mock("../inspect/index.js", () => ({
  FigmaInspectError,
  buildComponentSetPseudocodeFromFile:
    mocks.buildComponentSetPseudocodeFromFile,
  buildComponentSetSpecFromFile: mocks.buildComponentSetSpecFromFile,
  getNodeComponentSet: vi.fn(),
  listAllComponentSets: vi.fn(),
  listComponentSetProperties: vi.fn(),
  resolveGeometryContractPath: vi.fn(
    (directory: string, componentName: string, format: string) =>
      path.join(
        directory,
        `${componentName}.component-set.geometry.${format === "yaml" ? "yaml" : "json"}`,
      ),
  ),
  resolveMetaContractPath: vi.fn(
    (directory: string, componentName: string, format: string) =>
      path.join(
        directory,
        `${componentName}.component-set.meta.${format === "yaml" ? "yaml" : "json"}`,
      ),
  ),
  resolveStructureDslPath: vi.fn((directory: string, componentName: string) =>
    path.join(directory, `${componentName}.component-set.structure.dsl`),
  ),
  resolveTeamComponentSetScope: vi.fn(),
  resolveVisualsContractPath: vi.fn(
    (directory: string, componentName: string, format: string) =>
      path.join(
        directory,
        `${componentName}.component-set.visuals.${format === "yaml" ? "yaml" : "json"}`,
      ),
  ),
  verifyComponentContracts: mocks.verifyComponentContracts,
}));

vi.mock("./export-component-set.js", () => ({
  exportComponentSet: mocks.exportComponentSet,
  writeExportResult: vi.fn((_result, stdout: NodeJS.WriteStream) => {
    stdout.write("exported\n");
  }),
}));

import { runCli } from "./run-cli.js";
import { usage } from "./usage.js";

function createIo(env: NodeJS.ProcessEnv = {}): {
  io: {
    env: NodeJS.ProcessEnv;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
  };
  output: () => string;
} {
  let text = "";
  const stdout = {
    write(chunk: string | Uint8Array): boolean {
      text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return true;
    },
  } as NodeJS.WriteStream;

  return {
    io: {
      env: { FIGMA_API_TOKEN: "token", FIGMA_TEAM_ID: "team", ...env },
      stdout,
      stderr: stdout,
    },
    output: () => text,
  };
}

describe("runCli", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prints usage for help", async () => {
    const { io, output } = createIo();
    await runCli(["--help"], io);
    expect(output()).toBe(usage);
  });

  it("requires FIGMA_API_TOKEN for api commands", async () => {
    const { io } = createIo({ FIGMA_API_TOKEN: undefined });
    await expect(runCli(["--list-team-projects"], io)).rejects.toThrow(
      /Missing FIGMA_API_TOKEN/,
    );
  });

  it("requires FIGMA_TEAM_ID for team-scoped commands", async () => {
    const { io } = createIo({ FIGMA_TEAM_ID: undefined });
    await expect(runCli(["--list-team-projects"], io)).rejects.toThrow(
      /Missing FIGMA_TEAM_ID/,
    );
  });

  it("writes list output from figma-api helpers", async () => {
    mocks.listTeamProjects.mockResolvedValue([
      { id: "1", name: "Design System" },
    ]);
    const { io, output } = createIo();

    await runCli(["--list-team-projects", "--json"], io);

    expect(mocks.listTeamProjects).toHaveBeenCalledWith({
      token: "token",
      teamId: "team",
    });
    expect(output()).toContain('"name": "Design System"');
  });

  it("writes yaml verify results and fails when status is not ok", async () => {
    mocks.verifyComponentContracts.mockResolvedValue([
      {
        componentName: "Cell",
        status: "changed",
        errors: [],
        changed: {
          source: true,
          tree: false,
          variants: ["v1"],
          addedVariants: [],
          removedVariants: [],
        },
      },
    ]);
    const { io, output } = createIo();

    await expect(
      runCli(
        [
          "--verify-component-contract",
          "--contract-dir",
          "tmp",
          "--component-name",
          "Cell",
        ],
        io,
      ),
    ).rejects.toThrow(/Contract verification failed/);

    expect(output()).toContain("Cell\tchanged");
    expect(output()).toContain("changed: source variants=v1");
  });

  it("writes json verify results", async () => {
    mocks.verifyComponentContracts.mockResolvedValue([
      { componentName: "Cell", status: "ok", errors: [] },
    ]);
    const { io, output } = createIo();

    await runCli(
      ["--verify-component-contract", "--contract-dir", "tmp", "--json"],
      io,
    );

    expect(JSON.parse(output())).toEqual({
      results: [{ componentName: "Cell", status: "ok", errors: [] }],
    });
  });

  it("wraps FigmaInspectError from verify in CliError", async () => {
    mocks.verifyComponentContracts.mockRejectedValue(
      new FigmaInspectError("bad contract"),
    );
    const { io } = createIo();

    await expect(
      runCli(["--verify-component-contract", "--contract-dir", "tmp"], io),
    ).rejects.toThrow(new CliError("bad contract"));
  });

  it("builds component set spec to stdout", async () => {
    mocks.buildComponentSetSpecFromFile.mockResolvedValue({ name: "Button" });
    const { io, output } = createIo();

    await runCli(
      [
        "--build-component-set-spec",
        "--input",
        "in.json",
        "--variables",
        "vars.json",
      ],
      io,
    );

    expect(output()).toContain("name: Button");
  });

  it("writes pseudocode contract paths", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "figma-pseudo-test-"),
    );
    mocks.buildComponentSetPseudocodeFromFile.mockResolvedValue({
      componentName: "Button",
      visuals: { root: {} },
      geometry: { root: {} },
      meta: { version: 1 },
      structureDsl: "component Button\ncontracts {}\n",
    });
    const { io, output } = createIo();

    await runCli(
      [
        "--build-component-set-pseudocode",
        "--input",
        path.join(directory, "in.json"),
        "--variables",
        "vars.json",
        "--output-dir",
        directory,
      ],
      io,
    );

    expect(output()).toContain(
      `${directory}${path.sep}Button.component-set.visuals.yaml`,
    );
    await writeFile(path.join(directory, "marker.txt"), "ok");
  });

  it("runs export-component-set through the cli wrapper", async () => {
    mocks.exportComponentSet.mockResolvedValue({
      visualsContractPath: "/out/a.yaml",
      geometryContractPath: "/out/b.yaml",
      metaContractPath: "/out/c.yaml",
      lockContractPath: "/out/d.yaml",
      structureDslPath: "/out/e.dsl",
    });
    const { io, output } = createIo({ FIGMA_TEAM_ID: "team" });

    await runCli(
      [
        "--export-component-set",
        "--output-dir",
        "out",
        "--variables",
        "vars.json",
        "--component-set-name",
        "Button",
      ],
      io,
    );

    expect(mocks.exportComponentSet).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        teamId: "team",
        outputDir: "out",
        componentSet: { kind: "name", value: "Button" },
      }),
    );
    expect(output()).toBe("exported\n");
  });

  it("wraps FigmaApiError from export in CliError", async () => {
    mocks.exportComponentSet.mockRejectedValue(
      new FigmaApiError("rate limited"),
    );
    const { io } = createIo();

    await expect(
      runCli(
        [
          "--export-component-set",
          "--output-dir",
          "out",
          "--variables",
          "vars.json",
          "--component-set-name",
          "Button",
        ],
        io,
      ),
    ).rejects.toThrow(new CliError("rate limited"));
  });

  it("wraps inspect errors from list-project-files", async () => {
    mocks.listProjectFiles.mockRejectedValue(new FigmaApiError("forbidden"));
    const { io } = createIo();

    await expect(
      runCli(["--list-project-files", "--project-id", "123"], io),
    ).rejects.toThrow(new CliError("forbidden"));
  });
});
