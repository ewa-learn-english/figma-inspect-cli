# figma-inspect-cli

Node.js CLI for inspecting Figma API resources and exporting AI-friendly component contracts.

## Project Status

For this greenfield app:
**This app has not been released yet! This app has no real users.**
**Do not add, update, or extend migrations unless directly instructed by the user.**
**Prefer breaking changes. Don't add shims, bridges. Don't add compatibility layers.**

## Stack

- TypeScript, ESM (`"type": "module"`, `NodeNext` resolution)
- Biome — lint and format
- knip — unused code and dependencies
- Node 24 LTS (Krypton)

## Layout

```
src/
  bin/figma-inspect.ts              # entry point
  cli/                              # argv parsing, command dispatch, stdout formatting
    parse-args.ts                   # flags → CliCommand
    run-cli.ts                      # command router (no Figma domain logic)
    usage.ts                        # help text (keep in sync with parse-args + live-test skill)
    export-component-set.ts         # export orchestration
  figma-api/                        # Figma REST client only (HTTP, cache, schemas)
  inspect/                          # domain logic on top of API responses
    component-set-spec/             # COMPONENT_SET → compact spec (props, variants, slim tree)
    component-set-pseudocode/       # spec → contract artifacts (meta, geometry, visuals, structure.dsl)
    contract/                       # contract format, lock, schema validation, fingerprints, verify
    export/                         # variant SVG export and asset normalization
    *.ts                            # Figma file/component-set loading and lookup helpers
  zod/                              # shared zod helpers
```

**Dependency rule:** `cli/` → `inspect/` → `figma-api/`. Never import `cli/` from `inspect/` or `figma-api/`.

Imports use `.js` extensions (compiled output paths).

## CLI commands

One command per invocation. Source of truth: `src/cli/usage.ts` and `src/cli/parse-args.ts`.

| Command | Token | Team ID | Notes |
|---------|-------|---------|-------|
| `--list-team-projects` | yes | yes | |
| `--list-project-files` | yes | | `--project-id` |
| `--list-team-project-files` | yes | yes | |
| `--list-team-component-sets` | yes | yes | |
| `--list-file-pages` | yes | | `--file-key` |
| `--list-file-component-sets` | yes | | `--file-key` |
| `--inspect-component-set-properties` | yes | | `--file-key`, `--node-id`, component set key/name |
| `--inspect-component-set` | yes | | raw COMPONENT_SET YAML |
| `--inspect-team-component-set` | yes | yes | resolves file/node from team publish |
| `--inspect-file-node` | yes | | `--file-key`, `--node-id` |
| `--build-component-set-spec` | | | local JSON `--input`, `--variables`; no API token |
| `--build-component-set-pseudocode` | | | writes contract files locally |
| `--verify-component-contract` | yes | | `--contract-dir`; compares lock to live Figma API |
| `--export-component-set` | yes | yes | `--output-dir`, `--variables`, component set key/name |

`--json` on verify affects **stdout format only**; contract files on disk stay YAML unless export uses `--json`.

### Contract artifacts (per component)

Always four files for the model + lock for CI:

- `<Name>.contract.meta.yaml` — props, slots, dependencies, optional `assets` paths
- `<Name>.contract.geometry.yaml`
- `<Name>.contract.visuals.yaml`
- `<Name>.contract.structure.dsl` — entry point with `contracts {}` and `resolve {}`
- `<Name>.contract.lock.yaml` — Figma source, variant `updatedAt`, fingerprints (not for LLM prompt)

With `--export-assets`: `<Name>.assets/*.svg` on disk; paths referenced from `meta.assets`.

## Environment

- `FIGMA_API_TOKEN` — required for all API commands and `--verify-component-contract`
- `FIGMA_TEAM_ID` — required for team-scoped list/inspect/export commands
- `FIGMA_CACHE` — set to `0` to disable on-disk API cache (`figma-inspect-cli-cache/` in temp)

## Scripts

```sh
npm run dev       # tsx from source
npm run build     # compile to dist/
npm run check     # biome check + knip + unit tests
npm run test      # vitest unit tests
npm run test:coverage
npm run format    # biome format --write
```

Run `npm run check` before finishing; fix new issues you introduce.
After code changes, always run `npm run build` so `dist/` is current.

## Skills

Project skills live in `.agents/skills/`.

- **live-test** — live end-to-end CLI checks. Invoke explicitly (`/live-test`). When CLI commands or flags change, update `.agents/skills/live-test/SKILL.md` in the same change. Keep aligned with `src/cli/usage.ts`.
- **deslopify** — code quality cleanup in scoped files. Ralph-loop agents: read skill, fix root causes, run `npm run check` + `npm run build`, commit (never commit `.agents/skills/deslopify/MEMORY.md`).

## Commits

1. Format: `<ImperativeVerb> <description>`.
2. Start with imperative verb (`Add`, `Fix`, `Update`, `Remove`, `Refactor`, etc.).
3. Do not add trailing period to commit header.
4. Use sentence case.
5. Do not include ticket ID in commit header.
6. Optional body explains why, not what.
7. English only.

## Ralph loop guardrails

- Do not move files between `inspect/` subfolders unless the task explicitly asks for a restructure.
- Do not add features, new CLI flags, or dependencies without an explicit request.
- Prefer deleting duplication over new abstractions.
- One focused concern per commit.
