import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Creates a temporary directory for tests
 * @returns {Promise<string>} Path to the temporary directory
 */
export async function createTemporaryDirectory() {
	const temporaryDirectory = await fs.mkdtemp(path.join(tmpdir(), 'harold-test-'));
	return temporaryDirectory;
}

/**
 * Removes temporary directory and all its contents
 * @param {string} dirPath - Path to the directory to remove
 * @returns {Promise<void>}
 */
export async function cleanupTemporaryDirectory(directoryPath) {
	try {
		await fs.rm(directoryPath, { recursive: true, force: true });
	} catch (error) {
		// Ignore deletion errors in tests
		console.warn(`Failed to cleanup temp directory ${directoryPath}:`, error.message);
	}
}

/**
 * Creates a mock snapshot object for tests
 * @param {object} overrides - Overrides for default values
 * @returns {object} Mock snapshot
 */
export function createMockSnapshot(overrides = {}) {
	const defaultSnapshot = {
		project: 'test-project',
		gitRef: 'main',
		date: '2024-01-01T00:00:00.000Z',
		buildTime: [0, 1_000_000_000], // 1 second in hrtime format
		total: {
			all: { files: 10, size: 1000, gzipSize: 500 },
			js: { files: 5, size: 600, gzipSize: 300 },
			css: { files: 3, size: 300, gzipSize: 150 },
			other: { files: 2, size: 100, gzipSize: 50 },
		},
		fsEntries: [
			{ path: '/build/', size: 1000, gzipSize: 500 },
			{ path: '/build/app.js', size: 600, gzipSize: 300 },
			{ path: '/build/styles.css', size: 300, gzipSize: 150 },
			{ path: '/build/assets/', size: 100, gzipSize: 50 },
			{ path: '/build/assets/image.png', size: 100, gzipSize: 50 },
		],
	};

	return { ...defaultSnapshot, ...overrides };
}

/**
 * Creates a mock configuration object for tests
 * @param {object} overrides - Overrides for default values
 * @returns {object} Mock configuration
 */
export function createMockConfig(overrides = {}) {
	const defaultConfig = {
		build: {
			command: 'npm run build',
			path: 'dist',
			env: { NODE_ENV: 'production' },
		},
		categories: {
			js: /\.js$/,
			css: /\.css$/,
			images: /\.(png|jpg|jpeg|gif|svg)$/,
		},
	};

	return { ...defaultConfig, ...overrides };
}

/**
 * Creates a temporary file with specified content
 * @param {string} content - File content
 * @param {string} filename - File name (optional)
 * @param {string} dir - Directory (optional, defaults to temporary)
 * @returns {Promise<string>} Path to the created file
 */
export async function createTemporaryFile(content, filename = 'test-file.txt', directory) {
	const targetDirectory = directory || await createTemporaryDirectory();
	const filePath = path.join(targetDirectory, filename);

	await fs.writeFile(filePath, content, 'utf8');
	return filePath;
}

/**
 * Creates a temporary file structure for testing
 * @param {object} structure - Object describing the file structure
 * @param {string} baseDir - Base directory (optional)
 * @returns {Promise<string>} Path to the base directory
 */
export async function createTemporaryFileStructure(structure, baseDirectory) {
	const targetDirectory = baseDirectory || await createTemporaryDirectory();

	async function createStructure(object, currentDirectory) {
		const entries = Object.entries(object);
		const promises = entries.map(async ([name, content]) => {
			const itemPath = path.join(currentDirectory, name);

			if (typeof content === 'string') {
				// This is a file
				return fs.writeFile(itemPath, content, 'utf8');
			}

			if (typeof content === 'object' && content !== undefined) {
				// This is a directory
				await fs.mkdir(itemPath, { recursive: true });
				return createStructure(content, itemPath);
			}
		});

		await Promise.all(promises);
	}

	await createStructure(structure, targetDirectory);
	return targetDirectory;
}

/**
 * Creates a mock for a process with specified properties
 * @param {object} overrides - Overrides for process properties
 * @returns {object} Mock process
 */
export function createMockProcess(overrides = {}) {
	const defaultProcess = {
		pid: 12_345,
		stdout: { pipe() {} },
		stderr: { pipe() {} },
		on() {},
		kill() {},
		exitCode: 0,
	};

	return { ...defaultProcess, ...overrides };
}

/**
 * Creates a mock for file statistics
 * @param {object} overrides - Overrides for statistics properties
 * @returns {object} Mock file statistics
 */
export function createMockStats(overrides = {}) {
	const defaultStats = {
		size: 1024,
		isFile: () => true,
		isDirectory: () => false,
		mtime: new Date('2024-01-01T00:00:00.000Z'),
		ctime: new Date('2024-01-01T00:00:00.000Z'),
	};

	return { ...defaultStats, ...overrides };
}

// Aliases for backward compatibility (with proper names for ESLint)
export { createTemporaryDirectory as createTempDir };
export { cleanupTemporaryDirectory as cleanupTempDir };
export { createTemporaryFile as createTempFile };
export { createTemporaryFileStructure as createTempFileStructure };
