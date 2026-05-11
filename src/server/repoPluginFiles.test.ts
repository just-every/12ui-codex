import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectRoot } from './config.js';
import {
  DESIGN_PLUGIN_ICON_SVG,
  DESIGN_PLUGIN_LOGO_SVG,
  DESIGN_PLUGIN_MARKETPLACE_JSON,
  DESIGN_PLUGIN_SKILL_MARKDOWN,
  designPluginJson,
} from './pluginContent.js';

const readRepoFile = (relativePath: string): Promise<string> => (
  readFile(path.join(projectRoot, relativePath), 'utf8')
);

describe('repo plugin files', () => {
  it('keeps the public marketplace files aligned with installer-generated content', async () => {
    const packageJson = JSON.parse(await readRepoFile('package.json')) as { version: string };

    await expect(readRepoFile('.agents/plugins/marketplace.json')).resolves.toBe(DESIGN_PLUGIN_MARKETPLACE_JSON);
    await expect(readRepoFile('plugins/12ui-design/.codex-plugin/plugin.json')).resolves.toBe(
      designPluginJson(packageJson.version),
    );
    await expect(readRepoFile('plugins/12ui-design/skills/design/SKILL.md')).resolves.toBe(
      DESIGN_PLUGIN_SKILL_MARKDOWN,
    );
    await expect(readRepoFile('plugins/12ui-design/assets/12ui-icon.svg')).resolves.toBe(DESIGN_PLUGIN_ICON_SVG);
    await expect(readRepoFile('plugins/12ui-design/assets/12ui-logo.svg')).resolves.toBe(DESIGN_PLUGIN_LOGO_SVG);
  });
});
