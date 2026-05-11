import path from 'node:path';
import { homedir } from 'node:os';

export const packageName = '@12ui/codex-design';
export const binaryName = 'codex-design';
export const pluginMarketplaceName = '12ui';
export const pluginName = '12ui-design';

export const resolveInstallPaths = (homeDir = homedir()) => {
  const dataHome = process.env.XDG_DATA_HOME?.trim() || path.join(homeDir, '.local', 'share');
  const installRoot = path.join(dataHome, '12ui', 'codex-design');
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex');
  const pluginMarketplaceRoot = path.join(installRoot, 'marketplace');
  const pluginRoot = path.join(pluginMarketplaceRoot, 'plugins', pluginName);
  return {
    codexConfigPath: path.join(codexHome, 'config.toml'),
    codexHome,
    codexSkillsRefreshDir: path.join(codexHome, 'skills'),
    codexSkillsRefreshMarkerPath: path.join(codexHome, 'skills', '.12ui-design-refresh'),
    homeDir,
    installRoot,
    launcherDir: path.join(homeDir, '.local', 'bin'),
    launcherPath: path.join(homeDir, '.local', 'bin', binaryName),
    installedBinPath: path.join(installRoot, 'node_modules', '.bin', binaryName),
    userSkillDir: path.join(homeDir, '.agents', 'skills', 'design'),
    userSkillPath: path.join(homeDir, '.agents', 'skills', 'design', 'SKILL.md'),
    userSkillAgentDir: path.join(homeDir, '.agents', 'skills', 'design', 'agents'),
    userSkillAgentPath: path.join(homeDir, '.agents', 'skills', 'design', 'agents', 'openai.yaml'),
    legacyCodexSkillDir: path.join(codexHome, 'skills', 'design'),
    pluginAssetDir: path.join(pluginRoot, 'assets'),
    pluginIconPath: path.join(pluginRoot, 'assets', '12ui-icon.svg'),
    pluginLogoPath: path.join(pluginRoot, 'assets', '12ui-logo.svg'),
    pluginManifestDir: path.join(pluginRoot, '.codex-plugin'),
    pluginManifestPath: path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
    pluginMarketplaceMetaDir: path.join(pluginMarketplaceRoot, '.agents', 'plugins'),
    pluginMarketplacePath: path.join(pluginMarketplaceRoot, '.agents', 'plugins', 'marketplace.json'),
    pluginMarketplaceRoot,
    pluginCacheDir: path.join(codexHome, 'plugins', 'cache', pluginMarketplaceName, pluginName),
    pluginSkillDir: path.join(pluginRoot, 'skills', 'design'),
    pluginSkillPath: path.join(pluginRoot, 'skills', 'design', 'SKILL.md'),
  };
};
