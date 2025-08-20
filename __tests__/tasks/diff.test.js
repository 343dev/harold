import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';

import diff from '../../tasks/diff.js';
import colorize from '../../lib/colorize.js';
import printBuildTime from '../../lib/print-build-time.js';
import printDiffFileTree from '../../lib/print-diff-file-tree.js';
import printDiffTotal from '../../lib/print-diff-total.js';
import printSnapshotInfo from '../../lib/print-snapshot-info.js';
import {
	createMockSnapshot, createTempDir, cleanupTempDir, createTempFile as createTemporaryFile,
} from '../test-utils.js';

// Mock dependencies
vi.mock('../../lib/colorize.js');
vi.mock('../../lib/print-build-time.js');
vi.mock('../../lib/print-diff-file-tree.js');
vi.mock('../../lib/print-diff-total.js');
vi.mock('../../lib/print-snapshot-info.js');

describe('diff', () => {
	let temporaryDirectories = [];
	let consoleLogSpy;
	let processExitSpy;

	beforeEach(() => {
		temporaryDirectories = [];

		// Mock console.log
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Mock process.exit
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		// Configure colorize to return object with cyan property
		vi.mocked(colorize).mockReturnValue({ cyan: 'mocked colored text' });
	});

	afterEach(async () => {
		// Clean up temporary directories
		for (const directory of temporaryDirectories) {
			await cleanupTempDir(directory);
		}

		vi.restoreAllMocks();
	});

	describe('identical snapshots', () => {
		test('should exit when snapshots are identical', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const snapshot = createMockSnapshot();
			const snapshotContent = JSON.stringify(snapshot, undefined, 2);

			// Create two identical snapshot files
			const leftPath = await createTemporaryFile(snapshotContent, 'left.json', tempDir);
			const rightPath = await createTemporaryFile(snapshotContent, 'right.json', tempDir);

			expect(() => diff(leftPath, rightPath)).toThrow('process.exit called');

			expect(consoleLogSpy).toHaveBeenCalledWith('Snapshots are equal');
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		test('should compare file buffers, not just content', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const snapshot = createMockSnapshot();

			// Create files with same content but different formatting
			const leftContent = JSON.stringify(snapshot);
			const rightContent = JSON.stringify(snapshot, undefined, 2);

			const leftPath = await createTemporaryFile(leftContent, 'left.json', tempDir);
			const rightPath = await createTemporaryFile(rightContent, 'right.json', tempDir);

			// Files should be considered different due to different formatting
			diff(leftPath, rightPath);

			expect(processExitSpy).not.toHaveBeenCalled();
			expect(vi.mocked(printSnapshotInfo)).toHaveBeenCalled();
		});
	});

	describe('different snapshots', () => {
		test('should display full diff output for different snapshots', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftSnapshot = createMockSnapshot({
				project: 'left-project',
				buildTime: [1, 0],
				total: { all: { files: 5, size: 1000, gzipSize: 500 } },
			});

			const rightSnapshot = createMockSnapshot({
				project: 'right-project',
				buildTime: [2, 0],
				total: { all: { files: 10, size: 2000, gzipSize: 1000 } },
			});

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'left.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'right.json', tempDir);

			diff(leftPath, rightPath);

			// Check that all output sections were called
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Snapshots:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Build time:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Diff by category:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Diff by files:');

			expect(vi.mocked(printSnapshotInfo)).toHaveBeenCalledWith(leftSnapshot, 'Left');
			expect(vi.mocked(printSnapshotInfo)).toHaveBeenCalledWith(rightSnapshot, 'Right');

			expect(vi.mocked(printBuildTime)).toHaveBeenCalledWith([1, 0], [2, 0]);

			expect(vi.mocked(printDiffTotal)).toHaveBeenCalledWith({
				left: leftSnapshot.total,
				right: rightSnapshot.total,
				leftCaption: 'left',
				rightCaption: 'right',
			});

			expect(vi.mocked(printDiffFileTree)).toHaveBeenCalledWith(
				leftSnapshot.fsEntries,
				rightSnapshot.fsEntries,
			);
		});

		test('should use file names as captions', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftSnapshot = createMockSnapshot();
			const rightSnapshot = createMockSnapshot({ project: 'different' });

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'snapshot-v1.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'snapshot-v2.json', tempDir);

			diff(leftPath, rightPath);

			expect(vi.mocked(printDiffTotal)).toHaveBeenCalledWith({
				left: leftSnapshot.total,
				right: rightSnapshot.total,
				leftCaption: 'snapshot-v1',
				rightCaption: 'snapshot-v2',
			});
		});
	});

	describe('file handling', () => {
		test('should throw error for non-existent files', () => {
			expect(() => diff('/nonexistent/left.json', '/nonexistent/right.json'))
				.toThrow();
		});

		test('should throw error for invalid JSON', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftPath = await createTemporaryFile('invalid json', 'left.json', tempDir);
			const rightPath = await createTemporaryFile('{ "valid": "json" }', 'right.json', tempDir);

			expect(() => diff(leftPath, rightPath)).toThrow();
		});
	});

	describe('output formatting', () => {
		test('should print section headers with colors', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftSnapshot = createMockSnapshot();
			const rightSnapshot = createMockSnapshot({ project: 'different' });

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'left.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'right.json', tempDir);

			diff(leftPath, rightPath);

			// Check that section headers are output with color
			expect(consoleLogSpy).toHaveBeenCalledWith('mocked colored text');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Snapshots:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Build time:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Diff by category:');
			expect(vi.mocked(colorize)).toHaveBeenCalledWith('Diff by files:');
		});

		test('should print empty lines for spacing', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftSnapshot = createMockSnapshot();
			const rightSnapshot = createMockSnapshot({ project: 'different' });

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'left.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'right.json', tempDir);

			diff(leftPath, rightPath);

			// Check that empty lines are output to separate sections
			expect(consoleLogSpy).toHaveBeenCalledWith();
		});
	});

	describe('edge cases', () => {
		test('should handle empty snapshots', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			// Create different empty snapshots so they are not considered identical
			const leftSnapshot = { total: {}, fsEntries: [], project: 'left' };
			const rightSnapshot = { total: {}, fsEntries: [], project: 'right' };

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'left.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'right.json', tempDir);

			diff(leftPath, rightPath);

			expect(vi.mocked(printDiffTotal)).toHaveBeenCalledWith({
				left: {},
				right: {},
				leftCaption: 'left',
				rightCaption: 'right',
			});

			expect(vi.mocked(printDiffFileTree)).toHaveBeenCalledWith([], []);
		});

		test('should handle snapshots with undefined values', async () => {
			const tempDir = await createTempDir();
			temporaryDirectories.push(tempDir);

			const leftSnapshot = {
				project: undefined,
				buildTime: undefined,
				total: undefined,
				fsEntries: undefined,
			};

			const rightSnapshot = createMockSnapshot();

			const leftPath = await createTemporaryFile(JSON.stringify(leftSnapshot), 'left.json', tempDir);
			const rightPath = await createTemporaryFile(JSON.stringify(rightSnapshot), 'right.json', tempDir);

			diff(leftPath, rightPath);

			expect(vi.mocked(printBuildTime)).toHaveBeenCalledWith(undefined, rightSnapshot.buildTime);
			expect(vi.mocked(printDiffTotal)).toHaveBeenCalledWith({
				left: undefined,
				right: rightSnapshot.total,
				leftCaption: 'left',
				rightCaption: 'right',
			});
		});
	});
});
