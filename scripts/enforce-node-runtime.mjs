#!/usr/bin/env node

import process from 'node:process';

const commandName = process.argv[2] ?? 'this command';
const cwd = process.cwd();
const execPath = process.execPath;

const isWindowsNode = process.platform === 'win32';
const isWslSharePath =
  cwd.startsWith('\\\\wsl.localhost\\') ||
  cwd.startsWith('\\\\wsl$\\');

if (isWindowsNode && isWslSharePath) {
  console.error('');
  console.error(`Refusing to run ${commandName} with Windows Node against a WSL checkout.`);
  console.error(`Detected node: ${execPath}`);
  console.error(`Working directory: ${cwd}`);
  console.error('');
  console.error('Use the repo wrapper so Linux Node from nvm is selected instead:');
  console.error('  ./scripts/with-node.sh npm install');
  console.error(`  ./scripts/with-node.sh npm run ${commandName}`);
  console.error('');
  console.error('If dependencies were installed through the wrong runtime, reinstall them through the wrapper.');
  process.exit(1);
}
