import { execFile } from 'node:child_process';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { enableCodexPluginAndDisableSkill } from './codexConfig.js';
import {
  DESIGN_PLUGIN_ICON_SVG,
  DESIGN_PLUGIN_KEY,
  DESIGN_PLUGIN_LOGO_SVG,
  DESIGN_PLUGIN_MARKETPLACE_JSON,
  DESIGN_PLUGIN_SKILL_MARKDOWN,
  designPluginJson,
} from './pluginContent.js';
import { DESIGN_AGENT_OPENAI_YAML, DESIGN_SKILL_MARKDOWN } from './skillContent.js';

const execFileAsync = promisify(execFile);

type DesignPluginInstallPaths = {
  codexHome: string;
  codexConfigPath: string;
  codexSkillsRefreshDir: string;
  codexSkillsRefreshMarkerPath: string;
  legacyCodexSkillDir: string;
  pluginAssetDir: string;
  pluginIconPath: string;
  pluginLogoPath: string;
  pluginManifestDir: string;
  pluginManifestPath: string;
  pluginMarketplaceMetaDir: string;
  pluginMarketplacePath: string;
  pluginMarketplaceRoot: string;
  pluginCacheDir: string;
  pluginSkillDir: string;
  pluginSkillPath: string;
  userSkillAgentDir: string;
  userSkillAgentPath: string;
  userSkillDir: string;
  userSkillPath: string;
};

export const writeDesignPluginBundle = async (
  paths: DesignPluginInstallPaths,
  version: string,
): Promise<void> => {
  await mkdir(paths.pluginMarketplaceMetaDir, { recursive: true });
  await mkdir(paths.pluginManifestDir, { recursive: true });
  await mkdir(paths.pluginSkillDir, { recursive: true });
  await mkdir(paths.pluginAssetDir, { recursive: true });
  await writeFile(paths.pluginMarketplacePath, DESIGN_PLUGIN_MARKETPLACE_JSON, 'utf8');
  await writeFile(paths.pluginManifestPath, designPluginJson(version), 'utf8');
  await writeFile(paths.pluginSkillPath, DESIGN_PLUGIN_SKILL_MARKDOWN, 'utf8');
  await writeFile(paths.pluginIconPath, DESIGN_PLUGIN_ICON_SVG, 'utf8');
  await writeFile(paths.pluginLogoPath, DESIGN_PLUGIN_LOGO_SVG, 'utf8');
};

const writeCachedDesignPluginBundle = async (
  paths: DesignPluginInstallPaths,
  version: string,
): Promise<void> => {
  const cacheRoot = path.join(paths.pluginCacheDir, version);
  const cacheManifestDir = path.join(cacheRoot, '.codex-plugin');
  const cacheSkillDir = path.join(cacheRoot, 'skills', 'design');
  const cacheAssetDir = path.join(cacheRoot, 'assets');
  await mkdir(cacheManifestDir, { recursive: true });
  await mkdir(cacheSkillDir, { recursive: true });
  await mkdir(cacheAssetDir, { recursive: true });
  await writeFile(path.join(cacheManifestDir, 'plugin.json'), designPluginJson(version), 'utf8');
  await writeFile(path.join(cacheSkillDir, 'SKILL.md'), DESIGN_PLUGIN_SKILL_MARKDOWN, 'utf8');
  await writeFile(path.join(cacheAssetDir, '12ui-icon.svg'), DESIGN_PLUGIN_ICON_SVG, 'utf8');
  await writeFile(path.join(cacheAssetDir, '12ui-logo.svg'), DESIGN_PLUGIN_LOGO_SVG, 'utf8');
};

const writeUserDesignSkill = async (paths: DesignPluginInstallPaths): Promise<void> => {
  await mkdir(paths.userSkillDir, { recursive: true });
  await mkdir(paths.userSkillAgentDir, { recursive: true });
  await writeFile(paths.userSkillPath, DESIGN_SKILL_MARKDOWN, 'utf8');
  await writeFile(paths.userSkillAgentPath, DESIGN_AGENT_OPENAI_YAML, 'utf8');
};

const signalCodexSkillsRefresh = async (paths: DesignPluginInstallPaths): Promise<void> => {
  await mkdir(paths.codexSkillsRefreshDir, { recursive: true });
  await writeFile(paths.codexSkillsRefreshMarkerPath, `${new Date().toISOString()}\n`, 'utf8');
};

export const installDesignPlugin = async (
  paths: DesignPluginInstallPaths,
  version: string,
): Promise<void> => {
  await writeDesignPluginBundle(paths, version);
  await rm(paths.legacyCodexSkillDir, { recursive: true, force: true });
  await rm(paths.pluginCacheDir, { recursive: true, force: true });
  await writeCachedDesignPluginBundle(paths, version);
  await writeUserDesignSkill(paths);
  await signalCodexSkillsRefresh(paths);
  await mkdir(paths.codexHome, { recursive: true });
  await execFileAsync('codex', [
    'plugin',
    'marketplace',
    'add',
    paths.pluginMarketplaceRoot,
  ], { timeout: 60_000 });
  await enableCodexPluginAndDisableSkill(
    paths.codexConfigPath,
    DESIGN_PLUGIN_KEY,
    path.join(paths.pluginCacheDir, version, 'skills', 'design', 'SKILL.md'),
  );
};
