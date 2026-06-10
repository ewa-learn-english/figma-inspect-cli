export const usage = `Usage:
  figma-inspect --list-team-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-team-project-files [--json]
  figma-inspect --list-team-component-sets [--json]
  figma-inspect --list-file-pages --file-key <key> [--json]
  figma-inspect --list-file-component-sets --file-key <key> [--json]
  figma-inspect --inspect-component-set-properties --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-component-set --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-team-component-set (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-file-node --file-key <key> --node-id <id> [--json]
  figma-inspect --build-component-set-spec --input <path> [--variables <path>] [--team-components <path>] [--json]
  figma-inspect --build-component-set-pseudocode --input <path> [--output-dir <dir>] [--variables <path>] [--team-components <path>] [--json]
  figma-inspect --export-component-set --output-dir <dir> (--component-set-key <key> | --component-set-name <name>) [--variables <path>] [--export-assets] [--asset-format svg] [--json]

Environment:
  FIGMA_API_TOKEN  Figma personal access token
  FIGMA_TEAM_ID    Figma team id (required for --list-team-projects, --list-team-project-files, --list-team-component-sets, and --inspect-team-component-set)
  FIGMA_CACHE      Set to 0 to disable the on-disk response cache (enabled by default)

Options:
  --list-team-projects            List projects in a Figma team
  --list-project-files            List files in a Figma project
  --list-team-project-files       List files in all team projects
  --list-team-component-sets      List published component sets in a Figma team
  --list-file-pages               List pages in a Figma file
  --list-file-component-sets      List component sets in a Figma file
  --inspect-component-set-properties List nested component sets exposed in a component set
  --inspect-component-set         Print raw YAML for a COMPONENT_SET node in a file tree
  --inspect-team-component-set    Find a published component set by name or key and print its raw YAML
  --inspect-file-node             Print raw YAML for a file node
  --build-component-set-spec      Build an AI-friendly spec from a local COMPONENT_SET JSON file; prints YAML by default
  --build-component-set-pseudocode Build component contracts from a local COMPONENT_SET JSON file; writes <ComponentName>.contract.{visuals,geometry,meta,assets?}.yaml and <ComponentName>.contract.structure.dsl
  --export-component-set          Export raw data and component contract files for a published team component set as YAML; with --export-assets also writes <ComponentName>.contract.assets.yaml and SVG files
  --export-assets                 Export one SVG asset per component variant via the Figma Images API (with --export-component-set)
  --asset-format <format>         Asset export format; currently supports svg (default when --export-assets is set)
  --input <path>                  Input JSON file path (required with --build-component-set-spec and --build-component-set-pseudocode)
  --output-dir <dir>              Output directory (optional with --build-component-set-pseudocode; defaults to the input file directory)
  --output-dir <dir>              Output directory (required with --export-component-set)
  --variables <path>              Variables export JSON (optional with --build-component-set-spec and --export-component-set)
  --team-components <path>        Team component sets JSON (optional with --build-component-set-spec and --build-component-set-pseudocode)
  --project-id <id>               Project id (required with --list-project-files)
  --file-key <key>                File key (required with --list-file-pages, --list-file-component-sets, --inspect-component-set-properties, --inspect-component-set, and --inspect-file-node)
  --node-id <id>                  Node id (required with --inspect-component-set-properties, --inspect-component-set, and --inspect-file-node)
  --component-set-key <key>       Component set key (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-name is set; also works with --inspect-team-component-set and --export-component-set)
  --component-set-name <n>        Component set name (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-key is set; also works with --inspect-team-component-set and --export-component-set)
  --json                          Print or write JSON instead of the default YAML
  --help, -h                      Show this help message
`;
