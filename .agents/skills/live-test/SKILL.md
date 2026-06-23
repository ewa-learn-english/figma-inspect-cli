---
name: live-test
description: >-
  Run live end-to-end tests of figma-inspect CLI commands against the Figma API.
  Use only when the user explicitly asks for live-test, live test, or to verify
  CLI commands against real Figma data.
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
| `VARIABLES_PATH` | `tmp/cp-ds-styles-variables-local.json` |
| `TEAM_INDEX_DIR` | `tmp/figma-index` |
| `FIGMA_NODE_URL` | `https://www.figma.com/design/$FILE_KEY/LiveTest?node-id=${NODE_ID/:/-}` |
| `FRAME_NODE_URL` | user-provided FRAME URL for node contract export |
| `FRAME_NODE_NAME` | base file name produced by `FRAME_NODE_URL` export |
| `NESTED_ASSET_NODE_ID` | user-provided nested node id under `FRAME_NODE_URL` for asset sidecar export |

Derive at runtime when needed:

- `PROJECT_ID` — from `--list-team-projects`; pick the project whose files include `FILE_KEY`, or the first project if user did not specify.
- `COMPONENT_SET_KEY` — from `--list-file-component-sets --file-key $FILE_KEY`; pick the entry whose `name` equals `COMPONENT_SET_NAME`.
- `FIGMA_NODE_URL` — build from `FILE_KEY` and `NODE_ID` if not provided; Figma URLs use `node-id=3-2` while API node ids use `3:2`.
- `FRAME_NODE_URL` — must point to a `FRAME`; if the user does not provide one, pick a screen/frame from the same file and set this explicitly before rows 22-24.
- `FRAME_NODE_NAME` — derive from the exported `<Name>.frame.lock.yaml` file name.
- `NESTED_ASSET_NODE_ID` — pick a visible nested vector, instance, component, group, or frame under `FRAME_NODE_URL`; Figma URL-style ids with `-` are accepted by the CLI.

## Commands to test

Keep this list aligned with `src/cli/usage.ts`. Test **all** of them every run:

| # | Command | Required args | Notes |
|---|---|---|---|
| 1 | `--list-team-projects` | | needs `FIGMA_TEAM_ID` |
| 2 | `--list-project-files` | `--project-id $PROJECT_ID` | |
| 3 | `--list-team-project-files` | | needs `FIGMA_TEAM_ID` |
| 4 | `--export-team-index` | `--output-dir $TEAM_INDEX_DIR` | writes `team.index.yaml` plus one sibling `*.index.yaml` per Figma file; needs `FIGMA_TEAM_ID` |
| 5 | `--list-team-component-sets` | | needs `FIGMA_TEAM_ID`; published sets only |
| 6 | `--list-file-pages` | `--file-key $FILE_KEY` | |
| 7 | `--list-file-component-sets` | `--file-key $FILE_KEY` | |
| 8 | `--inspect-component-set-properties` | `--file-key $FILE_KEY --node-id $NODE_ID --component-set-name $COMPONENT_SET_NAME` | |
| 9 | `--inspect-component-set-properties` | same + `--component-set-key $COMPONENT_SET_KEY` | key lookup variant |
| 10 | `--inspect-component-set` | `--file-key $FILE_KEY --node-id $NODE_ID --component-set-name $COMPONENT_SET_NAME` | |
| 11 | `--inspect-team-component-set` | `--component-set-name $COMPONENT_SET_NAME` | resolves file/node from team; needs `FIGMA_TEAM_ID` |
| 12 | `--inspect-file-node` | `--file-key $FILE_KEY --node-id $NODE_ID` | raw API payload |
| 13 | `--inspect-file-node` | `--url "$FIGMA_NODE_URL"` | URL variant; supports any Figma node type |
| 14 | `--inspect-component-set` | `--url "$FIGMA_NODE_URL"` | URL variant; requires the URL target to be a `COMPONENT_SET` |
| 15 | `--build-component-set-spec` | `--input tmp/component-set.json --variables $VARIABLES_PATH` | local file only; no Figma token |
| 16 | `--build-component-set-spec` | `--input tmp/component-set.json --variables $VARIABLES_PATH --team-components tmp/ComponentSets.json` | collapses known team components to slots |
| 17 | `--build-component-set-pseudocode` | `--input tmp/component-set.json --variables $VARIABLES_PATH` | writes `<ComponentName>.component-set.{visuals,geometry,meta}.yaml` and `<ComponentName>.component-set.structure.dsl` next to `--input` |
| 18 | `--build-component-set-pseudocode` | `--input tmp/component-set.json --output-dir tmp --variables $VARIABLES_PATH --team-components tmp/ComponentSets.json` | writes component-set contract files to `tmp/` with token resolution |
| 19 | `--export-contract` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FIGMA_NODE_URL"` | preferred URL-first variant; auto-detects `COMPONENT_SET`; also writes `import-notes.md`; needs `FIGMA_TEAM_ID` for this target |
| 20 | `--export-contract` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FRAME_NODE_URL"` | preferred URL-first variant; auto-detects `FRAME`; writes `<name>.frame.{visuals,geometry,meta,lock}.yaml` and `<name>.frame.structure.dsl` |
| 21 | `--export-component-set` | `--output-dir tmp --variables $VARIABLES_PATH --component-set-name $COMPONENT_SET_NAME` | explicit component-set variant; writes `<name>.component-set.{visuals,geometry,meta,lock}.yaml`, and `<name>.component-set.structure.dsl`; needs `FIGMA_TEAM_ID` |
| 22 | `--export-component-set` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FIGMA_NODE_URL"` | explicit component-set URL variant; also writes `import-notes.md`; needs `FIGMA_TEAM_ID` |
| 23 | `--export-component-set` | `--output-dir tmp --variables $VARIABLES_PATH --component-set-name ProfileStreakIcon --export-assets` | attempts variant SVG assets; asset-exportable sets write `<name>.assets/*.svg`, store paths in `meta.yaml`, and use asset-backed contracts; runtime-prop sets warn and fall back to runtime contracts; needs `FIGMA_API_TOKEN` + `FIGMA_TEAM_ID` |
| 24 | `--export-component-set` | `--output-dir tmp --variables $VARIABLES_PATH --component-set-name $COMPONENT_SET_NAME --json` | same as row 21 but writes `.json` files instead of `.yaml` |
| 25 | `--export-node-contract` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FRAME_NODE_URL"` | explicit node-contract URL variant for FRAME |
| 26 | `--export-contract` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FRAME_NODE_URL" --export-preview` | also writes `<name>.frame.preview.png` at PNG scale 2; use `--preview-format svg` for SVG |
| 27 | `--export-node-contract` | `--output-dir tmp --variables $VARIABLES_PATH --url "$FRAME_NODE_URL" --export-nested-assets --asset-node-id "$NESTED_ASSET_NODE_ID" --asset-format svg --asset-format png` | also writes `<name>.frame.nested-assets.yaml` and `<name>.assets/*.{svg,png}` |
| 28 | `--verify-node-contract` | `--contract-dir tmp` | compares frame/component node locks to live Figma (source, tree, kind); needs `FIGMA_API_TOKEN` |
| 29 | `--verify-node-contract` | `--contract-dir tmp --node-name "$FRAME_NODE_NAME" --json` | verifies one node contract; JSON output only |
| 30 | `--verify-component-contract` | `--contract-dir tmp` | compares each lock to live Figma (source, tree, variants); needs `FIGMA_API_TOKEN` |
| 31 | `--verify-component-contract` | `--contract-dir tmp --component-name Cell --json` | verifies one component; JSON output only |

Example:

```sh
npm run build

npx . --list-team-projects
npx . --list-project-files --project-id "$PROJECT_ID"
npx . --list-team-project-files
npx . --export-team-index --output-dir "$TEAM_INDEX_DIR"
npx . --list-team-component-sets
npx . --list-file-pages --file-key O7aE7SeG2TRBCK5MsjkG7z
npx . --list-file-component-sets --file-key O7aE7SeG2TRBCK5MsjkG7z
npx . --inspect-component-set-properties --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2 --component-set-name Cell
npx . --inspect-component-set --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2 --component-set-name Cell
npx . --inspect-team-component-set --component-set-name Cell
npx . --inspect-file-node --file-key O7aE7SeG2TRBCK5MsjkG7z --node-id 3:2
npx . --inspect-file-node --url "$FIGMA_NODE_URL"
npx . --inspect-component-set --url "$FIGMA_NODE_URL"
npx . --build-component-set-spec --input tmp/component-set.json --variables "$VARIABLES_PATH"
npx . --build-component-set-spec --input tmp/component-set.json --variables "$VARIABLES_PATH" --team-components tmp/ComponentSets.json
npx . --build-component-set-pseudocode --input tmp/component-set.json --variables "$VARIABLES_PATH"
npx . --build-component-set-pseudocode --input tmp/component-set.json --output-dir tmp --variables "$VARIABLES_PATH" --team-components tmp/ComponentSets.json
npx . --export-contract --output-dir tmp --variables "$VARIABLES_PATH" --url "$FIGMA_NODE_URL"
npx . --export-contract --output-dir tmp --variables "$VARIABLES_PATH" --url "$FRAME_NODE_URL"
npx . --export-component-set --output-dir tmp --variables "$VARIABLES_PATH" --component-set-name "$COMPONENT_SET_NAME"
npx . --export-component-set --output-dir tmp --variables "$VARIABLES_PATH" --url "$FIGMA_NODE_URL"
npx . --export-component-set --output-dir tmp --variables "$VARIABLES_PATH" --component-set-name "$COMPONENT_SET_NAME" --json
npx . --export-node-contract --output-dir tmp --variables "$VARIABLES_PATH" --url "$FRAME_NODE_URL"
npx . --export-contract --output-dir tmp --variables "$VARIABLES_PATH" --url "$FRAME_NODE_URL" --export-preview
npx . --export-node-contract --output-dir tmp --variables "$VARIABLES_PATH" --url "$FRAME_NODE_URL" --export-nested-assets --asset-node-id "$NESTED_ASSET_NODE_ID" --asset-format svg --asset-format png
npx . --verify-node-contract --contract-dir tmp
npx . --verify-node-contract --contract-dir tmp --node-name "$FRAME_NODE_NAME" --json
npx . --verify-component-contract --contract-dir tmp
npx . --verify-component-contract --contract-dir tmp --component-name Cell --json
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
