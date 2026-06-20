---
name: npm-publish
description: Publish or update the figma-inspect-cli npm package. Use when the user asks to publish, release, bump, update, republish, or verify the npm-distributed CLI package, including npmjs access from another repository.
---

# Npm Publish

Publish `figma-inspect-cli` as the npm package `figma-inspect-cli`, whose CLI
binary is `figma-inspect`.

## Known Package Facts

- The package is public on npm as `figma-inspect-cli`.
- The first published version is `0.1.0`, under npm user `sc0rch`.
- `package.json` should keep `bin.figma-inspect` pointing at `dist/bin/figma-inspect.js`.
- npm may warn and auto-normalize `./dist/bin/figma-inspect.js`; prefer the no-`./` form.
- `prepublishOnly` runs `npm run build`, but still run checks and build before publishing.

## Workflow

1. Inspect local state first:

   ```sh
   git status --short
   npm whoami
   npm view figma-inspect-cli version bin dist-tags --json
   ```

   If `npm whoami` returns `E401`, run `npm login --auth-type=web` and let the
   user complete the browser flow. Never ask for or print npm tokens.

2. Choose the version before publishing.

   Do not republish an already-published version. If the user did not specify a
   version, use normal semver judgment: patch for fixes/docs/packaging, minor for
   new CLI behavior, major for breaking CLI or artifact contract changes.

   Prefer a non-tagging bump unless the user asked for a git release:

   ```sh
   npm version patch --no-git-tag-version
   ```

3. Run required validation from the repo root:

   ```sh
   npm run check
   npm run build
   npm pack --dry-run --json
   ```

   Confirm the dry-run tarball includes `README.md`, `package.json`, and `dist/`,
   and that `dist/bin/figma-inspect.js` is executable. Source maps are currently
   included; do not change packaging unless the user asks.

4. Publish:

   ```sh
   npm publish
   ```

   npm may prompt for web authentication or 2FA with a URL. Press Enter to open
   the browser flow if needed, then wait for the same publish process to finish.

5. Verify the published package:

   ```sh
   npm view figma-inspect-cli@<version> name version bin dist-tags --json
   npm exec --yes --package=figma-inspect-cli@<version> -- figma-inspect --help
   ```

   Run the `npm exec` verification from `/tmp` or another external directory,
   not from this repository. Because this repo has the same package name, running
   `npm exec --package=figma-inspect-cli ...` here can fail to expose the
   published package binary even when the published package is healthy.

## Project-Specific Guardrails

- If CLI commands, flags, or env requirements changed, update `src/cli/usage.ts`,
  `src/cli/parse-args.ts`, `README.md`, and `.agents/skills/live-test/SKILL.md`
  as applicable.
- Do not run live Figma API checks unless the user explicitly invokes
  `live-test`.
- After code changes, leave `dist/` current with `npm run build`.
- Respect unrelated local changes; do not revert user work while preparing a
  release.

## Report

Report the published package name and version, the npm URL, validation results,
and the exact external install/exec command that passed.
