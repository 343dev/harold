import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import prettyBytes from 'pretty-bytes';
import colorize from '../../lib/colorize.js';
import printDiffFileTree from '../../lib/print-diff-file-tree.js';

// Mock dependencies
vi.mock('pretty-bytes');
vi.mock('../../lib/colorize.js');

describe('printDiffFileTree', () => {
	let mockConsoleLog;
	let mockColorize;
	let mockPrettyBytes;

	beforeEach(() => {
		// Mock console.log
		mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Mock colorize
		mockColorize = vi.mocked(colorize);
		mockColorize.mockImplementation((...arguments_) => ({
			reset: arguments_.join(' ') + '_reset',
			red: arguments_.join(' ') + '_red',
			green: arguments_.join(' ') + '_green',
		}));

		// Mock prettyBytes
		mockPrettyBytes = vi.mocked(prettyBytes);
		mockPrettyBytes.mockImplementation((bytes, options) => {
			if (options?.signed && bytes > 0) {
				return `+${bytes}B`;
			}

			if (options?.signed && bytes < 0) {
				return `${bytes}B`;
			}

			return `${Math.abs(bytes)}B`;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('identical file trees', () => {
		test('should show "No changes" for identical file trees', () => {
			const fileTree = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/styles.css', size: 200, gzipSize: 100 },
			];

			printDiffFileTree(fileTree, fileTree);

			expect(mockConsoleLog).toHaveBeenCalledWith('', 'No changes');
		});

		test('should handle empty file trees', () => {
			const emptyTree = [];

			printDiffFileTree(emptyTree, emptyTree);

			expect(mockConsoleLog).toHaveBeenCalledWith('', 'No changes');
		});
	});

	describe('different file trees', () => {
		test('should show added files in green', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
			];

			const right = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/new-feature.js', size: 300, gzipSize: 150 },
			];

			printDiffFileTree(left, right);

			expect(mockPrettyBytes).toHaveBeenCalledWith(300);
			expect(mockPrettyBytes).toHaveBeenCalledWith(150);
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/new-feature.js:', '300B', '(150B)');
			expect(mockConsoleLog).toHaveBeenCalledWith('', expect.stringContaining('_green'));
		});

		test('should show deleted files in red', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/old-feature.js', size: 400, gzipSize: 200 },
			];

			const right = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
			];

			printDiffFileTree(left, right);

			expect(mockPrettyBytes).toHaveBeenCalledWith(400);
			expect(mockPrettyBytes).toHaveBeenCalledWith(200);
			expect(mockColorize).toHaveBeenCalledWith('-', '/build/old-feature.js:', '400B', '(200B)');
			expect(mockConsoleLog).toHaveBeenCalledWith('', expect.stringContaining('_red'));
		});

		test('should show modified files with size differences', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/styles.css', size: 200, gzipSize: 100 },
			];

			const right = [
				{ path: '/build/app.js', size: 1200, gzipSize: 600 },
				{ path: '/build/styles.css', size: 150, gzipSize: 75 },
			];

			printDiffFileTree(left, right);

			// Check calls for app.js (increase)
			expect(mockPrettyBytes).toHaveBeenCalledWith(200, { signed: true }); // size diff
			expect(mockPrettyBytes).toHaveBeenCalledWith(100, { signed: true }); // gzip diff

			// Check calls for styles.css (decrease)
			expect(mockPrettyBytes).toHaveBeenCalledWith(-50, { signed: true }); // size diff
			expect(mockPrettyBytes).toHaveBeenCalledWith(-25, { signed: true }); // gzip diff

			expect(mockColorize).toHaveBeenCalledWith('m', '/build/app.js:', '+200B', '(+100B)');
			expect(mockColorize).toHaveBeenCalledWith('m', '/build/styles.css:', '-50B', '(-25B)');
		});

		test('should handle mixed changes (added, deleted, modified)', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/old.js', size: 300, gzipSize: 150 },
				{ path: '/build/styles.css', size: 200, gzipSize: 100 },
			];

			const right = [
				{ path: '/build/app.js', size: 1200, gzipSize: 600 }, // modified
				{ path: '/build/new.js', size: 400, gzipSize: 200 }, // added
				{ path: '/build/styles.css', size: 200, gzipSize: 100 }, // unchanged
			];

			printDiffFileTree(left, right);

			// Check added file
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/new.js:', '400B', '(200B)');

			// Check removed file
			expect(mockColorize).toHaveBeenCalledWith('-', '/build/old.js:', '300B', '(150B)');

			// Check modified file
			expect(mockColorize).toHaveBeenCalledWith('m', '/build/app.js:', '+200B', '(+100B)');

			// Check number of console.log calls (3 changes)
			expect(mockConsoleLog).toHaveBeenCalledTimes(3);
		});

		test('should sort files alphabetically', () => {
			const left = [];

			const right = [
				{ path: '/build/z-last.js', size: 100, gzipSize: 50 },
				{ path: '/build/a-first.js', size: 200, gzipSize: 100 },
				{ path: '/build/m-middle.js', size: 150, gzipSize: 75 },
			];

			printDiffFileTree(left, right);

			// Check order of console.log calls
			const { calls } = mockConsoleLog.mock;
			expect(calls[0][1]).toContain('/build/a-first.js');
			expect(calls[1][1]).toContain('/build/m-middle.js');
			expect(calls[2][1]).toContain('/build/z-last.js');
		});
	});

	describe('file modification detection', () => {
		test('should not show files with zero size difference', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
				{ path: '/build/unchanged.js', size: 200, gzipSize: 100 },
			];

			const right = [
				{ path: '/build/app.js', size: 1200, gzipSize: 600 }, // changed
				{ path: '/build/unchanged.js', size: 200, gzipSize: 100 }, // unchanged
			];

			printDiffFileTree(left, right);

			// Should show only modified file
			expect(mockConsoleLog).toHaveBeenCalledTimes(1);
			expect(mockColorize).toHaveBeenCalledWith('m', '/build/app.js:', '+200B', '(+100B)');
			expect(mockColorize).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('unchanged.js'), expect.anything(), expect.anything());
		});

		test('should not detect changes when only gzip size changes but main size is unchanged', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
			];

			const right = [
				{ path: '/build/app.js', size: 1000, gzipSize: 600 }, // same size, different gzip
			];

			printDiffFileTree(left, right);

			// Function checks only size changes, not gzipSize
			// Therefore file should not be shown as modified
			expect(mockConsoleLog).not.toHaveBeenCalled();
		});

		test('should handle negative size changes', () => {
			const left = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
			];

			const right = [
				{ path: '/build/app.js', size: 800, gzipSize: 400 },
			];

			printDiffFileTree(left, right);

			expect(mockPrettyBytes).toHaveBeenCalledWith(-200, { signed: true });
			expect(mockPrettyBytes).toHaveBeenCalledWith(-100, { signed: true });
			expect(mockColorize).toHaveBeenCalledWith('m', '/build/app.js:', '-200B', '(-100B)');
		});
	});

	describe('edge cases', () => {
		test('should handle files with same path but different cases', () => {
			const left = [
				{ path: '/build/App.js', size: 1000, gzipSize: 500 },
			];

			const right = [
				{ path: '/build/app.js', size: 1000, gzipSize: 500 },
			];

			printDiffFileTree(left, right);

			// Should be treated as different files
			expect(mockConsoleLog).toHaveBeenCalledTimes(2);
			expect(mockColorize).toHaveBeenCalledWith('-', '/build/App.js:', '1000B', '(500B)');
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/app.js:', '1000B', '(500B)');
		});

		test('should handle empty file paths', () => {
			const left = [
				{ path: '', size: 100, gzipSize: 50 },
			];

			const right = [];

			printDiffFileTree(left, right);

			expect(mockColorize).toHaveBeenCalledWith('-', ':', '100B', '(50B)');
		});

		test('should handle files with zero sizes', () => {
			const left = [];

			const right = [
				{ path: '/build/empty.txt', size: 0, gzipSize: 0 },
			];

			printDiffFileTree(left, right);

			expect(mockPrettyBytes).toHaveBeenCalledWith(0);
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/empty.txt:', '0B', '(0B)');
		});

		test('should handle very large files', () => {
			const left = [];

			const right = [
				{ path: '/build/large.js', size: 10_000_000, gzipSize: 5_000_000 },
			];

			printDiffFileTree(left, right);

			expect(mockPrettyBytes).toHaveBeenCalledWith(10_000_000);
			expect(mockPrettyBytes).toHaveBeenCalledWith(5_000_000);
		});

		test('should handle special characters in file paths', () => {
			const left = [];

			const right = [
				{ path: '/build/файл-с-кириллицей.js', size: 100, gzipSize: 50 },
				{ path: '/build/file with spaces.js', size: 200, gzipSize: 100 },
				{ path: '/build/file@#$%^&*().js', size: 300, gzipSize: 150 },
			];

			printDiffFileTree(left, right);

			expect(mockColorize).toHaveBeenCalledWith('+', '/build/файл-с-кириллицей.js:', '100B', '(50B)');
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/file with spaces.js:', '200B', '(100B)');
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/file@#$%^&*().js:', '300B', '(150B)');
		});
	});

	describe('colorization', () => {
		test('should use green color for added files', () => {
			const left = [];
			const right = [
				{ path: '/build/new.js', size: 100, gzipSize: 50 },
			];

			printDiffFileTree(left, right);

			expect(mockConsoleLog).toHaveBeenCalledWith('', expect.stringContaining('_green'));
		});

		test('should use red color for deleted files', () => {
			const left = [
				{ path: '/build/old.js', size: 100, gzipSize: 50 },
			];
			const right = [];

			printDiffFileTree(left, right);

			expect(mockConsoleLog).toHaveBeenCalledWith('', expect.stringContaining('_red'));
		});

		test('should use reset color for modified files', () => {
			const left = [
				{ path: '/build/app.js', size: 100, gzipSize: 50 },
			];
			const right = [
				{ path: '/build/app.js', size: 200, gzipSize: 100 },
			];

			printDiffFileTree(left, right);

			expect(mockConsoleLog).toHaveBeenCalledWith('', expect.stringContaining('_reset'));
		});
	});

	describe('path comparison', () => {
		test('should correctly identify files by exact path match', () => {
			const left = [
				{ path: '/build/app.js', size: 100, gzipSize: 50 },
				{ path: '/build/lib/utils.js', size: 200, gzipSize: 100 },
			];

			const right = [
				{ path: '/build/app.js', size: 150, gzipSize: 75 },
				{ path: '/build/lib/helper.js', size: 200, gzipSize: 100 }, // different file
			];

			printDiffFileTree(left, right);

			// app.js - modified
			expect(mockColorize).toHaveBeenCalledWith('m', '/build/app.js:', '+50B', '(+25B)');

			// utils.js - deleted
			expect(mockColorize).toHaveBeenCalledWith('-', '/build/lib/utils.js:', '200B', '(100B)');

			// helper.js - added
			expect(mockColorize).toHaveBeenCalledWith('+', '/build/lib/helper.js:', '200B', '(100B)');

			expect(mockConsoleLog).toHaveBeenCalledTimes(3);
		});

		test('should handle duplicate paths in same tree', () => {
			const left = [
				{ path: '/build/app.js', size: 100, gzipSize: 50 },
				{ path: '/build/app.js', size: 200, gzipSize: 100 }, // duplicate
			];

			const right = [
				{ path: '/build/app.js', size: 150, gzipSize: 75 },
			];

			printDiffFileTree(left, right);

			// Function should handle duplicates correctly
			// First found file will be used for comparison
			expect(mockConsoleLog).toHaveBeenCalled();
		});
	});

	describe('performance with large datasets', () => {
		test('should handle large number of files', () => {
			const left = Array.from({ length: 1000 }, (_, index) => ({
				path: `/build/file${index}.js`,
				size: 100 + index,
				gzipSize: 50 + index,
			}));

			const right = Array.from({ length: 1000 }, (_, index) => ({
				path: `/build/file${index}.js`,
				size: 200 + index, // all files increased by 100
				gzipSize: 100 + index, // all files increased by 50
			}));

			printDiffFileTree(left, right);

			// All files should be marked as modified
			expect(mockConsoleLog).toHaveBeenCalledTimes(1000);
		});
	});

	describe('function behavior', () => {
		test('should not modify input arrays', () => {
			const left = [
				{ path: '/build/app.js', size: 100, gzipSize: 50 },
			];
			const right = [
				{ path: '/build/app.js', size: 200, gzipSize: 100 },
			];

			const leftCopy = structuredClone(left);
			const rightCopy = structuredClone(right);

			printDiffFileTree(left, right);

			// Input arrays should not change
			expect(left).toEqual(leftCopy);
			expect(right).toEqual(rightCopy);
		});

		test('should handle undefined inputs gracefully', () => {
			expect(() => printDiffFileTree()).toThrow();
			// Empty arrays are handled correctly
			expect(() => printDiffFileTree([], [])).not.toThrow();
		});
	});
});
