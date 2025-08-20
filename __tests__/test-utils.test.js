import {
	describe, test, expect, afterEach,
} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
	createTempDir,
	cleanupTempDir,
	createMockSnapshot,
	createMockConfig,
	createTempFile as createTemporaryFile,
	createTempFileStructure as createTemporaryFileStructure,
	createMockProcess,
	createMockStats,
} from './test-utils.js';

describe('Test Utilities', () => {
	const temporaryDirectories = [];

	afterEach(async () => {
		// Clean up all created temporary directories
		for (const directory of temporaryDirectories) {
			await cleanupTempDir(directory);
		}

		temporaryDirectories.length = 0;
	});

	describe('createTempDir', () => {
		test('should create a temporary directory', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			expect(tempDir).toBeDefined();
			expect(typeof tempDir).toBe('string');
			expect(tempDir).toMatch(/harold-test-/);

			// Check that directory exists
			const stats = await fs.stat(tempDir);
			expect(stats.isDirectory()).toBe(true);
		});

		test('should create unique directories on multiple calls', async () => {
			const dir1 = await createTempDir();
			const dir2 = await createTempDir();
			temporaryDirectories.push(dir1, dir2);

			expect(dir1).not.toBe(dir2);
		});
	});

	describe('cleanupTempDir', () => {
		test('should remove temporary directory', async () => {
			const tempDir = await createTempDir();

			// Create file in directory
			await fs.writeFile(path.join(tempDir, 'test.txt'), 'test content');

			// Remove directory
			await cleanupTempDir(tempDir);

			// Check that directory was removed
			await expect(fs.stat(tempDir)).rejects.toThrow();
		});

		test('should not throw on non-existent directory', async () => {
			await expect(cleanupTempDir('/non/existent/path')).resolves.toBeUndefined();
		});
	});

	describe('createMockSnapshot', () => {
		test('should create default snapshot object', () => {
			const snapshot = createMockSnapshot();

			expect(snapshot).toHaveProperty('project', 'test-project');
			expect(snapshot).toHaveProperty('gitRef', 'main');
			expect(snapshot).toHaveProperty('date');
			expect(snapshot).toHaveProperty('buildTime');
			expect(snapshot).toHaveProperty('total');
			expect(snapshot).toHaveProperty('fsEntries');
			expect(Array.isArray(snapshot.fsEntries)).toBe(true);
		});

		test('should apply overrides', () => {
			const overrides = {
				project: 'custom-project',
				gitRef: 'feature-branch',
			};
			const snapshot = createMockSnapshot(overrides);

			expect(snapshot.project).toBe('custom-project');
			expect(snapshot.gitRef).toBe('feature-branch');
			expect(snapshot.date).toBe('2024-01-01T00:00:00.000Z'); // Other fields unchanged
		});

		test('should have correct total structure', () => {
			const snapshot = createMockSnapshot();

			expect(snapshot.total).toHaveProperty('all');
			expect(snapshot.total).toHaveProperty('js');
			expect(snapshot.total).toHaveProperty('css');
			expect(snapshot.total).toHaveProperty('other');

			// Check structure of each category
			for (const category of Object.values(snapshot.total)) {
				expect(category).toHaveProperty('files');
				expect(category).toHaveProperty('size');
				expect(category).toHaveProperty('gzipSize');
				expect(typeof category.files).toBe('number');
				expect(typeof category.size).toBe('number');
				expect(typeof category.gzipSize).toBe('number');
			}
		});
	});

	describe('createMockConfig', () => {
		test('should create default config object', () => {
			const config = createMockConfig();

			expect(config).toHaveProperty('build');
			expect(config).toHaveProperty('categories');
			expect(config.build).toHaveProperty('command', 'npm run build');
			expect(config.build).toHaveProperty('path', 'dist');
			expect(config.build).toHaveProperty('env');
		});

		test('should apply overrides', () => {
			const overrides = {
				build: {
					command: 'yarn build',
					path: 'public',
				},
			};
			const config = createMockConfig(overrides);

			expect(config.build.command).toBe('yarn build');
			expect(config.build.path).toBe('public');
			expect(config.categories).toBeDefined(); // Other fields unchanged
		});

		test('should have regex patterns in categories', () => {
			const config = createMockConfig();

			expect(config.categories.js).toBeInstanceOf(RegExp);
			expect(config.categories.css).toBeInstanceOf(RegExp);
			expect(config.categories.images).toBeInstanceOf(RegExp);
		});
	});

	describe('createTempFile', () => {
		test('should create file with content', async () => {
			const content = 'test file content';
			const filePath = await createTemporaryFile(content);
			temporaryDirectories.push(path.dirname(filePath));

			const readContent = await fs.readFile(filePath, 'utf8');
			expect(readContent).toBe(content);
		});

		test('should create file with custom name', async () => {
			const content = 'test content';
			const filename = 'custom.txt';
			const filePath = await createTemporaryFile(content, filename);
			temporaryDirectories.push(path.dirname(filePath));

			expect(path.basename(filePath)).toBe(filename);
		});

		test('should create file in specified directory', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const content = 'test content';
			const filePath = await createTemporaryFile(content, 'test.txt', tempDir);

			expect(path.dirname(filePath)).toBe(tempDir);
		});
	});

	describe('createTempFileStructure', () => {
		test('should create file structure', async () => {
			const structure = {
				'file1.txt': 'content1',
				subdir: {
					'file2.txt': 'content2',
					nested: {
						'file3.txt': 'content3',
					},
				},
			};

			const baseDir = await createTemporaryFileStructure(structure);
			temporaryDirectories.push(baseDir);

			// Check files
			const file1Content = await fs.readFile(path.join(baseDir, 'file1.txt'), 'utf8');
			expect(file1Content).toBe('content1');

			const file2Content = await fs.readFile(path.join(baseDir, 'subdir', 'file2.txt'), 'utf8');
			expect(file2Content).toBe('content2');

			const file3Content = await fs.readFile(path.join(baseDir, 'subdir', 'nested', 'file3.txt'), 'utf8');
			expect(file3Content).toBe('content3');

			// Check directories
			const subdirStats = await fs.stat(path.join(baseDir, 'subdir'));
			expect(subdirStats.isDirectory()).toBe(true);

			const nestedStats = await fs.stat(path.join(baseDir, 'subdir', 'nested'));
			expect(nestedStats.isDirectory()).toBe(true);
		});
	});

	describe('createMockProcess', () => {
		test('should create default process mock', () => {
			const process = createMockProcess();

			expect(process).toHaveProperty('pid');
			expect(process).toHaveProperty('stdout');
			expect(process).toHaveProperty('stderr');
			expect(process).toHaveProperty('on');
			expect(process).toHaveProperty('kill');
			expect(typeof process.pid).toBe('number');
		});

		test('should apply overrides', () => {
			const overrides = { pid: 54_321, exitCode: 1 };
			const process = createMockProcess(overrides);

			expect(process.pid).toBe(54_321);
			expect(process.exitCode).toBe(1);
		});
	});

	describe('createMockStats', () => {
		test('should create default stats mock', () => {
			const stats = createMockStats();

			expect(stats).toHaveProperty('size');
			expect(stats).toHaveProperty('isFile');
			expect(stats).toHaveProperty('isDirectory');
			expect(typeof stats.size).toBe('number');
			expect(typeof stats.isFile).toBe('function');
			expect(typeof stats.isDirectory).toBe('function');
			expect(stats.isFile()).toBe(true);
			expect(stats.isDirectory()).toBe(false);
		});

		test('should apply overrides', () => {
			const overrides = {
				size: 2048,
				isFile: () => false,
				isDirectory: () => true,
			};
			const stats = createMockStats(overrides);

			expect(stats.size).toBe(2048);
			expect(stats.isFile()).toBe(false);
			expect(stats.isDirectory()).toBe(true);
		});
	});
});
