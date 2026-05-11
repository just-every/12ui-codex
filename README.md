# 12ui Codex Design

Standalone local design workflow for Codex.

`@12ui/codex-design` installs a local browser app and the `12ui Design` Codex plugin. Codex uses the app to generate UI design options, opens the returned URL in the Codex in-app browser, waits while the user chooses a design, then continues from the selected 12ui handover.

## Install

Install the local app, `codex-design` launcher, `12ui Design` plugin, and plain `$design` skill:

```bash
npx -y @12ui/codex-design install
```

You can also add the public plugin marketplace entry:

```bash
codex plugin marketplace add just-every/12ui-codex
```

`codex plugin marketplace add` registers the marketplace with Codex. It does not run the npm installer or create the plain `$design` skill by itself in current Codex builds, so use the `npx` installer for the full setup.

The installer:

- installs the local `codex-design` launcher
- installs and enables the `12ui Design` Codex plugin
- installs the plugin marketplace under `~/.local/share/12ui/codex-design/marketplace`
- installs the `$design` skill at `~/.agents/skills/design/SKILL.md` for Codex skill autocomplete
- removes the old loose `~/.codex/skills/design` skill install if present

## Default workflow

1. Codex runs:

```bash
codex-design launch --json
```

2. Codex creates a workspace:

```bash
cat <<'JSON' | codex-design create --json
{
  "prompt": "Create a clean mobile checkout screen for a premium coffee app.",
  "seedVariationCount": 3,
  "aspect": "portrait",
  "referenceDataUrls": []
}
JSON
```

3. Codex opens the returned `browserUrl`/`workspaceUrl` in the Codex in-app browser and shows the link to the user.

4. The user reviews generated designs in the in-app browser and clicks `Choose design`.

5. Codex waits for selection:

```bash
codex-design wait --workspace <workspaceId> --event seed_design_selected --timeout-ms 1800000
```

6. If 12ui is connected, HTML handover starts automatically after selection; otherwise the user connects 12ui or clicks `Handoff`.

7. Codex waits for handover:

```bash
codex-design wait --workspace <workspaceId> --event handover_completed,handover_failed --timeout-ms 1800000
```

8. Codex implements from the returned `handoverHtmlUrl`, `handoverUrl`, and `zipUrl` when present.

Do not start from a blank page. The handover assets are the implementation source of truth.

## Advanced workspace workflow

For multi-page app or site work:

1. Create/open the workspace.
2. Wait for `seed_design_selected`.
3. Plan pages through the local workspace API or UI.
4. Generate page variations.
5. Wait for `page_variation_selected`.
6. If 12ui is connected, HTML handover starts automatically after selection. Wait for `handover_completed`; otherwise the user connects 12ui or clicks `Handoff`.

## CLI commands

### `launch`

```bash
codex-design launch --json
```

Starts or reuses the local server and returns JSON with `origin`, `port`, `status`, `browserUrl`, and `userMessage`. Codex should open `browserUrl` in the in-app browser.

### `create`

```bash
cat request.json | codex-design create --json
```

Creates a workspace and starts seed generation.

Important response fields:

- `workspaceId`
- `workspaceUrl`
- `browserUrl`
- `seedRunId`
- `userMessage`

The `browserUrl`, `workspaceUrl`, and `userMessage` are user-facing. Open `browserUrl` in the Codex in-app browser and show the useful link/message to the user.

### `wait`

```bash
codex-design wait --workspace <workspaceId> --event seed_design_selected --timeout-ms 1800000
```

Waits for bridge events.

Supported event types:

- `seed_design_selected`
- `page_variation_selected`
- `handover_started`
- `handover_completed`
- `handover_failed`

### `context`

```bash
codex-design context --workspace <workspaceId>
```

Returns current workspace context and bridge status. Use this to resume interrupted work.

### `event-log`

```bash
codex-design event-log --workspace <workspaceId>
```

Returns persisted bridge events for recovery and debugging.

## Auto-port behavior

`codex-design launch` automatically finds and remembers a free port.

- It reuses the remembered server if it is still alive.
- If the remembered server is not alive, it scans for a free port.
- The default scan range is `9971-9999`.
- The remembered port is stored under `~/.12ui/codex-design/server/codex-design-server/server.json`.

Environment overrides:

```bash
CODEX_12UI_PORT=9985 codex-design launch --json
CODEX_12UI_PORT_RANGE=10000-10100 codex-design launch --json
CODEX_12UI_DATA_DIR=/path/to/data codex-design launch --json
```

## Development

```bash
pnpm install
pnpm run dev
```

Useful checks:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Package smoke:

```bash
npm pack --dry-run
node dist/server/server/cli.js launch --json
```

## Release

The release workflow is `.github/workflows/release.yml`.

On relevant pushes to `main`, it:

- installs dependencies
- runs typecheck, tests, and build
- bumps the package version
- tags `codex-design-vX.Y.Z`
- publishes `@12ui/codex-design` to npm
- creates a GitHub Release

Required GitHub secret:

- `NPM_TOKEN`

Optional GitHub secret:

- `GH_PAT`, if branch protection blocks `GITHUB_TOKEN` from pushing release commits or tags
