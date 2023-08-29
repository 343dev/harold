#!/usr/bin/env node

import { program } from 'commander';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import diff from './tasks/diff.js';
import snapshot from './tasks/snapshot.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await fs.readFile(path.join(dirname, 'package.json')));

// Take snapshot
program
  .command('snapshot')
  .option(
    '-o, --output <path>',
    'output filepath (default: "harold_snapshot_<date>_<time>.json")',
  )
  .option(
    '-e, --exec <cmd>',
    'build command (will be run with NO_HASH=true env variable set)',
    'npm run build-production',
  )
  .option(
    '-p, --path <path>',
    'build path',
    'public',
  )
  .description('build project and take snapshot')
  .action(snapshot);

// Compare snapshots
program
  .command('diff <left> <right>')
  .description('compare snapshots')
  .action(diff);

program
  .usage('[options]')
  .version(packageJson.version, '-V, --version')
  .description(packageJson.description)
  .parse(process.argv);

if (program.args.length === 0) program.help();

process.on('unhandledRejection', error => {
  console.error(error);
});
