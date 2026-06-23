# figma-inspect-cli

Node.js CLI for inspecting Figma API resources and exporting AI-friendly
contracts for component sets, frames, and standalone components.

## Setup

```sh
npm install
npm run build
```

Set the environment variables needed by API-backed commands:

```sh
export FIGMA_API_TOKEN="figd_..."
export FIGMA_TEAM_ID="<team_id>"
```

From the repository, run the compiled CLI with `npx .`:

```sh
npx . --help
```

For source-mode development, use `npm run dev -- <flags>`.

## Commands

Only one command can be passed per invocation. `FIGMA_API_TOKEN` is required for
all API-backed commands and verification. `FIGMA_TEAM_ID` is required for
team-scoped commands, `--export-team-index`, `--export-component-set`, and
`--export-contract` when the target is a `COMPONENT_SET`.

| Command | Main arguments | Output |
|---|---|---|
| `--list-team-projects` | none | Team projects |
| `--list-project-files` | `--project-id <id>` | Files in one project |
| `--list-team-project-files` | none | Files across team projects |
| `--export-team-index` | `--output-dir <dir>` | `team.index.yaml` plus per-file `*.index.yaml` |
| `--list-team-component-sets` | none | Published team component sets |
| `--list-file-pages` | `--file-key <key>` | Pages in one file |
| `--list-file-component-sets` | `--file-key <key>` | Component sets in one file |
| `--inspect-component-set-properties` | `--url <figma-url>` or `--file-key <key> --node-id <id>` plus component set key/name | Nested component-set properties |
| `--inspect-component-set` | `--url <figma-url>` or `--file-key <key> --node-id <id>` plus component set key/name | Raw `COMPONENT_SET` node |
| `--inspect-team-component-set` | `--component-set-key <key>` or `--component-set-name <name>` | Raw published component set |
| `--inspect-file-node` | `--url <figma-url>` or `--file-key <key> --node-id <id>` | Raw file node |
| `--build-component-set-spec` | `--input <path> --variables <path>` | Compact local component-set spec |
| `--build-component-set-pseudocode` | `--input <path> --variables <path>` | Local component-set contract files |
| `--export-contract` | `--output-dir <dir> --variables <path>` plus URL or file/node ref | Auto-detected component-set, frame, or component contracts |
| `--export-component-set` | `--output-dir <dir> --variables <path>` plus URL or component set key/name | Component-set contracts |
| `--export-node-contract` | `--output-dir <dir> --variables <path>` plus URL or file/node ref | Frame or standalone component contracts |
| `--verify-component-contract` | `--contract-dir <dir>` | Component-set lock verification |
| `--verify-node-contract` | `--contract-dir <dir>` | Frame/component lock verification |

Common optional flags:

- `--json` prints JSON instead of YAML, or writes JSON data artifacts for export
  commands. Lock files remain YAML and structure files remain DSL. `--json` is
  not supported with `--export-team-index`.
- `--team-components <path>` is supported by local component-set build commands.
- `--export-preview`, `--preview-format png|svg`, and `--preview-scale <scale>`
  write a root preview image next to exported contracts.
- `--export-assets` writes one SVG per component-set variant. It is supported by
  `--export-component-set` and by `--export-contract` when the target is a
  `COMPONENT_SET`. With `--export-contract`, it is ignored for `FRAME` and
  standalone `COMPONENT` targets.
- `--export-nested-assets` writes selected nested nodes as sidecar assets. Use
  `--asset-node-id <id>` or `--asset-include-regex <regex>` to choose nodes.
  `--asset-format svg|png`, `--asset-scale <scale>`, `--asset-node-types <csv>`,
  and `--asset-max <number>` refine nested asset export.
- `--screen-similarity-threshold <number>` and `--screen-size-tolerance <px>`
  refine screen grouping for `--export-team-index`.

## Discovery

```sh
npx . --list-team-projects
npx . --list-project-files --project-id <project_id>
npx . --list-team-project-files
npx . --export-team-index --output-dir tmp/figma-index
npx . --list-team-component-sets
npx . --list-file-pages --file-key <file_key>
npx . --list-file-component-sets --file-key <file_key>
```

`--export-team-index` writes a compact `team.index.yaml` router plus one sibling
`*.index.yaml` per Figma file. Per-file indexes include component sets,
standalone components, screens, and screen groups. Detailed contracts are
exported later with `--export-contract`, `--export-component-set`, or
`--export-node-contract`.

## Inspect

```sh
npx . --inspect-component-set-properties --file-key <file_key> --node-id <node_id> --component-set-name Cell
npx . --inspect-component-set --file-key <file_key> --node-id <node_id> --component-set-key <component_set_key>
npx . --inspect-component-set --url "https://www.figma.com/design/<file_key>/<name>?node-id=<node_id>"
npx . --inspect-team-component-set --component-set-name Toast
npx . --inspect-file-node --file-key <file_key> --node-id <node_id>
npx . --inspect-file-node --url "https://www.figma.com/design/<file_key>/<name>?node-id=<node_id>"
```

## Local Build

Build local artifacts from a saved raw `COMPONENT_SET` JSON file:

```sh
npx . --inspect-component-set ... --json > tmp/Toast.json
npx . --build-component-set-spec --input tmp/Toast.json --variables tmp/cp-ds-styles-variables-local.json
npx . --build-component-set-spec --input tmp/Toast.json --variables tmp/cp-ds-styles-variables-local.json --team-components tmp/ComponentSets.json
npx . --build-component-set-pseudocode --input tmp/Toast.json --variables tmp/cp-ds-styles-variables-local.json --output-dir tmp
```

## Export

`--export-contract` auto-detects supported node types:

- `COMPONENT_SET` writes `<Name>.component-set.{visuals,geometry,meta}.yaml`,
  `<Name>.component-set.structure.dsl`, and `<Name>.component-set.lock.yaml`.
- `FRAME` writes `<Name>.frame.{visuals,geometry,meta}.yaml`,
  `<Name>.frame.structure.dsl`, and `<Name>.frame.lock.yaml`.
- Standalone `COMPONENT` writes `<Name>.component.{visuals,geometry,meta}.yaml`,
  `<Name>.component.structure.dsl`, and `<Name>.component.lock.yaml`.

```sh
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "https://www.figma.com/design/<file_key>/<name>?node-id=<node_id>"
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --file-key <file_key> --node-id <node_id>
npx . --export-component-set --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --component-set-name RoadmapHeader
npx . --export-component-set --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<component_set_url>"
npx . --export-node-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<frame_or_component_url>"
```

URL-based exports also write `import-notes.md`.

## Assets And Previews

```sh
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<figma_url>" --export-preview
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<figma_url>" --export-preview --preview-format svg
npx . --export-component-set --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --component-set-name ProfileStreakIcon --export-assets
npx . --export-node-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<frame_url>" --export-nested-assets --asset-node-id <nested_node_id>
npx . --export-node-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<frame_url>" --export-nested-assets --asset-include-regex "icon|logo" --asset-node-types INSTANCE,VECTOR --asset-format svg --asset-format png
```

Variant asset export writes `<Name>.assets/*.svg` and references those paths from
`meta.assets`. Nested asset export writes `<Name>.assets/*.{svg,png}` plus
`<Name>.<kind>.nested-assets.yaml`.

## Verify

```sh
npx . --verify-component-contract --contract-dir tmp
npx . --verify-component-contract --contract-dir tmp --component-name Cell --json
npx . --verify-node-contract --contract-dir tmp
npx . --verify-node-contract --contract-dir tmp --node-name Settings --json
```
