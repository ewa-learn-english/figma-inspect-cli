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

For script-friendly output:

```sh
npx . --list-projects --json
```
