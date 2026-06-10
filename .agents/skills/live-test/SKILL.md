---
name: live-test
description: >-
  Run live end-to-end tests of figma-inspect CLI commands against the Figma API.
  Use only when the user explicitly asks for live-test, live test, or to verify
  CLI commands against real Figma data.
disable-model-invocation: true
---

# Live Test CLI

Run every supported CLI command against the real Figma API. Fix failures before reporting done.

## When to run

Only when the user explicitly invokes this skill (for example: `/live-test`, "live-test", "прогони live-test").

Do not run live API calls during refactors, reviews, or commits unless the user asked for this skill.

## Prerequisites

1. `FIGMA_API_TOKEN` and `FIGMA_TEAM_ID` must be set in the environment.
2. Build before testing: `npm run build`
3. Run CLI from repo root via `npx .` (uses package `bin` → `dist/`).

If env vars are missing, stop and tell the user which variable is absent.

## Default fixture

Use these defaults unless the user provides overrides in the chat:

| Variable | Default |
|---|---|
| `FILE_KEY` | `O7aE7SeG2TRBCK5MsjkG7z` |
| `NODE_ID` | `3:2` |
| `COMPONENT_SET_NAME` | `Cell` |

Derive at runtime when needed:

- `PROJECT_ID` — from `--list-team-projects`; pick the project whose files include `FILE_KEY`, or the first project if user did not specify.
- `COMPONENT_SET_KEY` — from `--list-file-component-sets --file-key $FILE_KEY`; pick the entry whose `name` equals `COMPONENT_SET_NAME`.

## Commands to test

Keep this list aligned with `src/cli/usage.ts`. Test **all** of them every run:

| # | Command | Required args | Notes |
|---|---|---|---|
| 1 | `--list-team-projects` | | needs `FIGMA_TEAM_ID` |
| 2 | `--list-project-files` | `--project-id $PROJECT_ID` | |
| 3 | `--list-team-project-files` | | needs `FIGMA_TEAM_ID` |
| 4 | `--list-team-component-sets` | | needs `FIGMA_TEAM_ID`; published sets only |
| 5 | `--list-file-pages` | `--file-key $FILE_KEY` | |
| 6 | `--list-file-component-sets` | `--file-key $FILE_KEY` | |
| 7 | `--inspect-component-set-properties` | `--file-key $FILE_KEY --node-id $NODE_ID --component-set-name $COMPONENT_SET_NAME` | |
| 8 | `--inspect-component-set-properties` | same + `--component-set-key $COMPONENT_SET_KEY` | key lookup variant |
| 9 | `--inspect-component-set` | `--file-key $FILE_KEY --node-id $NODE_ID --component-set-name $COMPONENT_SET_NAME` | |
| 10 | `--inspect-team-component-set` | `--component-set-name $COMPONENT_SET_NAME` | resolves file/node from team; needs `FIGMA_TEAM_ID` |
| 11 | `--inspect-file-node` | `--file-key $FILE_KEY --node-id $NODE_ID` | raw API payload |
| 12 | `--build-component-set-spec` | `--input tmp/component-set.json` | local file only; no Figma token |
| 13 | `--build-component-set-spec` | `--input tmp/component-set.json --variables tmp/variables.json` | resolves Figma variable ids to token names |
| 14 | `--build-component-set-spec` | `--input tmp/component-set.json --team-components tmp/ComponentSets.json` | collapses known team components to slots |
| 15 | `--build-component-set-pseudocode` | `--input tmp/component-set.json` | writes `<ComponentName>.contract.{visuals,geometry,meta}.yaml` and `<ComponentName>.contract.structure.dsl` next to `--input` |
| 16 | `--build-component-set-pseudocode` | `--input tmp/component-set.json --output-dir tmp --variables tmp/variables.json --team-components tmp/ComponentSets.json` | writes contract files to `tmp/` with token resolution |
| 17 | `--export-component-set` | `--output-dir tmp --component-set-name $COMPONENT_SET_NAME` | writes `<name>.yaml`, `<name>.contract.{visuals,geometry,meta}.yaml`, and `<name>.contract.structure.dsl`; needs `FIGMA_TEAM_ID` |
| 18 | `--export-component-set` | `--output-dir tmp --component-set-name ProfileStreakIcon --export-assets` | also writes `<name>.contract.assets.yaml`, `<name>.assets/*.svg`, and asset-backed contracts; needs `FIGMA_API_TOKEN` + `FIGMA_TEAM_ID` |
| 19 | `--export-component-set` | `--output-dir tmp --component-set-name $COMPONENT_SET_NAME --json` | same as row 17 but writes `.json` files instead of `.yaml` |

Example:

```sh
npm run build

npx . --list-team-projects
npx . --list-project-files --project-id "$PROJECT_ID"
npx . --list-team-project-files
npx . --list-team-component-sets
npx . --list-file-pages --file-key O7aE7SeG2TRBCK5MsjkG7z
npx . --list-file-component-sets --file-key O7aE7SeG2TRBCK5MsjkG7z
npx . --inspect-component-set-properties --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2 --component-set-name Cell
npx . --inspect-component-set --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2 --component-set-name Cell
npx . --inspect-team-component-set --component-set-name Cell
npx . --inspect-file-node --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2
npx . --build-component-set-spec --input tmp/component-set.json
npx . --build-component-set-spec --input tmp/component-set.json --variables tmp/variables.json
npx . --build-component-set-spec --input tmp/component-set.json --team-components tmp/ComponentSets.json
npx . --build-component-set-pseudocode --input tmp/component-set.json
npx . --build-component-set-pseudocode --input tmp/component-set.json --output-dir tmp --variables tmp/variables.json --team-components tmp/ComponentSets.json
npx . --export-component-set --output-dir tmp --component-set-name "$COMPONENT_SET_NAME"
npx . --export-component-set --output-dir tmp --component-set-name "$COMPONENT_SET_NAME" --json
```

## Execution rules

1. Run commands in the shell; do not assume success from code inspection alone.
2. Capture exit code for each command. Exit code must be `0`.
3. For structured commands, confirm output is valid YAML or JSON (array or object), not an error string.
4. For list commands without `--json`, confirm YAML output (array), not an error string.
5. When piping to `head`, re-check exit code without `head` — SIGPIPE can mask success.
6. If a command fails, diagnose (including Zod/API parsing), fix the code, rebuild, and re-run **all** commands.
7. After fixes, run `npm run check`.

## Report format

```markdown
## Live test results

| Command | Exit | Result |
|---|---|---|
| --list-team-projects | 0 | OK — N projects |
| ... | | |

### Fixes applied
- <file>: <what changed> (only if fixes were needed)

### Validation
- npm run check: pass/fail
```

## Maintaining this skill

When CLI commands, flags, env requirements, or default fixture values change, update this file in the same PR/commit as the CLI change. Source of truth for the command list: `src/cli/usage.ts`.
