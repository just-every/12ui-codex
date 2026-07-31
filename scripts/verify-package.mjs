import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
);
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const temporaryDirectory = mkdtempSync(
  path.join(os.tmpdir(), 'codex-design-tombstone-'),
);

try {
  const packResult = JSON.parse(execFileSync(
    npmExecutable,
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      temporaryDirectory,
    ],
    {
      cwd: packageRoot,
      encoding: 'utf8',
    },
  ))[0];

  assert.equal(packageJson.name, '@12ui/codex-design');
  assert.equal(packageJson.version, '0.1.11');
  assert.deepEqual(packageJson.bin, {
    'codex-design': 'bin/codex-design.js',
  });
  assert.equal('main' in packageJson, false);
  assert.equal('dependencies' in packageJson, false);
  assert.equal('devDependencies' in packageJson, false);

  const actualFiles = packResult.files
    .map(({ path: filePath }) => filePath)
    .sort();
  const expectedFiles = [
    'README.md',
    'bin/codex-design.js',
    'package.json',
  ];

  assert.deepEqual(actualFiles, expectedFiles);

  const tarballPath = path.join(temporaryDirectory, packResult.filename);
  execFileSync(
    'tar',
    ['-xzf', tarballPath, '-C', temporaryDirectory],
    { stdio: 'pipe' },
  );

  const packedBinaryPath = path.join(
    temporaryDirectory,
    'package',
    'bin',
    'codex-design.js',
  );
  const binaryResult = spawnSync(
    process.execPath,
    [packedBinaryPath, 'launch', '--json'],
    { encoding: 'utf8' },
  );

  assert.equal(binaryResult.status, 1);
  assert.equal(binaryResult.signal, null);
  assert.equal(binaryResult.stdout, '');
  assert.match(binaryResult.stderr, /@12ui\/codex-design has been retired\./);
  assert.match(
    binaryResult.stderr,
    /npx -y @12ui\/design skill install/,
  );

  console.log(
    `${packageJson.name}@${packageJson.version} package contents and`
      + ` packed binary verified: ${actualFiles.join(', ')}`,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
