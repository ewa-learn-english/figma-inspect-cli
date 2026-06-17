export const usage = `Usage:
  figma-inspect --list-team-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-team-project-files [--json]
  figma-inspect --list-team-component-sets [--json]
  figma-inspect --list-file-pages --file-key <key> [--json]
  figma-inspect --list-file-component-sets --file-key <key> [--json]
  figma-inspect --inspect-component-set-properties (--url <figma-url> | --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>)) [--json]
  figma-inspect --inspect-component-set (--url <figma-url> | --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>)) [--json]
  figma-inspect --inspect-team-component-set (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-file-node (--url <figma-url> | --file-key <key> --node-id <id>) [--json]
  figma-inspect --build-component-set-spec --input <path> --variables <path> [--team-components <path>] [--json]
  figma-inspect --build-component-set-pseudocode --input <path> --variables <path> [--output-dir <dir>] [--team-components <path>] [--json]
  figma-inspect --verify-component-contract --contract-dir <dir> [--component-name <name>] [--json]
  figma-inspect --verify-node-contract --contract-dir <dir> [--node-name <name>] [--json]
  figma-inspect --export-component-set --output-dir <dir> --variables <path> (--url <figma-url> | --component-set-key <key> | --component-set-name <name>) [--export-assets] [--asset-format svg] [--json]
  figma-inspect --export-node-contract --output-dir <dir> --variables <path> (--url <figma-url> | --file-key <key> --node-id <id>) [--json]

Environment:
  FIGMA_API_TOKEN  Figma personal access token (required for --verify-component-contract, --verify-node-contract, and all API commands below)
  FIGMA_TEAM_ID    Figma team id (required for --list-team-projects, --list-team-project-files, --list-team-component-sets, --inspect-team-component-set, and --export-component-set)
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
  --build-component-set-pseudocode Build component contracts from a local COMPONENT_SET JSON file; writes <ComponentName>.component-set.{visuals,geometry,meta}.yaml and <ComponentName>.component-set.structure.dsl
  --verify-component-contract     Compare lock files to live Figma via the API; validates local contract schema
  --verify-node-contract          Compare frame/component node lock files to live Figma via the API; validates local node contract schema
  --export-component-set          Export component contract files for a published team component set as YAML; writes <ComponentName>.component-set.lock.yaml; with --export-assets also writes <ComponentName>.assets/*.svg and stores asset paths in meta.yaml
  --export-node-contract          Export FRAME or standalone COMPONENT node contract files as YAML; writes <Name>.frame.* or <Name>.component.* plus lock
  --export-assets                 Export one SVG asset per component variant via the Figma Images API (with --export-component-set; variant props only, no TEXT layers)
  --asset-format <format>         Asset export format; currently supports svg (default when --export-assets is set)
  --input <path>                  Input JSON file path (required with --build-component-set-spec and --build-component-set-pseudocode)
  --output-dir <dir>              Output directory (optional with --build-component-set-pseudocode; defaults to the input file directory)
  --contract-dir <dir>            Contract directory (required with --verify-component-contract and --verify-node-contract)
  --component-name <name>         Component name (optional with --verify-component-contract; defaults to all lock files in --contract-dir)
  --node-name <name>              Node contract base name (optional with --verify-node-contract; defaults to all frame/component lock files in --contract-dir)
  --output-dir <dir>              Output directory (required with --export-component-set and --export-node-contract)
  --variables <path>              Variables export JSON (required with --build-component-set-spec, --build-component-set-pseudocode, --export-component-set, and --export-node-contract)
  --team-components <path>        Team component sets JSON (optional with --build-component-set-spec and --build-component-set-pseudocode)
  --url <figma-url>               Figma node URL; supports /design/<fileKey>/... and /file/<fileKey>/... with node-id
  --project-id <id>               Project id (required with --list-project-files)
  --file-key <key>                File key (required with --list-file-pages and --list-file-component-sets; also used with node inspect commands unless --url is set)
  --node-id <id>                  Node id (required with node inspect commands unless --url is set)
  --component-set-key <key>       Component set key (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-name is set; also works with --inspect-team-component-set and --export-component-set)
  --component-set-name <n>        Component set name (required with --inspect-component-set-properties and --inspect-component-set unless --component-set-key is set; also works with --inspect-team-component-set and --export-component-set)
  --json                          Print or write JSON instead of the default YAML
  --help, -h                      Show this help message
`;
