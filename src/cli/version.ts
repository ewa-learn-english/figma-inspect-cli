import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./errors.js";

interface PackageJson {
  version?: unknown;
}

function packageJsonPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "package.json",
  );
}

export async function readPackageVersion(): Promise<string> {
  const raw = await readFile(packageJsonPath(), "utf8");
  const parsed = JSON.parse(raw) as PackageJson;
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new CliError("package.json is missing a version.");
  }

  return parsed.version;
}
