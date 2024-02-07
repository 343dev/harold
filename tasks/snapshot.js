import ora from 'ora';

import { pathToFileURL } from "node:url";

import buildProject from '../lib/build-project.js';
import checkConfigPath from '../lib/check-config-path.js';
import findConfig from '../lib/find-config.js';
import generateSnapshot from '../lib/generate-snapshot.js';
import writeSnapshotFile from '../lib/write-snapshot-file.js';

export default async function snapshot(options) {
  const config = await getConfig(options.config);

  const build = {
    command: options.exec,
    directory: options.path,
    totalTime: undefined,
    snapshot: undefined,
    snapshotPath: options.output,
  };

  const spinner = ora();

  console.log();
  console.log('Taking a snapshot...');

  spinner.indent = 1;
  spinner.color = 'yellow';

  try {
    spinner.start('Build project');

    const buildStartTime = process.hrtime();
    await buildProject(build.command);
    build.totalTime = process.hrtime(buildStartTime);

    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  try {
    spinner.start('Generate snapshot');

    build.snapshot = generateSnapshot({
      buildDirectory: build.directory,
      buildTime: build.totalTime,
      categories: config.categories || {},
    });

    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  try {
    spinner.start('Save snapshot');

    await writeSnapshotFile({
      buildSnapshot: build.snapshot,
      outputPath: build.snapshotPath,
    });

    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  spinner.succeed('Done!');
  console.log();
}

async function getConfig(filepath) {
  const configFilepath = pathToFileURL( filepath ? checkConfigPath(filepath) : findConfig());
  const configData = await import(configFilepath);

  return configData.default;
}
