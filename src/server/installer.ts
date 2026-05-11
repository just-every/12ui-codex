import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { DESIGN_AGENT_OPENAI_YAML, DESIGN_SKILL_MARKDOWN } from './skillContent.js';
import { packageName, resolveInstallPaths } from './installPaths.js';
import { projectRoot } from './config.js';

const execFileAsync = promisify(execFile);

const packageVersion = async (): Promise<string> => {
  const raw = await readFile(`${projectRoot}/package.json`, 'utf8');
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
    throw new Error('Package version is missing.');
  }
  return parsed.version.trim();
};

const writeLauncher = async (launcherPath: string, installedBinPath: string): Promise<void> => {
  await writeFile(
    launcherPath,
    `#!/usr/bin/env sh\nexec "${installedBinPath}" "$@"\n`,
    'utf8',
  );
  await chmod(launcherPath, 0o755);
};

export const installCodexDesign = async (): Promise<{
  packageName: string;
  version: string;
  installRoot: string;
  launcherPath: string;
  skillPath: string;
}> => {
  const version = await packageVersion();
  const paths = resolveInstallPaths();
  await mkdir(paths.installRoot, { recursive: true });
  await execFileAsync('npm', [
    'install',
    '--prefix',
    paths.installRoot,
    '--omit=dev',
    `${packageName}@${version}`,
  ], { timeout: 180_000 });
  await mkdir(paths.launcherDir, { recursive: true });
  await writeLauncher(paths.launcherPath, paths.installedBinPath);
  await mkdir(paths.codexSkillDir, { recursive: true });
  await mkdir(paths.codexAgentDir, { recursive: true });
  await writeFile(paths.codexSkillPath, DESIGN_SKILL_MARKDOWN, 'utf8');
  await writeFile(paths.codexAgentPath, DESIGN_AGENT_OPENAI_YAML, 'utf8');
  return {
    packageName,
    version,
    installRoot: paths.installRoot,
    launcherPath: paths.launcherPath,
    skillPath: paths.codexSkillPath,
  };
};
