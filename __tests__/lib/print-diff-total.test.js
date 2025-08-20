import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import Table from 'cli-table3';
import prettyBytes from 'pretty-bytes';
import colorize from '../../lib/colorize.js';
import getPlural from '../../lib/get-plural.js';
import printDiffTotal from '../../lib/print-diff-total.js';

// Mock dependencies
vi.mock('cli-table3');
vi.mock('pretty-bytes');
vi.mock('../../lib/colorize.js');
vi.mock('../../lib/get-plural.js');

describe('printDiffTotal', () => {
	let mockTable;
	let mockConsoleLog;
	let mockColorize;
	let mockPrettyBytes;
	let mockGetPlural;
	let originalIsTTY;

	beforeEach(() => {
		// Mock console.log
		mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Create table mock
		mockTable = {
			push: vi.fn(),
			toString: vi.fn().mockReturnValue('mocked table output'),
		};

		// Mock Table constructor
		const MockTable = vi.mocked(Table);
		MockTable.mockImplementation(() => mockTable);

		// Mock colorize
		mockColorize = vi.mocked(colorize);
		mockColorize.mockImplementation(text => ({
			dim: text + '_dim',
			red: text + '_red',
			green: text + '_green',
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

		// Mock getPlural
		mockGetPlural = vi.mocked(getPlural);
		mockGetPlural.mockImplementation((count, singular, plural) => Math.abs(count) === 1 ? singular : plural);

		// Save original isTTY value
		originalIsTTY = process.stdout.isTTY;
	});

	afterEach(() => {
		// Restore isTTY
		process.stdout.isTTY = originalIsTTY;
		vi.restoreAllMocks();
	});

	describe('identical snapshots', () => {
		test('should show "No changes" for identical snapshots', () => {
			const snapshot = {
				all: { files: 10, size: 1000, gzipSize: 500 },
				js: { files: 5, size: 600, gzipSize: 300 },
				other: { files: 5, size: 400, gzipSize: 200 },
			};

			printDiffTotal({
				left: snapshot,
				right: snapshot,
				leftCaption: 'Left',
				rightCaption: 'Right',
			});

			expect(mockConsoleLog).toHaveBeenCalledWith('', 'No changes');
			expect(mockTable.push).not.toHaveBeenCalled();
		});

		test('should handle empty snapshots', () => {
			const emptySnapshot = {
				all: { files: 0, size: 0, gzipSize: 0 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			printDiffTotal({
				left: emptySnapshot,
				right: emptySnapshot,
				leftCaption: 'Empty Left',
				rightCaption: 'Empty Right',
			});

			expect(mockConsoleLog).toHaveBeenCalledWith('', 'No changes');
		});
	});

	describe('different snapshots', () => {
		test('should create table for different snapshots', () => {
			const left = {
				all: { files: 10, size: 1000, gzipSize: 500 },
				js: { files: 5, size: 600, gzipSize: 300 },
				css: { files: 2, size: 200, gzipSize: 100 },
				other: { files: 3, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 12, size: 1200, gzipSize: 600 },
				js: { files: 6, size: 700, gzipSize: 350 },
				css: { files: 2, size: 250, gzipSize: 125 },
				other: { files: 4, size: 250, gzipSize: 125 },
			};

			printDiffTotal({
				left,
				right,
				leftCaption: 'Before',
				rightCaption: 'After',
			});

			// Check table creation
			expect(Table).toHaveBeenCalledWith(expect.objectContaining({
				wordWrap: true,
				head: ['', 'Before_dim', 'After_dim', 'Changes_dim'],
			}));

			// Check adding rows to table: js, css (one each), then other+total (together)
			expect(mockTable.push).toHaveBeenCalledTimes(3);
			expect(mockTable.toString).toHaveBeenCalled();
			expect(mockConsoleLog).toHaveBeenCalledWith('mocked table output');
		});

		test('should handle size increases (red color)', () => {
			const left = {
				all: { files: 5, size: 500, gzipSize: 250 },
				js: { files: 3, size: 300, gzipSize: 150 },
				other: { files: 2, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 6, size: 800, gzipSize: 400 },
				js: { files: 4, size: 500, gzipSize: 250 },
				other: { files: 2, size: 300, gzipSize: 150 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Check prettyBytes calls with signed option
			expect(mockPrettyBytes).toHaveBeenCalledWith(300, { signed: true }); // size diff
			expect(mockPrettyBytes).toHaveBeenCalledWith(150, { signed: true }); // gzip diff

			// Check use of red color for increase
			expect(mockColorize).toHaveBeenCalledWith(expect.stringContaining('+300B'));
		});

		test('should handle size decreases (green color)', () => {
			const left = {
				all: { files: 6, size: 800, gzipSize: 400 },
				js: { files: 4, size: 500, gzipSize: 250 },
				other: { files: 2, size: 300, gzipSize: 150 },
			};

			const right = {
				all: { files: 5, size: 500, gzipSize: 250 },
				js: { files: 3, size: 300, gzipSize: 150 },
				other: { files: 2, size: 200, gzipSize: 100 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Check prettyBytes calls with negative values
			expect(mockPrettyBytes).toHaveBeenCalledWith(-300, { signed: true });
			expect(mockPrettyBytes).toHaveBeenCalledWith(-150, { signed: true });
		});

		test('should handle file count changes', () => {
			const left = {
				all: { files: 5, size: 500, gzipSize: 500 },
				js: { files: 3, size: 300, gzipSize: 300 },
				other: { files: 2, size: 200, gzipSize: 200 },
			};

			const right = {
				all: { files: 7, size: 500, gzipSize: 500 },
				js: { files: 5, size: 300, gzipSize: 300 },
				other: { files: 2, size: 200, gzipSize: 200 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Check getPlural calls for files
			expect(mockGetPlural).toHaveBeenCalledWith(2, 'item', 'items'); // +2 files
		});

		test('should handle mixed categories', () => {
			const left = {
				all: { files: 10, size: 1000, gzipSize: 500 },
				js: { files: 5, size: 600, gzipSize: 300 },
				css: { files: 2, size: 200, gzipSize: 100 },
				images: { files: 1, size: 100, gzipSize: 50 },
				other: { files: 2, size: 100, gzipSize: 50 },
			};

			const right = {
				all: { files: 8, size: 900, gzipSize: 450 },
				js: { files: 4, size: 500, gzipSize: 250 },
				css: { files: 2, size: 250, gzipSize: 125 },
				// images category is missing in right
				other: { files: 2, size: 150, gzipSize: 75 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Only categories present in both snapshots should be processed
			// js, css - present in both
			// images - only in left, should not be processed
			expect(mockTable.push).toHaveBeenCalledTimes(3); // js, css, other+total
		});
	});

	describe('table formatting', () => {
		test('should configure table for TTY output', () => {
			process.stdout.isTTY = true;

			const left = { all: { files: 1, size: 100, gzipSize: 50 }, other: { files: 1, size: 100, gzipSize: 50 } };
			const right = { all: { files: 2, size: 200, gzipSize: 100 }, other: { files: 2, size: 200, gzipSize: 100 } };

			printDiffTotal({
				left, right, leftCaption: 'Left', rightCaption: 'Right',
			});

			expect(Table).toHaveBeenCalledWith(expect.objectContaining({
				style: expect.objectContaining({
					compact: false,
					head: [],
				}),
			}));
		});

		test('should configure table for non-TTY output', () => {
			process.stdout.isTTY = false;

			const left = { all: { files: 1, size: 100, gzipSize: 50 }, other: { files: 1, size: 100, gzipSize: 50 } };
			const right = { all: { files: 2, size: 200, gzipSize: 100 }, other: { files: 2, size: 200, gzipSize: 100 } };

			printDiffTotal({
				left, right, leftCaption: 'Left', rightCaption: 'Right',
			});

			expect(Table).toHaveBeenCalledWith(expect.objectContaining({
				style: expect.objectContaining({
					border: [],
				}),
			}));
		});

		test('should use custom table characters', () => {
			const left = { all: { files: 1, size: 100, gzipSize: 50 }, other: { files: 1, size: 100, gzipSize: 50 } };
			const right = { all: { files: 2, size: 200, gzipSize: 100 }, other: { files: 2, size: 200, gzipSize: 100 } };

			printDiffTotal({
				left, right, leftCaption: 'Left', rightCaption: 'Right',
			});

			expect(Table).toHaveBeenCalledWith(expect.objectContaining({
				chars: expect.objectContaining({
					top: '—',
					'top-mid': '—',
					'top-left': ' ',
					'top-right': ' ',
				}),
			}));
		});
	});

	describe('size formatting', () => {
		test('should format sizes when size equals gzipSize', () => {
			const left = {
				all: { files: 1, size: 100, gzipSize: 100 },
				other: { files: 1, size: 100, gzipSize: 100 },
			};

			const right = {
				all: { files: 1, size: 200, gzipSize: 200 },
				other: { files: 1, size: 200, gzipSize: 200 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Left', rightCaption: 'Right',
			});

			// When size === gzipSize, only one size should be shown
			expect(mockPrettyBytes).toHaveBeenCalledWith(100);
			expect(mockPrettyBytes).toHaveBeenCalledWith(200);
		});

		test('should format sizes when size differs from gzipSize', () => {
			const left = {
				all: { files: 1, size: 200, gzipSize: 100 },
				other: { files: 1, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 1, size: 400, gzipSize: 200 },
				other: { files: 1, size: 400, gzipSize: 200 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Left', rightCaption: 'Right',
			});

			// When size !== gzipSize, both sizes should be shown
			expect(mockPrettyBytes).toHaveBeenCalledWith(200);
			expect(mockPrettyBytes).toHaveBeenCalledWith(100);
			expect(mockPrettyBytes).toHaveBeenCalledWith(400);
		});
	});

	describe('edge cases', () => {
		test('should handle zero differences', () => {
			const left = {
				all: { files: 5, size: 500, gzipSize: 250 },
				js: { files: 3, size: 300, gzipSize: 150 },
				other: { files: 2, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 5, size: 600, gzipSize: 250 }, // only size changed
				js: { files: 3, size: 300, gzipSize: 150 }, // no changes
				other: { files: 2, size: 300, gzipSize: 100 }, // only size changed
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			expect(mockTable.push).toHaveBeenCalled();
		});

		test('should handle missing categories gracefully', () => {
			const left = {
				all: { files: 5, size: 500, gzipSize: 250 },
				js: { files: 3, size: 300, gzipSize: 150 },
				other: { files: 2, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 3, size: 400, gzipSize: 200 },
				// js category is missing
				css: { files: 1, size: 100, gzipSize: 50 }, // new category
				other: { files: 2, size: 300, gzipSize: 150 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Only category other should be processed (present in both)
			expect(mockTable.push).toHaveBeenCalledTimes(1); // other+total (together)
		});

		test('should handle undefined parameters', () => {
			// Function should throw error with undefined parameters
			expect(() => printDiffTotal()).toThrow();
		});

		test('should handle snapshots without other category', () => {
			const left = {
				all: { files: 5, size: 500, gzipSize: 250 },
				js: { files: 5, size: 500, gzipSize: 250 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			const right = {
				all: { files: 6, size: 600, gzipSize: 300 },
				js: { files: 6, size: 600, gzipSize: 300 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			expect(mockTable.push).toHaveBeenCalledTimes(2); // js, other+total
		});

		test('should exclude "all" and "other" from category filtering', () => {
			const left = {
				all: { files: 10, size: 1000, gzipSize: 500 },
				js: { files: 5, size: 500, gzipSize: 250 },
				css: { files: 2, size: 200, gzipSize: 100 },
				other: { files: 3, size: 300, gzipSize: 150 },
			};

			const right = {
				all: { files: 12, size: 1200, gzipSize: 600 },
				js: { files: 6, size: 600, gzipSize: 300 },
				css: { files: 3, size: 300, gzipSize: 150 },
				other: { files: 3, size: 300, gzipSize: 150 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// js, css (categories), other+total
			expect(mockTable.push).toHaveBeenCalledTimes(3);
		});
	});

	describe('colorization', () => {
		test('should use dim color for category names and headers', () => {
			const left = {
				all: { files: 1, size: 100, gzipSize: 50 },
				js: { files: 1, size: 100, gzipSize: 50 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			const right = {
				all: { files: 2, size: 200, gzipSize: 100 },
				js: { files: 2, size: 200, gzipSize: 100 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Check use of dim for headers
			expect(mockColorize).toHaveBeenCalledWith('Before');
			expect(mockColorize).toHaveBeenCalledWith('After');
			expect(mockColorize).toHaveBeenCalledWith('Changes');

			// Check use of dim for category names
			expect(mockColorize).toHaveBeenCalledWith('js');
			expect(mockColorize).toHaveBeenCalledWith('Other');
		});

		test('should use red color for size increases', () => {
			const left = {
				all: { files: 1, size: 100, gzipSize: 50 },
				other: { files: 1, size: 100, gzipSize: 50 },
			};

			const right = {
				all: { files: 1, size: 200, gzipSize: 100 },
				other: { files: 1, size: 200, gzipSize: 100 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Red color should be used for size increase
			const redColorCalls = mockColorize.mock.calls.filter(call =>
				call[0].includes('+100B'), // size increased
			);
			expect(redColorCalls.length).toBeGreaterThan(0);
		});

		test('should use green color for size decreases', () => {
			const left = {
				all: { files: 1, size: 200, gzipSize: 100 },
				other: { files: 1, size: 200, gzipSize: 100 },
			};

			const right = {
				all: { files: 1, size: 100, gzipSize: 50 },
				other: { files: 1, size: 100, gzipSize: 50 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// Green color should be used for size decrease
			const greenColorCalls = mockColorize.mock.calls.filter(call =>
				call[0].includes('-100B'), // size decreased
			);
			expect(greenColorCalls.length).toBeGreaterThan(0);
		});

		test('should use dim color for no changes', () => {
			const left = {
				all: { files: 1, size: 100, gzipSize: 100 },
				js: { files: 1, size: 100, gzipSize: 100 },
				other: { files: 0, size: 0, gzipSize: 0 },
			};

			const right = {
				all: { files: 2, size: 200, gzipSize: 200 },
				js: { files: 1, size: 100, gzipSize: 100 }, // no changes
				other: { files: 1, size: 100, gzipSize: 100 },
			};

			printDiffTotal({
				left, right, leftCaption: 'Before', rightCaption: 'After',
			});

			// There should be no changes for js category
			expect(mockColorize).toHaveBeenCalledWith('No changes');
		});
	});
});
