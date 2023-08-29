import Table from 'cli-table3';
import prettyBytes from 'pretty-bytes';

import { EOL } from 'node:os';

import colorize from './colorize.js';
import getPlural from './get-plural.js';

export default function printDiffTotal({ left, right, leftCaption, rightCaption } = {}) {
  const isEqual = Buffer.from(JSON.stringify(right))
    .equals(Buffer.from(JSON.stringify(left)));

  if (isEqual) {
    console.log('', 'No changes');
    return;
  }

  const table = new Table({
    wordWrap: true,
    style: {
      compact: false,
      head: [],
      ...process.stdout.isTTY ? {} : { border: [] },
    },
    head: ['', colorize(leftCaption).dim, colorize(rightCaption).dim, colorize('Changes').dim],
    chars: {
      top: '—',
      'top-mid': '—',
      'top-left': ' ',
      'top-right': ' ',
      bottom: '—',
      'bottom-mid': '—',
      'bottom-left': ' ',
      'bottom-right': ' ',
      left: ' ',
      'left-mid': ' ',
      mid: '—',
      'mid-mid': '—',
      right: ' ',
      'right-mid': ' ',
      middle: ' ',
    },
  });

  table.push(
    generateTableRow('JS', left.js, right.js),
    generateTableRow('JS (legacy)', left.jsLegacy, right.jsLegacy),
    generateTableRow('CSS', left.css, right.css),
    generateTableRow('Images', left.images, right.images),
    generateTableRow('Fonts', left.fonts, right.fonts),
    generateTableRow('Videos', left.videos, right.videos),
    generateTableRow('Other', left.other, right.other),
    generateTableRow(`${EOL}Total`, left.all, right.all),
  );

  console.log(table.toString());
}

function generateTableRow(name, left, right) {
  const sizeDiff = right.size - left.size;
  const gzipSizeDiff = right.gzipSize - left.gzipSize;
  const filesDiff = right.files - left.files;

  const sizeDiffPretty = prettyBytes(sizeDiff, { signed: true });
  const gzipSizeDiffPretty = prettyBytes(gzipSizeDiff, { signed: true });
  const filesDiffPretty = `${filesDiff > 0 ? '+' : ''}${filesDiff} \
${getPlural(filesDiff, 'item', 'items')}`;

  const result = `${sizeDiffPretty} (${gzipSizeDiffPretty})\
${filesDiff === 0 ? '' : `, ${filesDiffPretty}`}`;
  const resultColor = sizeDiff > 0 || gzipSizeDiff > 0 ? 'red' : 'green';

  const hasChanges = left.size !== right.size
    || left.gzipSize !== right.gzipSize
    || left.files !== right.files;

  return {
    [colorize(name).dim]: [
      { content: getPrettySizes(left), vAlign: 'center' },
      { content: getPrettySizes(right), vAlign: 'center' },
      { content: hasChanges ? colorize(result)[resultColor] : colorize('No changes').dim, vAlign: 'center' },
    ],
  };
}

function getPrettySizes(total) {
  return total.size === total.gzipSize
    ? prettyBytes(total.size)
    : `${prettyBytes(total.size)} (${prettyBytes(total.gzipSize)})`;
}
