import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import fs from 'node:fs';
import checkConfigPath from '../../lib/check-config-path.js';
import { createTempDir, cleanupTempDir, createTempFile as createTemporaryFile } from '../test-utils.js';

describe('checkConfigPath', () => {
	let temporaryDirectories = [];
	let consoleErrorSpy;
	let processExitSpy;

	beforeEach(() => {
		temporaryDirectories = [];
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
			throw new Error(`process.exit(${code})`);
		});
	});

	afterEach(async () => {
		// Clean up temporary directories
		for (const directory of temporaryDirectories) {
			await cleanupTempDir(directory);
		}

		// Clean up mocks
		vi.restoreAllMocks();
	});

	test('should return resolved path for existing file', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create test file
		const filePath = await createTemporaryFile('test content', 'config.js', tempDir);

		const result = checkConfigPath(filePath);

		expect(result).toBe(filePath);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(processExitSpy).not.toHaveBeenCalled();
	});

	test('should resolve relative paths', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create test file
		const fileName = 'config.js';
		const filePath = await createTemporaryFile('test content', fileName, tempDir);

		// Change working directory to test relative paths
		const originalCwd = process.cwd();
		process.chdir(tempDir);

		try {
			const result = checkConfigPath(`./${fileName}`);
			// Use fs.realpathSync to normalize paths (handles /private on macOS)
			expect(fs.realpathSync(result)).toBe(fs.realpathSync(filePath));
		} finally {
			process.chdir(originalCwd);
		}
	});

	test('should exit with error when file does not exist', () => {
		const nonExistentPath = '/path/that/does/not/exist.js';

		// Mock fs.existsSync to return false
		vi.spyOn(fs, 'existsSync').mockReturnValue(false);

		expect(() => checkConfigPath(nonExistentPath)).toThrow('process.exit(1)');

		expect(consoleErrorSpy).toHaveBeenCalledWith('Provided config path does not exist');
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test('should exit with error when path points to directory', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create subdirectory
		const subDir = `${tempDir}/subdir`;
		await fs.promises.mkdir(subDir);

		expect(() => checkConfigPath(subDir)).toThrow('process.exit(1)');

		expect(consoleErrorSpy).toHaveBeenCalledWith('Provided config path must point to a file');
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test('should handle empty string parameter', () => {
		// Mock fs.existsSync to return false for empty string
		vi.spyOn(fs, 'existsSync').mockReturnValue(false);

		expect(() => checkConfigPath('')).toThrow('process.exit(1)');

		expect(consoleErrorSpy).toHaveBeenCalledWith('Provided config path does not exist');
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test('should use empty string as default parameter', () => {
		// Mock fs.existsSync to return false for empty string
		vi.spyOn(fs, 'existsSync').mockReturnValue(false);

		expect(() => checkConfigPath()).toThrow('process.exit(1)');

		expect(consoleErrorSpy).toHaveBeenCalledWith('Provided config path does not exist');
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test('should handle fs.existsSync errors gracefully', () => {
		// Mock fs.existsSync to throw error
		const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
			throw new Error('File system error');
		});

		expect(() => checkConfigPath('/some/path')).toThrow('File system error');

		existsSpy.mockRestore();
	});

	test('should handle fs.statSync errors gracefully', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create file
		const filePath = await createTemporaryFile('test', 'config.js', tempDir);

		// Mock fs.statSync to throw error
		const statSpy = vi.spyOn(fs, 'statSync').mockImplementation(() => {
			throw new Error('Stat error');
		});

		expect(() => checkConfigPath(filePath)).toThrow('Stat error');

		statSpy.mockRestore();
	});

	test('should work with absolute paths', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create file with absolute path
		const filePath = await createTemporaryFile('test content', 'config.js', tempDir);

		const result = checkConfigPath(filePath);

		expect(result).toBe(filePath);
		expect(result).toMatch(/^[/\\]|^[A-Za-z]:[/\\]/); // Check that path is absolute
	});

	test('should handle special characters in path', async () => {
		const tempDir = await createTempDir();
		temporaryDirectories.push(tempDir);

		// Create file with special characters in name
		const fileName = 'config with spaces & symbols.js';
		const filePath = await createTemporaryFile('test content', fileName, tempDir);

		const result = checkConfigPath(filePath);

		expect(result).toBe(filePath);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(processExitSpy).not.toHaveBeenCalled();
	});
});
