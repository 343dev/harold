import prettyBytes from 'pretty-bytes';

import colorize from './colorize.js';

export default function printDiffFileTree(left, right) {
	const isEquals = Buffer.from(JSON.stringify(right))
		.equals(Buffer.from(JSON.stringify(left)));

	if (isEquals) {
		console.log('', 'No changes');
		return;
	}

	const newItems = diffByPath('+', right, left);
	const deletedItems = diffByPath('-', left, right);
	const modifiedItems = diffBySize(left, right);

	printDiff([...newItems, ...deletedItems, ...modifiedItems]);
}

function printDiff(logItems) {
	for (const item of logItems.toSorted((a, b) => a.path.localeCompare(b.path))) {
		let color = 'reset';

		if (item.type === '-') {
			color = 'red';
		} else if (item.type === '+') {
			color = 'green';
		}

		console.log(
			'',
			colorize(
				item.type,
				`${item.path}:`,
				item.size,
				`(${item.gzipSize})`,
			)[color],
		);
	}
}

function diffBySize(left, right) {
	const accumulator = [];

	for (const rightItem of right) {
		const leftItem = left.find(index => index.path === rightItem.path);

		if (leftItem && rightItem.size - leftItem.size !== 0) {
			accumulator.push(getLogItem('m', leftItem, rightItem));
		}
	}

	return accumulator;
}

function diffByPath(type, first, second) {
	const accumulator = [];

	for (const firstItem of first) {
		const isNotExist = !second.some(index => index.path === firstItem.path);

		if (isNotExist) {
			accumulator.push(getLogItem(type, firstItem));
		}
	}

	return accumulator;
}

function getLogItem(type, left, right) {
	return {
		type,
		path: left.path,
		size: right
			? prettyBytes(right.size - left.size, { signed: true })
			: prettyBytes(left.size),
		gzipSize: right
			? prettyBytes(right.gzipSize - left.gzipSize, { signed: true })
			: prettyBytes(left.gzipSize),
	};
}
