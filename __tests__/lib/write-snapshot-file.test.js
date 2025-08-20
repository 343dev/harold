import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import writeSnapshotFile from '../../lib/write-snapshot-file.js';
import { createTempDir, cleanupTempDir, createMockSnapshot } from '../test-utils.js';

describe('writeSnapshotFile', () => {
	let temporaryDirectories = [];

	beforeEach(() => {
		temporaryDirectories = [];
	});

	afterEach(async () => {
		// Clean up temporary directories
		for (const directory of temporaryDirectories) {
			await cleanupTempDir(directory);
		}

		vi.restoreAllMocks();
	});

	describe('successful file writing', () => {
		test('should write snapshot to specified file path', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const outputPath = path.join(tempDir, 'test-snapshot.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);

			// Check that the file was created
			expect(fs.existsSync(outputPath)).toBe(true);

			// Check file content
			const fileContent = await fs.promises.readFile(outputPath, 'utf8');
			const parsedContent = JSON.parse(fileContent);
			expect(parsedContent).toEqual(buildSnapshot);
		});

		test('should format JSON with proper indentation', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const outputPath = path.join(tempDir, 'formatted-snapshot.json');

			await writeSnapshotFile({ buildSnapshot, outputPath });

			const fileContent = await fs.promises.readFile(outputPath, 'utf8');

			// Check that JSON is formatted with indentation
			expect(fileContent).toContain('  "project"');
			expect(fileContent).toContain('  "date"');
			expect(fileContent).not.toMatch(/^{"project"/); // Should not be minified
		});

		test('should generate automatic filename when outputPath is not provided', async () => {
			const buildSnapshot = createMockSnapshot();

			// Mock Date for predictable filename
			const mockDate = new Date('2024-01-15T10:30:45.123Z');
			vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

			const result = await writeSnapshotFile({ buildSnapshot });

			expect(result).toBe('harold_snapshot_20240115_103045.json has been saved');

			// Check that the file was created
			expect(fs.existsSync('harold_snapshot_20240115_103045.json')).toBe(true);

			// Clean up created file
			try {
				fs.unlinkSync('harold_snapshot_20240115_103045.json');
			} catch {
				// Ignore cleanup errors
			}
		});

		test('should handle different date formats correctly', async () => {
			const buildSnapshot = createMockSnapshot();

			// Test different dates
			const testDates = [
				{ date: new Date('2024-12-31T23:59:59.999Z'), expected: 'harold_snapshot_20241231_235959.json' },
				{ date: new Date('2024-01-01T00:00:00.000Z'), expected: 'harold_snapshot_20240101_000000.json' },
				{ date: new Date('2024-06-15T12:30:45.678Z'), expected: 'harold_snapshot_20240615_123045.json' },
			];

			for (const { date, expected } of testDates) {
				vi.spyOn(global, 'Date').mockImplementation(() => date);

				const result = await writeSnapshotFile({ buildSnapshot });
				expect(result).toBe(`${expected} has been saved`);

				// Clean up created file
				try {
					fs.unlinkSync(expected);
				} catch {
					// Ignore cleanup errors
				}

				vi.restoreAllMocks();
			}
		});

		test('should write to nested directory path', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const nestedDir = path.join(tempDir, 'snapshots', 'daily');
			const outputPath = path.join(nestedDir, 'snapshot.json');

			// Create nested directories
			await fs.promises.mkdir(nestedDir, { recursive: true });

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);
			expect(fs.existsSync(outputPath)).toBe(true);
		});
	});

	describe('error handling', () => {
		test('should reject when file cannot be written due to permissions', async () => {
			const buildSnapshot = createMockSnapshot();
			const invalidPath = '/root/restricted/snapshot.json'; // Path without write permissions

			await expect(writeSnapshotFile({ buildSnapshot, outputPath: invalidPath }))
				.rejects.toThrow();
		});

		test('should reject when directory does not exist and cannot be created', async () => {
			const buildSnapshot = createMockSnapshot();
			const invalidPath = '/nonexistent/deeply/nested/path/snapshot.json';

			await expect(writeSnapshotFile({ buildSnapshot, outputPath: invalidPath }))
				.rejects.toThrow();
		});

		test('should handle fs.writeFile errors correctly', async () => {
			const buildSnapshot = createMockSnapshot();
			const outputPath = '/tmp/test-snapshot.json';

			// Mock fs.writeFile to throw an error
			const originalWriteFile = fs.writeFile;
			vi.spyOn(fs, 'writeFile').mockImplementation((path, data, callback) => {
				callback(new Error('Disk full'));
			});

			await expect(writeSnapshotFile({ buildSnapshot, outputPath }))
				.rejects.toThrow('Disk full');

			// Restore original function
			fs.writeFile = originalWriteFile;
		});

		test('should handle JSON serialization errors', async () => {
			// Create object with circular reference
			const cyclicSnapshot = { name: 'test' };
			cyclicSnapshot.self = cyclicSnapshot;

			const outputPath = '/tmp/cyclic-snapshot.json';

			await expect(writeSnapshotFile({ buildSnapshot: cyclicSnapshot, outputPath }))
				.rejects.toThrow();
		});
	});

	describe('edge cases', () => {
		test('should handle empty snapshot object', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = {};
			const outputPath = path.join(tempDir, 'empty-snapshot.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);

			const fileContent = await fs.promises.readFile(outputPath, 'utf8');
			expect(JSON.parse(fileContent)).toEqual({});
		});

		test('should handle very large snapshot objects', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			// Create large snapshot
			const buildSnapshot = createMockSnapshot({
				fsEntries: Array.from({ length: 10_000 }, (_, index) => ({
					path: `/mock/build/file${index}.js`,
					size: 1000 + index,
					gzipSize: 500 + index,
				})),
			});

			const outputPath = path.join(tempDir, 'large-snapshot.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);
			expect(fs.existsSync(outputPath)).toBe(true);

			// Check that file contains all data
			const fileContent = await fs.promises.readFile(outputPath, 'utf8');
			const parsedContent = JSON.parse(fileContent);
			expect(parsedContent.fsEntries).toHaveLength(10_000);
		});

		test('should handle special characters in file paths', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const outputPath = path.join(tempDir, 'снапшот с пробелами и émojis 🚀.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);
			expect(fs.existsSync(outputPath)).toBe(true);
		});

		test('should handle undefined and undefined values in snapshot', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot({
				undefinedValue1: undefined,
				undefinedValue: undefined,
				emptyString: '',
				zeroValue: 0,
			});

			const outputPath = path.join(tempDir, 'undefined-values-snapshot.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);

			const fileContent = await fs.promises.readFile(outputPath, 'utf8');
			const parsedContent = JSON.parse(fileContent);

			expect(parsedContent).not.toHaveProperty('undefinedValue1'); // undefined is excluded from JSON
			expect(parsedContent).not.toHaveProperty('undefinedValue'); // undefined is excluded from JSON
			expect(parsedContent.emptyString).toBe('');
			expect(parsedContent.zeroValue).toBe(0);
		});

		test('should overwrite existing files', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const outputPath = path.join(tempDir, 'overwrite-test.json');

			// Create first snapshot
			const firstSnapshot = createMockSnapshot({ project: 'first-project' });
			await writeSnapshotFile({ buildSnapshot: firstSnapshot, outputPath });

			// Overwrite with second snapshot
			const secondSnapshot = createMockSnapshot({ project: 'second-project' });
			const result = await writeSnapshotFile({ buildSnapshot: secondSnapshot, outputPath });

			expect(result).toBe(`${outputPath} has been saved`);

			// Check that file contains second snapshot data
			const fileContent = await fs.promises.readFile(outputPath, 'utf8');
			const parsedContent = JSON.parse(fileContent);
			expect(parsedContent.project).toBe('second-project');
		});
	});

	describe('return value', () => {
		test('should return success message with file path', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const outputPath = path.join(tempDir, 'return-test.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(typeof result).toBe('string');
			expect(result).toContain(outputPath);
			expect(result).toContain('has been saved');
		});

		test('should return consistent message format', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const buildSnapshot = createMockSnapshot();
			const outputPath = path.join(tempDir, 'format-test.json');

			const result = await writeSnapshotFile({ buildSnapshot, outputPath });

			expect(result).toMatch(/^.+ has been saved$/);
		});
	});
});
