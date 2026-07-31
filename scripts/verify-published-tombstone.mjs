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
const expectedFiles = [
  'README.md',
  'bin/codex-design.js',
  'package.json',
];

export function verifyPublishedTombstone({
  packageSpec = '@12ui/codex-design@0.1.11',
  sourceRoot = packageRoot,
} = {}) {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'codex-design-published-tombstone-'),
  );

  try {
    const packResult = JSON.parse(execFileSync(
      npmExecutable,
      [
        'pack',
        packageSpec,
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporaryDirectory,
      ],
      { cwd: sourceRoot, encoding: 'utf8' },
    ))[0];

    assert.deepEqual(
      packResult.files.map(({ path: filePath }) => filePath).sort(),
      expectedFiles,
    );
    assert.equal(packResult.name, '@12ui/codex-design');
    assert.equal(packResult.version, '0.1.11');

    execFileSync(
      'tar',
      [
        '-xzf',
        path.join(temporaryDirectory, packResult.filename),
        '-C',
        temporaryDirectory,
      ],
      { stdio: 'pipe' },
    );

    const packedRoot = path.join(temporaryDirectory, 'package');
    for (const relativePath of expectedFiles) {
      assert.deepEqual(
        readFileSync(path.join(packedRoot, relativePath)),
        readFileSync(path.join(sourceRoot, relativePath)),
        `Published ${relativePath} differs from the frozen source`,
      );
    }

    const binaryResult = spawnSync(
      process.execPath,
      [path.join(packedRoot, 'bin/codex-design.js'), 'launch', '--json'],
      { encoding: 'utf8' },
    );
    assert.equal(binaryResult.status, 1);
    assert.equal(binaryResult.stdout, '');
    assert.match(binaryResult.stderr, /@12ui\/codex-design has been retired\./);
    assert.match(binaryResult.stderr, /npx -y @12ui\/design skill install/);

    return {
      name: packResult.name,
      version: packResult.version,
      files: expectedFiles,
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = verifyPublishedTombstone();
  console.log(
    `${result.name}@${result.version} matches the frozen tombstone:`
      + ` ${result.files.join(', ')}`,
  );
}
