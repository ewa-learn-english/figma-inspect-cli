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
    export-contract.ts              # auto-detect export target and route to the right exporter
    export-node-contract.ts         # FRAME / standalone COMPONENT export orchestration
    export-team-index.ts            # team inventory export
  figma-api/                        # Figma REST client only (HTTP, cache, schemas)
  inspect/                          # domain logic on top of API responses
    component-set-spec/             # COMPONENT_SET → compact spec (props, variants, slim tree)
    component-set-pseudocode/       # spec → contract artifacts (meta, geometry, visuals, structure.dsl)
    contract/                       # contract format, lock, schema validation, fingerprints, verify
    node-contract/                  # FRAME / standalone COMPONENT contract format, lock, verify
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
| `--version` | | | prints package version |
| `--list-team-projects` | yes | yes | |
| `--list-project-files` | yes | | `--project-id` |
| `--list-team-project-files` | yes | yes | |
| `--export-team-index` | yes | yes | `--output-dir`; writes `figma-index.sqlite3`; optional screen grouping thresholds |
| `--list-team-component-sets` | yes | yes | |
| `--list-component-set-usages` | | | local `--index-dir`; component set key/name; optional `--screen-group`, `--full` |
| `--inspect-component-set-responsive-usage` | | | local `--index-dir`; component set key/name; optional `--screen-group`, `--full` |
| `--list-file-pages` | yes | | `--file-key` |
| `--list-file-component-sets` | yes | | `--file-key` |
| `--inspect-component-set-properties` | yes | | `--url` or `--file-key`, `--node-id`, component set key/name |
| `--inspect-component-set` | yes | | `--url` or `--file-key`, `--node-id`, component set key/name; raw COMPONENT_SET YAML/JSON |
| `--inspect-team-component-set` | yes | yes | resolves file/node from team publish |
| `--inspect-file-node` | yes | | `--url` or `--file-key`, `--node-id` |
| `--build-component-set-spec` | | | local JSON `--input`, `--variables`; no API token |
| `--build-component-set-pseudocode` | | | writes contract files locally |
| `--verify-component-contract` | yes | | `--contract-dir`; compares lock to live Figma API |
| `--verify-node-contract` | yes | | `--contract-dir`; compares frame/component lock to live Figma API |
| `--export-contract` | yes | maybe | `--output-dir`, `--variables`, `--url` or file/node ref; Team ID only when target is `COMPONENT_SET` |
| `--export-component-set` | yes | yes | `--output-dir`, `--variables`, `--url` or component set key/name |
| `--export-node-contract` | yes | | `--output-dir`, `--variables`, `--url` or file/node ref |

`--json` on verify affects **stdout format only**. Export commands write JSON
data artifacts when `--json` is set, but lock files stay YAML and structure
files stay DSL. `--json` is not supported with `--export-team-index`; the local
team index is always `figma-index.sqlite3`.

### Contract artifacts

Component-set exports write four files for the model + lock for CI:

- `<Name>.component-set.meta.yaml` — props, slots, dependencies, optional `assets` paths
- `<Name>.component-set.geometry.yaml`
- `<Name>.component-set.visuals.yaml`
- `<Name>.component-set.structure.dsl` — entry point with `contracts {}` and `resolve {}`
- `<Name>.component-set.lock.yaml` — Figma source, variant `updatedAt`, fingerprints (not for LLM prompt)
- `<Name>.component-set.layout-risks.{yaml,json}` — optional sidecar when constrained fill/stretch patterns need manual layout review

Frame and standalone component exports use the same shape with `<kind>` set to
`frame` or `component`:

- `<Name>.<kind>.meta.yaml`
- `<Name>.<kind>.geometry.yaml`
- `<Name>.<kind>.visuals.yaml`
- `<Name>.<kind>.structure.dsl`
- `<Name>.<kind>.lock.yaml`

With `--export-assets`: `<Name>.assets/*.svg` on disk; paths referenced from
`meta.assets`. With `--export-nested-assets`: `<Name>.assets/*.{svg,png}` plus
`<Name>.<kind>.nested-assets.yaml`.

## Environment

- `FIGMA_API_TOKEN` — required for all API commands and verify commands
- `FIGMA_TEAM_ID` — required for team-scoped list/inspect/export commands, `--export-team-index`, `--export-component-set`, and `--export-contract` when the target is a `COMPONENT_SET`
- `FIGMA_CACHE` — set to `0` to disable on-disk API cache (`figma-inspect-cli-cache/` in temp)

Local index lookup commands read `--index-dir` and do not require Figma
environment variables. They print compact LLM-friendly summaries by default;
use `--full` for raw usage records.

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
- **npm-publish** — publish or update the npm-distributed CLI package. Use for release/version bumps, `npm publish`, npmjs access checks, and post-publish verification from another repository.

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
