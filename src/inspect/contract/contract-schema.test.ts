import path from "node:path";
import { describe, expect, it } from "vitest";
import { contractFixturesDir } from "../../test/fixtures.js";
import { FigmaInspectError } from "../errors.js";
import {
  readComponentContractArtifacts,
  validateComponentContractArtifacts,
} from "./contract-schema.js";

const contractDir = contractFixturesDir;

describe("readComponentContractArtifacts", () => {
  it("loads and validates TextInput contract files from fixtures", async () => {
    const artifacts = await readComponentContractArtifacts(
      contractDir,
      "TextInput",
      "yaml",
    );
    expect(artifacts.componentName).toBe("TextInput");
    expect(artifacts.meta.version).toBe(1);
    expect(artifacts.meta.props?.State?.type).toBe("variant");
    expect(artifacts.structureDsl).toContain("component TextInput");
    expect(artifacts.structureDsl).toContain(
      "TextInput.component-set.meta.yaml",
    );
    expect(artifacts.visuals).toBeTypeOf("object");
    expect(artifacts.assetsDir).toBeUndefined();
  });

  it("loads asset-backed ProfileStreakIcon contracts from fixtures", async () => {
    const artifacts = await readComponentContractArtifacts(
      contractDir,
      "ProfileStreakIcon",
      "yaml",
    );

    expect(artifacts.meta.assets?.M?.Active?.path).toBe(
      "ProfileStreakIcon.assets/active-m.svg",
    );
    expect(artifacts.assetsDir).toBe(
      path.join(contractDir, "ProfileStreakIcon.assets"),
    );
  });
});

describe("validateComponentContractArtifacts", () => {
  it("accepts artifacts loaded from fixtures", async () => {
    const artifacts = await readComponentContractArtifacts(
      contractDir,
      "TextInput",
      "yaml",
    );

    expect(() =>
      validateComponentContractArtifacts(artifacts, "yaml"),
    ).not.toThrow();
  });

  it("rejects structure DSL with the wrong component header", async () => {
    const artifacts = await readComponentContractArtifacts(
      contractDir,
      "TextInput",
      "yaml",
    );

    expect(() =>
      validateComponentContractArtifacts(
        {
          ...artifacts,
          structureDsl: "component WrongName\ncontracts {}\n",
        },
        "yaml",
      ),
    ).toThrow(FigmaInspectError);
  });
});
