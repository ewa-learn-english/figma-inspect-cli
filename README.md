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

List pages in a file:

```sh
npx . --list-pages --file-key <file_key>
```

For script-friendly output:

```sh
npx . --list-projects --json
npx . --list-project-files --project-id <project_id> --json
npx . --list-pages --file-key <file_key> --json
```
