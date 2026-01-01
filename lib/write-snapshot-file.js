import fs from 'node:fs';

export default function writeSnapshotFile({ buildSnapshot, outputPath }) {
	return new Promise((resolve, reject) => {
		if (!outputPath) {
			const currentDate = new Date();
			const date = currentDate.toISOString()
				.slice(0, 10).replaceAll(/\D/g, '');
			const time = currentDate.toISOString()
				.slice(11, 19).replaceAll(/\D/g, '');

			outputPath = `harold_snapshot_${date}_${time}.json`;
		}

		const output = JSON.stringify(buildSnapshot, undefined, '  ');

		fs.writeFile(outputPath, output, (error) => {
			if (error) {
				reject(error);
			}

			resolve(`${outputPath} has been saved`);
		});
	});
}
