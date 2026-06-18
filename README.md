# figma-inspect-cli

Node.js CLI for inspecting Figma API resources and exporting AI-friendly
component contracts.

## Usage

Set required environment variables:

```sh
export FIGMA_API_TOKEN="figd_..."
export FIGMA_TEAM_ID="<team_id>"
```

List projects for a team:

```sh
npx . --list-team-projects
```

List files in a project:

```sh
npx . --list-project-files --project-id <project_id>
```

List files in all team projects:

```sh
npx . --list-team-project-files
```

Export a deterministic YAML inventory for every file in the configured team:

```sh
npx . --export-team-index --output-dir tmp/figma-index
```

This writes a compact `tmp/figma-index/team.index.yaml` router plus one sibling
`tmp/figma-index/*.index.yaml` per Figma file. The team index only lists
files and their per-file index paths. Per-file indexes use camelCase YAML keys
and named object rows for component sets, standalone components, screens, and
screen groups. Detailed contracts are exported later with `--export-contract`.

List published component sets in a team:

```sh
npx . --list-team-component-sets
```

List pages in a file:

```sh
npx . --list-file-pages --file-key <file_key>
```

List component sets in a file:

```sh
npx . --list-file-component-sets --file-key <file_key>
```

List nested component sets exposed in a component set:

```sh
npx . --inspect-component-set-properties --file-key <file_key> --node-id <node_id> --component-set-name Cell --json
```

Inspect raw JSON for a COMPONENT_SET node in a page tree:

```sh
npx . --inspect-component-set --file-key <file_key> --node-id <node_id> --component-set-key <component_set_key>
npx . --inspect-component-set --file-key <file_key> --node-id <node_id> --component-set-name Toast
```

Find a published component set by name and inspect it (requires `FIGMA_TEAM_ID`):

```sh
npx . --inspect-team-component-set --component-set-name Toast
```

Inspect raw JSON for a node (page, frame, etc.):

```sh
npx . --inspect-file-node --file-key <file_key> --node-id <node_id>
npx . --inspect-file-node --url "https://www.figma.com/design/<file_key>/<name>?node-id=<node_id>"
```

Build an AI-friendly spec from a local COMPONENT_SET JSON file:

```sh
npx . --inspect-component-set ... > tmp/Toast.json
npx . --build-component-set-spec --input tmp/Toast.json --variables tmp/cp-ds-styles-variables-local.json
npx . --build-component-set-spec --input tmp/Toast.json --variables tmp/cp-ds-styles-variables-local.json --team-components tmp/ComponentSets.json
```

Export contract files for a Figma URL or node reference:

```sh
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "https://www.figma.com/design/<file_key>/<name>?node-id=<node_id>"
```

`--export-contract` auto-detects supported node types:

- `COMPONENT_SET` writes `<Name>.component-set.{visuals,geometry,meta,lock}.yaml`
  and `<Name>.component-set.structure.dsl`.
- `FRAME` writes `<Name>.frame.{visuals,geometry,meta,lock}.yaml` and
  `<Name>.frame.structure.dsl`.
- standalone `COMPONENT` writes `<Name>.component.{visuals,geometry,meta,lock}.yaml`
  and `<Name>.component.structure.dsl`.

Export contract files for a published component set:

```sh
npx . --export-component-set --output-dir tmp --component-set-name RoadmapHeader --variables tmp/cp-ds-styles-variables-local.json
```

Export a root node preview image next to the contract artifacts:

```sh
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<figma_url>" --export-preview
npx . --export-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<figma_url>" --export-preview --preview-format svg
```

Export one SVG asset per component-set variant and reference those assets from
`meta.yaml`:

```sh
npx . --export-component-set --output-dir tmp --component-set-name ProfileStreakIcon --variables tmp/cp-ds-styles-variables-local.json --export-assets
```

Export selected nested nodes as sidecar assets for implementation handoff:

```sh
npx . --export-node-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<frame_url>" --export-nested-assets --asset-node-id <nested_node_id>
npx . --export-node-contract --output-dir tmp --variables tmp/cp-ds-styles-variables-local.json --url "<frame_url>" --export-nested-assets --asset-include-regex "icon|logo" --asset-node-types INSTANCE,VECTOR --asset-format svg --asset-format png
```

Nested asset export writes `<Name>.assets/*.{svg,png}` plus
`<Name>.<kind>.nested-assets.yaml`. It requires an explicit selector via
`--asset-node-id` or `--asset-include-regex`; it does not export every visual
node by default.

For script-friendly output:

```sh
npx . --list-team-projects --json
npx . --list-project-files --project-id <project_id> --json
npx . --list-team-project-files --json
npx . --list-team-component-sets --json
npx . --list-file-pages --file-key <file_key> --json
npx . --list-file-component-sets --file-key <file_key> --json
```
