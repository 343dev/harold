import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import findConfig from '../../lib/find-config.js';
import { createTempDir, cleanupTempDir, createTempFile as createTemporaryFile } from '../test-utils.js';

describe('findConfig', () => {
	let temporaryDirectories = [];
	let originalCwd;

	beforeEach(() => {
		originalCwd = process.cwd();
		temporaryDirectories = [];
	});

	afterEach(async () => {
		// Restore original working directory
		process.chdir(originalCwd);

		// Clean up temporary directories
		for (const directory of temporaryDirectories) {
			await cleanupTempDir(directory);
		}

		// Clean up mocks
		vi.restoreAllMocks();
	});

	test('should find config file in current directory', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create configuration file
		const configPath = await createTemporaryFile('export default {}', '.haroldrc.js', tempDir);

		const result = findConfig(tempDir);
		expect(result).toBe(configPath);
	});

	test('should find config file in parent directory', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create directory structure
		const subDir = path.join(tempDir, 'subdir');
		await fs.promises.mkdir(subDir);

		// Create configuration file in parent directory
		const configPath = await createTemporaryFile('export default {}', '.haroldrc.js', tempDir);

		const result = findConfig(subDir);
		expect(result).toBe(configPath);
	});

	test('should traverse up directory tree until config is found', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create deep directory structure
		const deepDir = path.join(tempDir, 'level1', 'level2', 'level3');
		await fs.promises.mkdir(deepDir, { recursive: true });

		// Create configuration file in root directory
		const configPath = await createTemporaryFile('export default {}', '.haroldrc.js', tempDir);

		const result = findConfig(deepDir);
		expect(result).toBe(configPath);
	});

	test('should return default path when no config found', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Don't create configuration file
		const result = findConfig(tempDir);

		// Should return path to default config
		const expectedDefaultPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../.haroldrc.js',
		);
		expect(result).toBe(expectedDefaultPath);
	});

	test('should use process.cwd() when no filepath provided', () => {
		const spy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');

		// Mock fs.existsSync to not find file
		vi.spyOn(fs, 'existsSync').mockReturnValue(false);

		findConfig();

		expect(spy).toHaveBeenCalled();
	});

	test('should check if found path is actually a file', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create directory with configuration file name
		const configDirPath = path.join(tempDir, '.haroldrc.js');
		await fs.promises.mkdir(configDirPath);

		const result = findConfig(tempDir);

		// Should return default path since .haroldrc.js is a directory, not a file
		const expectedDefaultPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../.haroldrc.js',
		);
		expect(result).toBe(expectedDefaultPath);
	});

	test('should handle root directory correctly', () => {
		// Mock fs operations to test behavior in root directory
		const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
		const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => false });

		// Test with root directory (OS dependent)
		const rootDir = process.platform === 'win32' ? 'C:\\' : '/';
		const result = findConfig(rootDir);

		// Should return default path
		const expectedDefaultPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../.haroldrc.js',
		);
		expect(result).toBe(expectedDefaultPath);

		existsSpy.mockRestore();
		statSpy.mockRestore();
	});

	test('should resolve relative paths correctly', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create configuration file
		const configPath = await createTemporaryFile('export default {}', '.haroldrc.js', tempDir);

		// Change working directory
		process.chdir(tempDir);

		// Test with relative path
		const result = findConfig('.');

		// Use fs.realpathSync to get real path (handles /private on macOS)
		expect(fs.realpathSync(result)).toBe(fs.realpathSync(configPath));
	});

	test('should handle non-existent directory path', () => {
		const nonExistentPath = '/this/path/does/not/exist';

		// Mock fs.existsSync for non-existent path
		const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

		const result = findConfig(nonExistentPath);

		// Should return default path
		const expectedDefaultPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../.haroldrc.js',
		);
		expect(result).toBe(expectedDefaultPath);

		existsSpy.mockRestore();
	});
});
