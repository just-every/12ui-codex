export const DESIGN_SKILL_MARKDOWN = `---
name: design
description: Create UI designs for web or mobile apps. Use this for visual UI direction, redesigns, landing pages, app screens, component concepts, and browser-mediated design selection before implementation.
---

# Design

Use the local 12ui Codex Design app to generate visual UI options, let the user choose in the browser, and continue implementation from the selected handover.

Never use mock design data or fallback handovers. If the local server, design generation, selection, or handover fails, surface the real failure.

## No-prompt flow: open the app

Use this when the user invokes \`$design\` with no prompt, or only asks to open, launch, or show the 12ui Codex Design app.

1. Ensure the local CLI is installed. If \`codex-design\` is not available on PATH, install it first:

\`\`\`bash
npx -y @12ui/codex-design install
\`\`\`

2. Launch or reuse the local server:

\`\`\`bash
codex-design launch --json
\`\`\`

3. Open the returned \`browserUrl\` in the Codex in-app browser immediately and repeat the URL to the user. Do not create a workspace and do not invent a design prompt.

## Default flow: single handover

1. Ensure the local CLI is installed. If \`codex-design\` is not available on PATH, install it first:

\`\`\`bash
npx -y @12ui/codex-design install
\`\`\`

2. Ensure the local server is running:

\`\`\`bash
codex-design launch --json
\`\`\`

3. Create a design workspace. Default to 3 seed designs unless the user asks for 1, 6, or 12:

\`\`\`bash
cat <<'JSON' | codex-design create --json
{
  "prompt": "<user design prompt>",
  "seedVariationCount": 3,
  "aspect": "portrait",
  "referenceDataUrls": []
}
JSON
\`\`\`

4. Open the returned \`browserUrl\` or \`workspaceUrl\` in the Codex in-app browser immediately. If the in-app browser is not already open, create/open an in-app browser tab and navigate to that URL. Also show the link to the user.

Every CLI response that includes a \`browserUrl\`, \`workspaceUrl\`, \`handoverHtmlUrl\`, \`handoverUrl\`, \`zipUrl\`, or \`userMessage\` is user-facing. Open \`browserUrl\`/workspace URLs in the Codex in-app browser and repeat the useful URL/message back to the user instead of keeping it only in tool output.

5. Wait for the user to select a design:

\`\`\`bash
codex-design wait --workspace <workspaceId> --event seed_design_selected --timeout-ms 1800000
\`\`\`

6. Tell the user the selected design was detected and ask them to click Handover in the browser. Then wait for completion:

\`\`\`bash
codex-design wait --workspace <workspaceId> --event handover_completed,handover_failed --timeout-ms 1800000
\`\`\`

7. If handover completed, use the returned \`handoverHtmlUrl\`, \`handoverUrl\`, and \`zipUrl\` as the source of truth for implementation. Do not start from a blank page.

## Advanced flow: workspace pages

Use this only when the user asks for multiple pages, a larger site/app flow, or page-by-page exploration.

1. Create/open the workspace as above.
2. Wait for \`seed_design_selected\`.
3. Plan pages through the local workspace API/UI.
4. For each page, wait for \`page_variation_selected\`.
5. Wait for \`handover_completed\` after the user clicks Handover for the selected page.

## Recovery

If interrupted, use:

\`\`\`bash
codex-design context --workspace <workspaceId>
codex-design event-log --workspace <workspaceId>
\`\`\`

Resume from the latest bridge event rather than restarting the design run.
`;

export const DESIGN_AGENT_OPENAI_YAML = `interface:
  display_name: "Design"
  short_description: "Create UI designs with 12ui"
  brand_color: "#0f172a"
  default_prompt: "Use $design to create UI designs, open the local 12ui Codex Design app, and continue from the selected handover."
`;
