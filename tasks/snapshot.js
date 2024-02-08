import { createSpinner } from 'nanospinner';

import { pathToFileURL } from "node:url";

import buildProject from '../lib/build-project.js';
import checkConfigPath from '../lib/check-config-path.js';
import findConfig from '../lib/find-config.js';
import generateSnapshot from '../lib/generate-snapshot.js';
import writeSnapshotFile from '../lib/write-snapshot-file.js';

export default async function snapshot(options) {
  const config = await getConfig(options.config);

  const build = {
    command: options.exec || config.build.command,
    path: options.path || config.build.path,
    totalTime: undefined,
    snapshot: undefined,
    snapshotPath: options.output,
  };

  const spinner = createSpinner();

  console.log();
  console.log('Taking a snapshot...');

  try {
    spinner.start({ text: 'Build project' });

    const buildStartTime = process.hrtime();
    await buildProject(build.command);
    build.totalTime = process.hrtime(buildStartTime);

    spinner.clear();
  } catch (error) {
    spinner.error();
    throw error;
  }

  try {
    spinner.start({ text: 'Generate snapshot' });

    build.snapshot = generateSnapshot({
      buildDirectory: build.path,
      buildTime: build.totalTime,
      categories: config.categories || {},
    });

    spinner.clear();
  } catch (error) {
    spinner.error();
    throw error;
  }

  try {
    spinner.start({ text: 'Save snapshot' });

    await writeSnapshotFile({
      buildSnapshot: build.snapshot,
      outputPath: build.snapshotPath,
    });

    spinner.clear();
  } catch (error) {
    spinner.error();
    throw error;
  }

  spinner.success({ text: 'Done!' });
  console.log();
}

async function getConfig(filepath) {
  const configFilepath = pathToFileURL( filepath ? checkConfigPath(filepath) : findConfig());
  const configData = await import(configFilepath);

  return configData.default;
}
