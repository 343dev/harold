import ora from 'ora';

import buildProject from '../lib/build-project.js';
import generateSnapshot from '../lib/generate-snapshot.js';
import writeSnapshotFile from '../lib/write-snapshot-file.js';

export default async function snapshot(cmdObj) {
  const spinner = ora();
  const context = {
    buildPath: cmdObj.path,
    buildTime: null,
    execCmd: cmdObj.exec,
    snapshot: null,
  };

  console.log();
  console.log('Taking a snapshot...');

  spinner.indent = 1;
  spinner.color = 'yellow';

  try {
    spinner.start('Build project');

    const buildTime = process.hrtime();
    await buildProject(context.execCmd);
    context.buildTime = process.hrtime(buildTime);

    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  try {
    spinner.start('Generate snapshot');
    context.snapshot = generateSnapshot(context.buildPath, context.buildTime);
    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  try {
    spinner.start('Save snapshot');
    await writeSnapshotFile(context.snapshot, cmdObj.output);
    spinner.clear();
  } catch (error) {
    spinner.fail();
    throw error;
  }

  spinner.succeed('Done!');
  console.log();
}
