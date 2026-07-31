#!/usr/bin/env node

const migrationCommand = 'npx -y @12ui/design skill install';

process.stderr.write([
  '@12ui/codex-design has been retired.',
  'The former local app, plugin, and installer are no longer available.',
  '',
  'Migrate to the supported 12ui design skill:',
  `  ${migrationCommand}`,
  '',
].join('\n'));

process.exitCode = 1;
