import { describe, expect, it } from 'vitest';
import {
  withDisabledCodexSkill,
  withEnabledCodexPlugin,
  withEnabledCodexPluginAndDisableSkill,
} from './codexConfig.js';

describe('withEnabledCodexPlugin', () => {
  it('appends the enabled plugin block when it is missing', () => {
    expect(withEnabledCodexPlugin('model = "gpt-5.5"\n', '12ui-design@12ui')).toBe([
      'model = "gpt-5.5"',
      '',
      '[plugins."12ui-design@12ui"]',
      'enabled = true',
      '',
    ].join('\n'));
  });

  it('turns an existing disabled plugin block on without duplicating it', () => {
    const updated = withEnabledCodexPlugin([
      '[plugins."12ui-design@12ui"]',
      'enabled = false',
      '',
      '[marketplaces.12ui]',
      'source_type = "local"',
      '',
    ].join('\n'), '12ui-design@12ui');

    expect(updated.match(/\[plugins\."12ui-design@12ui"\]/g)).toHaveLength(1);
    expect(updated).toContain('[plugins."12ui-design@12ui"]\nenabled = true');
    expect(updated).toContain('[marketplaces.12ui]');
  });

  it('adds enabled to an existing plugin block that has no enabled setting', () => {
    expect(withEnabledCodexPlugin('[plugins."12ui-design@12ui"]\n', '12ui-design@12ui')).toBe(
      '[plugins."12ui-design@12ui"]\nenabled = true\n',
    );
  });
});

describe('withDisabledCodexSkill', () => {
  const skillPath = '/Users/demo/.codex/plugins/cache/12ui/12ui-design/0.1.3/skills/design/SKILL.md';

  it('appends a disabled skill config block when it is missing', () => {
    expect(withDisabledCodexSkill('model = "gpt-5.5"\n', skillPath)).toBe([
      'model = "gpt-5.5"',
      '',
      '[[skills.config]]',
      `path = ${JSON.stringify(skillPath)}`,
      'enabled = false',
      '',
    ].join('\n'));
  });

  it('turns an existing skill config off without duplicating it', () => {
    const updated = withDisabledCodexSkill([
      '[[skills.config]]',
      `path = ${JSON.stringify(skillPath)}`,
      'enabled = true',
      '',
      '[features]',
      'goals = true',
      '',
    ].join('\n'), skillPath);

    expect(updated.match(/\[\[skills\.config\]\]/g)).toHaveLength(1);
    expect(updated).toContain(`path = ${JSON.stringify(skillPath)}\nenabled = false`);
    expect(updated).toContain('[features]');
  });
});

describe('withEnabledCodexPluginAndDisableSkill', () => {
  it('updates both plugin and skill config in one pass', () => {
    const updated = withEnabledCodexPluginAndDisableSkill(
      '',
      '12ui-design@12ui',
      '/tmp/plugin/skills/design/SKILL.md',
    );

    expect(updated).toContain('[plugins."12ui-design@12ui"]\nenabled = true');
    expect(updated).toContain('[[skills.config]]\npath = "/tmp/plugin/skills/design/SKILL.md"\nenabled = false');
  });
});
