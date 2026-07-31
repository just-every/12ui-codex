# AGENTS.md

Instructions for agents working in this repository.

## Project status

This repository now contains only the retirement tombstone for the former
standalone 12ui Codex Design app and installer.

- npm package: `@12ui/codex-design`
- tombstone version: `0.1.11`
- retained binary: `codex-design`
- supported replacement: `npx -y @12ui/design skill install`

The app, plugin, marketplace entry, and `$design` implementation were removed
from the repository tip. Their history remains available in commits and release
tags through `codex-design-v0.1.10`; do not restore those obsolete paths to the
tombstone.

## Tombstone contract

- Every `codex-design` invocation prints the supported migration command to
  stderr and exits nonzero.
- The npm package contains only `package.json`, `README.md`, and
  `bin/codex-design.js`.
- Keep the package free of runtime and development dependencies.
- Keep tests and release automation in the repository, outside the npm payload.
- Do not add compatibility behavior, app startup, plugin installation, or
  command-specific success paths.

## Verification

```bash
npm run verify
node bin/codex-design.js
```

The direct binary invocation must exit with status `1`.

## Release

The release workflow is manual and fixed to the version already declared in
`package.json`. Publishing, npm deprecation, repository archival, tagging, and
pushing require explicit authorization.
