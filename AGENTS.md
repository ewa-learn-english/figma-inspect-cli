# figma-inspect-cli

Node.js CLI for inspecting Figma API resources.

## Stack

- TypeScript, ESM (`"type": "module"`, `NodeNext` resolution)
- Biome — lint and format
- knip — unused code and dependencies
- Node 24 LTS (Krypton)

## Layout

```
src/
  bin/figma-inspect.ts   # entry point
  cli.ts                 # argument parsing, output formatting
  figma-api/             # Figma REST client
```

Imports use `.js` extensions (compiled output paths).

## Commands

```sh
npm run dev              # run from source (tsx)
npm run build            # compile to dist/
npm run check            # biome check + knip
npm run format           # apply Biome formatting
```

## Conventions

- Keep changes focused; match existing style in surrounding code.
- Figma API logic stays in `src/figma-api/`, CLI wiring in `src/cli.ts`.
- Required env vars: `FIGMA_API_TOKEN`, `FIGMA_TEAM_ID`.
- Run `npm run check` before finishing; fix new issues you introduce.
