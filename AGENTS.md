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
  cli/                   # argument parsing, output formatting
  figma-api/             # Figma REST client (HTTP only)
  inspect/               # inspection logic on top of API responses
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
- Figma API requests stay in `src/figma-api/`, inspection logic in `src/inspect/`, CLI wiring in `src/cli/`.
- Required env vars: `FIGMA_API_TOKEN`, `FIGMA_TEAM_ID`.
- API responses are cached on disk under the system temp directory (`figma-inspect-cli-cache/`). Set `FIGMA_CACHE=0` to disable.
- Run `npm run check` before finishing; fix new issues you introduce.
- After code changes, always run `npm run build` so the user has an up-to-date `dist/`.

## Skills

Project skills live in `.agents/skills/`.

- **live-test** — live end-to-end CLI checks against the Figma API. Invoke explicitly in chat when you need to verify commands (`/live-test`, "live-test"). When you add, remove, or change CLI commands or flags, update `.agents/skills/live-test/SKILL.md` in the same change (command table, examples, fixture notes). Keep it aligned with `src/cli/usage.ts`.

## Commits

1. Format: `<ImperativeVerb> <description>`.
2. Start with imperative verb (`Add`, `Fix`, `Update`, `Remove`, `Refactor`, etc.).
3. Do not add trailing period to commit header.
4. Use sentence case.
5. Do not include ticket ID in commit header.
6. Optional body explains why, not what.
7. English only.
