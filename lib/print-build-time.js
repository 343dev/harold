import colorize from './colorize.js';
import convertHrtime from './convert-hrtime.js';
import getPlural from './get-plural.js';

export default function printBuildTime(left, right) {
	if (!left || !right) {
		console.log('', 'Build time is not provided');
		return;
	}

	const leftBuildTime = Math.round(convertHrtime(left).seconds);
	const rightBuildTime = Math.round(convertHrtime(right).seconds);

	const diff = rightBuildTime - leftBuildTime;

	if (diff === 0) {
		console.log('', `No changes (${formatSeconds(leftBuildTime)})`);
		return;
	}

	const diffPretty = `${formatSeconds(Math.abs(diff))} ${diff > 0 ? 'slower' : 'faster'}`;
	const color = diff > 0 ? 'red' : 'green';

	console.log(
		'',
		colorize(
			diffPretty,
			`(Left: ${formatSeconds(leftBuildTime)},`,
			`Right: ${formatSeconds(rightBuildTime)})`,
		)[color],
	);
}

function formatSeconds(number_) {
	return `${number_} ${getPlural(number_, 'second', 'seconds')}`;
}
