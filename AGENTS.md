# AGENTS.md

Instructions for agents working in this repository.

## Project

This repo contains the standalone 12ui Codex Design app and installer package.

- npm package: `@12ui/codex-design`
- CLI binary: `codex-design`
- installed Codex skill: `$design`
- local app: browser UI for generating design options, letting the user select one, and producing a 12ui handover

## Non-negotiable coding rules

- NEVER write mock code or fallback behavior to solve issues.
- Mock data is allowed in test suites only.
- If a local server, design generation, selection, handover, or installer step fails, surface the real failure.
- Prefer removing deprecated code instead of hiding it behind feature flags or compatibility wrappers.
- Do not keep old code paths around unless there is a strong current reason.
- NEVER write large monolithic files.
- Decouple logic into focused files, especially CLI, installer, server API, shared types, and UI behavior.

## LLM failure policy

If an LLM request does not work as expected, treat it as one of:

1. A failure of instructions, context, or input.
2. A failure of output schema design.
3. A failure to handle edge cases in results.

Modern LLMs are accurate when the request shape is right. Fix the request, schema, and edge handling instead of adding fallbacks.

## Skill and CLI contract

The `$design` skill depends on the local CLI contract.

- `codex-design launch --json` starts or reuses the local server and returns a user-facing `browserUrl` for the app.
- `codex-design create --json` creates a workspace, starts seed generation, and returns user-facing `browserUrl`/`workspaceUrl` fields.
- `codex-design wait --workspace <id> --event <events> --timeout-ms <ms>` waits on bridge events.
- `codex-design context --workspace <id>` and `codex-design event-log --workspace <id>` are recovery tools.

Every CLI response that includes `browserUrl`, `workspaceUrl`, `handoverHtmlUrl`, `handoverUrl`, `zipUrl`, or `userMessage` is user-facing. Codex should open `browserUrl`/workspace URLs in the Codex in-app browser and repeat the useful URL or message to the user so they can choose a design and click Handoff.

## Local server behavior

`codex-design launch` should not require users or agents to pick a port.

- Reuse the remembered server if it is alive.
- Otherwise find a free port in the configured range.
- Remember the selected port.
- Keep `CODEX_12UI_PORT` as an explicit override.
- Keep `CODEX_12UI_PORT_RANGE` as an optional range override.

## Local UI development

When reviewing or iterating on the browser UI from this repository, run the app in development mode, not production mode.

- Prefer `CODEX_12UI_PORT=9971 pnpm run dev` for the shared local review URL.
- If the server must stay running after the command returns, use a detached `screen` session that runs the dev command from the repo root.
- Do not use `NODE_ENV=production node dist/server/server/index.js` for local UI review unless the task is specifically to test the built package.
- Before telling the user the browser is updated, verify the HTML contains Vite dev entries such as `/@vite/client` and `/src/client/main.tsx`.
- If `127.0.0.1:9971` is serving `/assets/index-*.js`, it is the production bundle. Stop it and restart dev mode before continuing UI review.
- After frontend edits, reload the Codex in-app browser tab for the workspace. In dev mode, Vite should serve current source without requiring `pnpm run build`.

## Verification

Use focused checks:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

For CLI/package smoke checks:

```bash
node dist/server/server/cli.js launch --json
node dist/server/server/cli.js create --json
npm pack --dry-run
```

Do not mask failing checks. Fix real failures or report them directly.

## Release

The GitHub Actions release workflow publishes `@12ui/codex-design` on relevant pushes to `main`.

Required repository secret:

- `NPM_TOKEN`

Optional repository secret:

- `GH_PAT`, if branch protection prevents `GITHUB_TOKEN` from pushing version bump commits or tags.
