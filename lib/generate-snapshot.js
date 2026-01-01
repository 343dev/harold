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
	const accumulator = [];

	for (const directory of directories) {
		accumulator.push(
			{
				path: directory.path,
				size: directory.size,
				gzipSize: directory.gzipSize,
			},
			...directory.files,
		);
	}

	return accumulator;
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
	} catch {
		// ¯\_(ツ)_/¯
	}
}

function calculateTotalOther(total) {
	const categoriesTotal = { files: 0, size: 0, gzipSize: 0 };

	for (const key of Object.keys(total)) {
		if (key === 'all') {
			continue;
		}

		categoriesTotal.files += total[key].files;
		categoriesTotal.size += total[key].size;
		categoriesTotal.gzipSize += total[key].gzipSize;
	}

	return {
		files: total.all.files - categoriesTotal.files,
		size: total.all.size - categoriesTotal.size,
		gzipSize: total.all.gzipSize - categoriesTotal.gzipSize,
	};
}

function calculateTotal(directories) {
	const accumulator = { files: 0, size: 0, gzipSize: 0 };

	for (const directory of directories) {
		accumulator.files += directory.files.length;
		accumulator.size += directory.size;
		accumulator.gzipSize += directory.gzipSize;
	}

	return accumulator;
}

function filterByRegexp(directories, regexp) {
	return directories
		.map((directory) => {
			const files = directory.files.filter(file => regexp.test(file.path));

			return files.length > 0 ? generateDirectoryObject(directory.path, files) : undefined;
		})
		.filter(Boolean);
}

function getDirectoriesWithFiles(directories) {
	return directories.map((directory) => {
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
	let size = 0;
	let gzipSize = 0;

	for (const file of files) {
		size += file.size;
		gzipSize += file.gzipSize;
	}

	return {
		path: directoryPath,
		size,
		gzipSize,
		files,
	};
}
