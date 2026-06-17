import { describe, expect, it } from "vitest";
import { writeExportArtifactPaths } from "./export-result.js";

describe("writeExportArtifactPaths", () => {
  it("writes shared export paths and optional extras in the CLI output order", () => {
    let output = "";
    const stdout = {
      write(chunk: string): boolean {
        output += chunk;
        return true;
      },
    } as NodeJS.WriteStream;

    writeExportArtifactPaths(
      {
        visualsContractPath: "/out/Cell.component-set.visuals.yaml",
        geometryContractPath: "/out/Cell.component-set.geometry.yaml",
        metaContractPath: "/out/Cell.component-set.meta.yaml",
        lockContractPath: "/out/Cell.component-set.lock.yaml",
        structureDslPath: "/out/Cell.component-set.structure.dsl",
        assetsDir: "/out/Cell.assets",
        importNotesPath: "/out/import-notes.md",
      },
      stdout,
    );

    expect(output).toBe(
      `${[
        "/out/Cell.component-set.visuals.yaml",
        "/out/Cell.component-set.geometry.yaml",
        "/out/Cell.component-set.meta.yaml",
        "/out/Cell.component-set.lock.yaml",
        "/out/Cell.component-set.structure.dsl",
        "/out/Cell.assets",
        "/out/import-notes.md",
      ].join("\n")}\n`,
    );
  });
});
