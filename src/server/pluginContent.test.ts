import { describe, expect, it } from 'vitest';
import {
  DESIGN_PLUGIN_MARKETPLACE_JSON,
  DESIGN_PLUGIN_NAME,
  DESIGN_PLUGIN_SKILL_MARKDOWN,
  designPluginJson,
} from './pluginContent.js';

describe('pluginContent', () => {
  it('builds a valid marketplace entry for the 12ui design plugin', () => {
    const marketplace = JSON.parse(DESIGN_PLUGIN_MARKETPLACE_JSON) as {
      name: string;
      plugins: Array<{ name: string; source: { path: string }; policy: Record<string, string>; category: string }>;
    };

    expect(marketplace.name).toBe('12ui');
    expect(marketplace.plugins).toEqual([
      {
        name: DESIGN_PLUGIN_NAME,
        source: {
          source: 'local',
          path: './plugins/12ui-design',
        },
        policy: {
          installation: 'INSTALLED_BY_DEFAULT',
          authentication: 'ON_INSTALL',
        },
        category: 'Design',
      },
    ]);
  });

  it('builds a plugin manifest with interface assets', () => {
    const manifest = JSON.parse(designPluginJson('0.1.3')) as {
      name: string;
      version: string;
      skills: string;
      interface: { displayName: string; composerIcon: string; logo: string };
    };

    expect(manifest.name).toBe('12ui-design');
    expect(manifest.version).toBe('0.1.3');
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.interface.displayName).toBe('12ui Design');
    expect(manifest.interface.composerIcon).toBe('./assets/12ui-icon.svg');
    expect(manifest.interface.logo).toBe('./assets/12ui-logo.svg');
  });

  it('keeps the plugin skill present but marked as installer-disabled', () => {
    expect(DESIGN_PLUGIN_SKILL_MARKDOWN).toContain('codex-design launch --json');
    expect(DESIGN_PLUGIN_SKILL_MARKDOWN).toContain('plain $design skill remains the only autocomplete entry');
  });
});
