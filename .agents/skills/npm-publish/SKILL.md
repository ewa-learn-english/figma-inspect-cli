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

1. Inspect local state and npm access first:

   ```sh
   git status --short
   npm whoami
   ```

   If `npm whoami` returns `E401`, run `npm login --auth-type=web` and let the
   user complete the browser flow. Never ask for or print npm tokens.

2. Validate and commit all release-intended changes before choosing the version:

   ```sh
   npm run check
   npm run build
   git status --short
   git add <release files>
   git commit -m "Update ..."
   git status --short
   ```

   The working tree must be clean before the version is selected or tagged. If
   unrelated user changes are present, do not stage or revert them; either leave
   them out of the release commit or ask the user how to proceed if a clean tree
   is impossible. If there are no release-intended changes and `git status
   --short` is already empty, skip the commit and continue.

3. Choose the next version.

   Do not republish an already-published version. If the user did not specify a
   version, use normal semver judgment: patch for fixes/docs/packaging, minor for
   new CLI behavior, major for breaking CLI or artifact contract changes.

   Check both npm and local git tags before deciding:

   ```sh
   npm view figma-inspect-cli version bin dist-tags --json
   node -p "require('./package.json').version"
   git tag --list "v*" --sort=-v:refname
   ```

4. Apply the version, run final package validation, then commit and tag the
   release.

   Update package version files without creating a tag yet, because the final
   build and dry-run must be part of the release state:

   ```sh
   npm version <next-version> --no-git-tag-version
   npm run build
   npm pack --dry-run --json
   ```

   Confirm the dry-run tarball includes `README.md`, `package.json`, and `dist/`,
   and that `dist/bin/figma-inspect.js` is executable. Source maps are currently
   included; do not change packaging unless the user asks.

   ```sh
   git status --short
   git add package.json package-lock.json
   git commit -m "Release v<next-version>"
   git tag v<next-version>
   git status --short
   git tag --points-at HEAD
   ```

   `dist/` is intentionally ignored by git, but must be current on disk for
   `npm pack` and `npm publish`. The tag must be a semver tag in `vX.Y.Z` form,
   such as `v0.1.2`, and must point at the release commit. If `git status
   --short` is not clean after tagging, resolve that before publishing.

5. Publish only after the release commit and `vX.Y.Z` tag exist locally:

   ```sh
   npm publish
   ```

   npm may prompt for web authentication or 2FA with a URL. Press Enter to open
   the browser flow if needed, then wait for the same publish process to finish.

6. Verify the published package:

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
