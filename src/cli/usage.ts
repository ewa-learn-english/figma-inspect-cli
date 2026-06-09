export const usage = `Usage:
  figma-inspect --list-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-pages --file-key <key> [--json]
  figma-inspect --list-component-sets --file-key <key> --node-id <id> [--json]
  figma-inspect --list-component-set-properties --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-component-set --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>)
  figma-inspect --inspect-node --file-key <key> --node-id <id>

Environment:
  FIGMA_API_TOKEN  Figma personal access token
  FIGMA_TEAM_ID    Figma team id (required for --list-projects)

Options:
  --list-projects       List projects in a Figma team
  --list-project-files  List files in a Figma project
  --list-pages          List pages in a Figma file
  --list-component-sets   List component sets in a file node
  --list-component-set-properties List nested component sets exposed in a component set
  --inspect-component-set Print raw JSON for a COMPONENT_SET node in a file tree
  --inspect-node          Print raw JSON for a file node
  --project-id <id>       Project id (required with --list-project-files)
  --file-key <key>        File key (required with --list-pages, --list-component-sets, --list-component-set-properties, --inspect-component-set, and --inspect-node)
  --node-id <id>          Node id (required with --list-component-sets, --list-component-set-properties, --inspect-component-set, and --inspect-node)
  --component-set-key <key> Component set key (required with --list-component-set-properties and --inspect-component-set unless --component-set-name is set)
  --component-set-name <n>  Component set name (required with --list-component-set-properties and --inspect-component-set unless --component-set-key is set)
  --json                Print JSON instead of a table
  --help, -h            Show this help message
`;
