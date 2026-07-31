import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../bin/codex-design.js', import.meta.url));
const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const migrationCommand = 'npx -y @12ui/design skill install';

const runCli = (...args) => spawnSync(
  process.execPath,
  [cliPath, ...args],
  { encoding: 'utf8' },
);

test('the tombstone binary fails with migration guidance', () => {
  const result = runCli();

  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /@12ui\/codex-design has been retired\./);
  assert.match(result.stderr, new RegExp(migrationCommand.replaceAll('/', '\\/')));
});

test('legacy commands cannot report success', () => {
  for (const args of [
    ['install'],
    ['launch', '--json'],
    ['create', '--json'],
    ['--help'],
  ]) {
    const result = runCli(...args);

    assert.equal(result.status, 1, `${args.join(' ')} should fail`);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /@12ui\/design skill install/);
  }
});

test('the package manifest is the dependency-free 0.1.11 tombstone', () => {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

  assert.equal(packageJson.name, '@12ui/codex-design');
  assert.equal(packageJson.version, '0.1.11');
  assert.deepEqual(packageJson.bin, {
    'codex-design': 'bin/codex-design.js',
  });
  assert.deepEqual(packageJson.files, ['bin/codex-design.js']);
  assert.equal('main' in packageJson, false);
  assert.equal('dependencies' in packageJson, false);
  assert.equal('devDependencies' in packageJson, false);
});
