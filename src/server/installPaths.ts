import path from 'node:path';
import { homedir } from 'node:os';

export const packageName = '@12ui/codex-design';
export const binaryName = 'codex-design';

export const resolveInstallPaths = (homeDir = homedir()) => {
  const dataHome = process.env.XDG_DATA_HOME?.trim() || path.join(homeDir, '.local', 'share');
  const installRoot = path.join(dataHome, '12ui', 'codex-design');
  return {
    homeDir,
    installRoot,
    launcherDir: path.join(homeDir, '.local', 'bin'),
    launcherPath: path.join(homeDir, '.local', 'bin', binaryName),
    installedBinPath: path.join(installRoot, 'node_modules', '.bin', binaryName),
    codexSkillDir: path.join(homeDir, '.codex', 'skills', 'design'),
    codexSkillPath: path.join(homeDir, '.codex', 'skills', 'design', 'SKILL.md'),
    codexAgentDir: path.join(homeDir, '.codex', 'skills', 'design', 'agents'),
    codexAgentPath: path.join(homeDir, '.codex', 'skills', 'design', 'agents', 'openai.yaml'),
  };
};
