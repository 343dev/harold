import fs from 'node:fs';
import path from 'node:path';

import colorize from '../lib/colorize.js';
import printBuildTime from '../lib/print-build-time.js';
import printDiffFileTree from '../lib/print-diff-file-tree.js';
import printDiffTotal from '../lib/print-diff-total.js';
import printSnapshotInfo from '../lib/print-snapshot-info.js';

export default function diff(left, right) {
  const leftPath = path.resolve(left);
  const rightPath = path.resolve(right);

  const leftBuffer = fs.readFileSync(leftPath);
  const rightBuffer = fs.readFileSync(rightPath);

  if (leftBuffer.equals(rightBuffer)) {
    console.log('Snapshots are equal');
    process.exit(0); // eslint-disable-line unicorn/no-process-exit
  }

  const leftSnapshot = JSON.parse(leftBuffer.toString());
  const rightSnapshot = JSON.parse(rightBuffer.toString());

  console.log();

  // Snapshots info
  console.log(colorize('Snapshots:').cyan);
  printSnapshotInfo(leftSnapshot, 'Left');
  printSnapshotInfo(rightSnapshot, 'Right');
  console.log();

  // Build time
  console.log(colorize('Build time:').cyan);
  printBuildTime(leftSnapshot.buildTime, rightSnapshot.buildTime);
  console.log();

  // Total diff
  console.log(colorize('Diff by category:').cyan);
  printDiffTotal({
    left: leftSnapshot.total,
    right: rightSnapshot.total,
    leftCaption: path.parse(leftPath).name,
    rightCaption: path.parse(rightPath).name,
  });
  console.log();

  // File tree diff
  console.log(colorize('Diff by files:').cyan);
  printDiffFileTree(leftSnapshot.fsEntries, rightSnapshot.fsEntries);
  console.log();
}
