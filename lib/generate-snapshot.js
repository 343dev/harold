import fg from 'fast-glob';
import { gzipSizeFromFileSync } from 'gzip-size';

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectPackageJsonPath = path.resolve(process.cwd(), 'package.json');
const projectPackageJson = fs.existsSync(projectPackageJsonPath)
	? JSON.parse(await fs.promises.readFile(projectPackageJsonPath))
	: {};

export default function generateSnapshot({ buildDirectory, buildTime, categories }) {
	if (!buildDirectory) {
		throw new Error('Build path is not set. Check config file or set path using option "--path"');
	}

	if (!fs.statSync(buildDirectory).isDirectory()) {
		throw new Error(`'${buildDirectory}' is not a directory`);
	}

	const directoryPaths = [
		path.join(buildDirectory, '/'),
		...fg.sync(`${buildDirectory}**/**/*`, {
			onlyDirectories: true,
			markDirectories: true,
		}),
	];

	const directoriesWithFiles = getDirectoriesWithFiles(directoryPaths);

	const total = {};

	for (const [name, regexp] of Object.entries(categories)) {
		total[name] = calculateTotal(filterByRegexp(directoriesWithFiles, regexp));
	}

	total.all = calculateTotal(directoriesWithFiles);

	if (Object.keys(total).length > 1) {
		total.other = calculateTotalOther(total);
	}

	const currentGitReference = getCurrentGitReference();

	return {
		project: projectPackageJson.name || 'unknown',
		...currentGitReference ? { gitRef: currentGitReference } : {},
		date: new Date().toISOString(),
		buildTime,
		total,
		fsEntries: flattenDirectories(directoriesWithFiles),
	};
}

function flattenDirectories(directories) {
	return directories.reduce((accumulator, directory) => {
		accumulator.push(
			{
				path: directory.path,
				size: directory.size,
				gzipSize: directory.gzipSize,
			},
			...directory.files,
		);

		return accumulator;
	}, []);
}

function getCurrentGitReference() {
	try {
		const gitBranch = execSync(
			'git branch --show-current',
			{ stdio: 'pipe' },
		);
		const currentBranch = gitBranch.toString().trim();

		if (currentBranch) {
			return currentBranch;
		}

		const gitRevParse = execSync('git rev-parse HEAD');

		return gitRevParse.toString().trim().slice(0, 6);
	} catch {}
}

function calculateTotalOther(total) {
	const categoriesTotal = Object.keys(total).reduce((accumulator, key) => {
		if (key === 'all') {
			return accumulator;
		}

		accumulator.files += total[key].files;
		accumulator.size += total[key].size;
		accumulator.gzipSize += total[key].gzipSize;

		return accumulator;
	}, { files: 0, size: 0, gzipSize: 0 });

	return {
		files: total.all.files - categoriesTotal.files,
		size: total.all.size - categoriesTotal.size,
		gzipSize: total.all.gzipSize - categoriesTotal.gzipSize,
	};
}

function calculateTotal(directories) {
	const init = { files: 0, size: 0, gzipSize: 0 };

	return directories.reduce((accumulator, directory) => ({
		...accumulator,
		files: accumulator.files + directory.files.length,
		size: accumulator.size + directory.size,
		gzipSize: accumulator.gzipSize + directory.gzipSize,
	}), init);
}

function filterByRegexp(directories, regexp) {
	return directories
		.map(directory => {
			const files = directory.files.filter(file => regexp.test(file.path));

			return files.length > 0 ? generateDirectoryObject(directory.path, files) : undefined;
		})
		.filter(Boolean);
}

function getDirectoriesWithFiles(directories) {
	return directories.map(directory => {
		const directoryFiles = fg.sync(`${directory}*`, { stats: true })
			.map(file => ({
				path: file.path,
				size: file.stats.size,
				gzipSize: gzipSizeFromFileSync(file.path),
			}));

		return generateDirectoryObject(directory, directoryFiles);
	});
}

function generateDirectoryObject(directoryPath, files) {
	return {
		path: directoryPath,
		size: files.reduce((accumulator, file) => accumulator + file.size, 0),
		gzipSize: files.reduce((accumulator, file) => accumulator + file.gzipSize, 0),
		files,
	};
}
