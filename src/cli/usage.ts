export const usage = `Usage:
  figma-inspect --list-team-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-team-project-files [--json]
  figma-inspect --list-team-component-sets [--json]
  figma-inspect --list-file-pages --file-key <key> [--json]
  figma-inspect --list-file-component-sets --file-key <key> [--json]
  figma-inspect --inspect-component-set-properties --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-component-set --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>)
  figma-inspect --inspect-file-node --file-key <key> --node-id <id>

Environment:
  FIGMA_API_TOKEN  Figma personal access token
  FIGMA_TEAM_ID    Figma team id (required for --list-team-projects, --list-team-project-files, and --list-team-component-sets)
  FIGMA_CACHE      Set to 0 to disable the on-disk response cache (enabled by default)

Options:
  --list-team-projects            List projects in a Figma team
  --list-project-files            List files in a Figma project
  --list-team-project-files       List files in all team projects
  --list-team-component-sets      List published component sets in a Figma team
  --list-file-pages               List pages in a Figma file
  --list-file-component-sets      List component sets in a Figma file
  --inspect-component-set-properties List nested component sets exposed in a component set
  --inspect-component-set         Print raw JSON for a COMPONENT_SET node in a file tree
  --inspect-file-node             Print raw JSON for a file node
  --project-id <id>               Project id (required with --list-project-files)
  --file-key <key>                File key (required with --list-file-pages, --list-file-component-sets, --inspect-component-set-properties, --inspect-component-set, and --inspect-file-node)
  --node-id <id>                  Node id (required with --inspect-component-set-properties, --inspect-component-set, and --inspect-file-node)
  --component-set-key <key>       Component set key (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-name is set)
  --component-set-name <n>        Component set name (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-key is set)
  --json                          Print JSON instead of a table
  --help, -h                      Show this help message
`;
