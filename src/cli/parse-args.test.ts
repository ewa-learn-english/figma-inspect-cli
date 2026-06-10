import { describe, expect, it } from "vitest";
import { parseCommand } from "./parse-args.js";
import { CliError } from "./errors.js";

describe("parseCommand", () => {
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

  it("rejects missing contract-dir for verify", () => {
    expect(() => parseCommand(["--verify-component-contract"])).toThrow(
      CliError,
    );
  });
});
