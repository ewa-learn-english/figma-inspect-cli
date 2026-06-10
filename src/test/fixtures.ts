import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const contractFixturesDir = path.join(
  repoRoot,
  "test/fixtures/contracts",
);

export const variablesFixturePath = path.join(
  repoRoot,
  "test/fixtures/variables-minimal.json",
);
