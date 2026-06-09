# figma-inspect-cli

Node.js CLI for inspecting Figma API resources.

## Usage

Set required environment variables:

```sh
export FIGMA_API_TOKEN="figd_..."
export FIGMA_TEAM_ID="<team_id>"
```

List projects for a team:

```sh
npx . --list-projects
```

List files in a project:

```sh
npx . --list-project-files --project-id <project_id>
```

List files in all team projects:

```sh
npx . --list-all-project-files
```

List published component sets in a team:

```sh
npx . --list-all-component-sets
```

List pages in a file:

```sh
npx . --list-pages --file-key <file_key>
```

List component sets in a file:

```sh
npx . --list-file-component-sets --file-key <file_key>
```

List nested component sets exposed in a component set:

```sh
npx . --list-component-set-properties --file-key <file_key> --node-id <node_id> --component-set-name Cell --json
```

Inspect raw JSON for a COMPONENT_SET node in a page tree:

```sh
npx . --inspect-component-set --file-key <file_key> --node-id <node_id> --component-set-key <component_set_key>
npx . --inspect-component-set --file-key <file_key> --node-id <node_id> --component-set-name Toast
```

Inspect raw JSON for a node (page, frame, etc.):

```sh
npx . --inspect-node --file-key <file_key> --node-id <node_id>
```

For script-friendly output:

```sh
npx . --list-projects --json
npx . --list-project-files --project-id <project_id> --json
npx . --list-all-project-files --json
npx . --list-all-component-sets --json
npx . --list-pages --file-key <file_key> --json
npx . --list-file-component-sets --file-key <file_key> --json
```
