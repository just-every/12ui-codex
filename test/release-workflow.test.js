import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyPublishedTombstone } from '../scripts/verify-published-tombstone.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(
  path.join(root, '.github/workflows/release.yml'),
  'utf8',
);

test('release workflow is main-only and has an explicit resume mode', () => {
  assert.match(workflow, /mode:\n[\s\S]*- publish\n\s+- resume-after-publish/);
  assert.match(workflow, /GITHUB_REF_NAME" == "\$DEFAULT_BRANCH"/);
  assert.match(workflow, /if: inputs\.mode == 'publish'/);
  assert.match(workflow, /already public; rerun with mode=resume-after-publish/);
  assert.equal(
    workflow.match(/run: npm publish --access public/g)?.length,
    1,
  );
});

test('resume path verifies public bytes and reconciles tag and release', () => {
  assert.match(workflow, /node scripts\/verify-published-tombstone\.mjs/);
  assert.match(workflow, /git rev-list -n 1 "\$tag"/);
  assert.match(workflow, /Remote \$tag points to \$remote_sha/);
  assert.match(workflow, /repos\/\$GITHUB_REPOSITORY\/releases\/tags\/\$tag/);
  assert.match(workflow, /grep -q 'HTTP 404'/);
  assert.match(workflow, /gh release create "\$tag"/);
  assert.match(workflow, /--verify-tag/);
});

test('published verifier accepts an exact real tombstone tarball', () => {
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'codex-design-workflow-test-'),
  );
  try {
    const packResult = JSON.parse(execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporaryDirectory,
      ],
      { cwd: root, encoding: 'utf8' },
    ))[0];
    const result = verifyPublishedTombstone({
      packageSpec: path.join(temporaryDirectory, packResult.filename),
      sourceRoot: root,
    });
    assert.equal(result.version, '0.1.11');
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('published verifier rejects a tombstone that differs from frozen source', () => {
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'codex-design-workflow-mismatch-'),
  );
  const packageDirectory = path.join(temporaryDirectory, 'package-source');
  mkdirSync(path.join(packageDirectory, 'bin'), { recursive: true });
  try {
    cpSync(
      path.join(root, 'package.json'),
      path.join(packageDirectory, 'package.json'),
    );
    cpSync(path.join(root, 'README.md'), path.join(packageDirectory, 'README.md'));
    writeFileSync(
      path.join(packageDirectory, 'bin/codex-design.js'),
      '#!/usr/bin/env node\nprocess.exitCode = 0;\n',
    );
    const packResult = JSON.parse(execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporaryDirectory,
      ],
      { cwd: packageDirectory, encoding: 'utf8' },
    ))[0];

    assert.throws(
      () => verifyPublishedTombstone({
        packageSpec: path.join(temporaryDirectory, packResult.filename),
        sourceRoot: root,
      }),
      /Published bin\/codex-design\.js differs from the frozen source/,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
