import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const codexPluginConfigBlock = (pluginKey: string): string => (
  `[plugins."${pluginKey}"]\nenabled = true\n`
);

export const withEnabledCodexPlugin = (rawConfig: string, pluginKey: string): string => {
  const block = codexPluginConfigBlock(pluginKey);
  const headerPattern = new RegExp(
    `(^|\\n)(\\[plugins\\."${escapeRegExp(pluginKey)}"\\]\\n[\\s\\S]*?)(?=\\n\\[[^\\n]+\\]|$)`,
  );
  const match = headerPattern.exec(rawConfig);
  if (!match) {
    const separator = rawConfig.trim() ? (rawConfig.endsWith('\n') ? '\n' : '\n\n') : '';
    return `${rawConfig}${separator}${block}`;
  }

  const existingBlock = match[2];
  const updatedBlock = /^enabled\s*=.*$/m.test(existingBlock)
    ? existingBlock.replace(/^enabled\s*=.*$/m, 'enabled = true')
    : `${existingBlock.trimEnd()}\nenabled = true\n`;
  return `${rawConfig.slice(0, match.index)}${match[1]}${updatedBlock}${rawConfig.slice(match.index + match[0].length)}`;
};

const disabledSkillConfigBlock = (skillPath: string): string => (
  `[[skills.config]]\npath = ${JSON.stringify(skillPath)}\nenabled = false\n`
);

export const withDisabledCodexSkill = (rawConfig: string, skillPath: string): string => {
  const pathPattern = escapeRegExp(JSON.stringify(skillPath));
  const blockPattern = new RegExp(
    `(^|\\n)(\\[\\[skills\\.config\\]\\]\\n[\\s\\S]*?path\\s*=\\s*${pathPattern}[\\s\\S]*?)(?=\\n\\[\\[skills\\.config\\]\\]|\\n\\[[^\\n]+\\]|$)`,
  );
  const match = blockPattern.exec(rawConfig);
  if (!match) {
    const separator = rawConfig.trim() ? (rawConfig.endsWith('\n') ? '\n' : '\n\n') : '';
    return `${rawConfig}${separator}${disabledSkillConfigBlock(skillPath)}`;
  }

  const existingBlock = match[2];
  const updatedBlock = /^enabled\s*=.*$/m.test(existingBlock)
    ? existingBlock.replace(/^enabled\s*=.*$/m, 'enabled = false')
    : `${existingBlock.trimEnd()}\nenabled = false\n`;
  return `${rawConfig.slice(0, match.index)}${match[1]}${updatedBlock}${rawConfig.slice(match.index + match[0].length)}`;
};

const readConfigOrEmpty = async (configPath: string): Promise<string> => (
  readFile(configPath, 'utf8').catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return '';
    throw error;
  })
);

export const updateCodexConfig = async (
  configPath: string,
  updater: (rawConfig: string) => string,
): Promise<void> => {
  const raw = await readConfigOrEmpty(configPath);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, updater(raw), 'utf8');
};

export const withEnabledCodexPluginAndDisableSkill = (
  rawConfig: string,
  pluginKey: string,
  skillPath: string,
): string => withDisabledCodexSkill(withEnabledCodexPlugin(rawConfig, pluginKey), skillPath);

export const enableCodexPluginAndDisableSkill = async (
  configPath: string,
  pluginKey: string,
  skillPath: string,
): Promise<void> => {
  await updateCodexConfig(
    configPath,
    (raw) => withEnabledCodexPluginAndDisableSkill(raw, pluginKey, skillPath),
  );
};
