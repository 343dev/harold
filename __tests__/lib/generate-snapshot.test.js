import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import fs from 'node:fs';

import { execSync } from 'node:child_process';
import fg from 'fast-glob';
import { gzipSizeFromFileSync } from 'gzip-size';
import generateSnapshot from '../../lib/generate-snapshot.js';

// Mock external dependencies
vi.mock('fast-glob');
vi.mock('gzip-size');
vi.mock('node:child_process');

describe('generateSnapshot', () => {
	let mockFg;
	let mockGzipSize;
	let mockExecSync;

	beforeEach(() => {
		// Mock fast-glob
		mockFg = vi.mocked(fg);
		mockFg.sync = vi.fn();

		// Mock gzip-size
		mockGzipSize = vi.mocked(gzipSizeFromFileSync);
		mockGzipSize.mockReturnValue(100);

		// Mock execSync
		mockExecSync = vi.mocked(execSync);
		mockExecSync.mockReturnValue(Buffer.from('main'));

		// Mock fs.statSync
		vi.spyOn(fs, 'statSync').mockReturnValue({
			isDirectory: () => true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('successful snapshot generation', () => {
		test('should generate snapshot with basic structure', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 500_000_000];
			const categories = { js: /\.js$/, css: /\.css$/ };

			// Mock directory search
			mockFg.sync.mockReturnValueOnce(['/mock/build/assets/']);

			// Mock file search
			mockFg.sync
				.mockReturnValueOnce([
					{ path: '/mock/build/index.html', stats: { size: 1000 } },
					{ path: '/mock/build/app.js', stats: { size: 2000 } },
				])
				.mockReturnValueOnce([
					{ path: '/mock/build/assets/style.css', stats: { size: 500 } },
				]);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result).toHaveProperty('project');
			expect(result).toHaveProperty('gitRef', 'main');
			expect(result).toHaveProperty('date');
			expect(result).toHaveProperty('buildTime', buildTime);
			expect(result).toHaveProperty('total');
			expect(result).toHaveProperty('fsEntries');
		});

		test('should calculate totals correctly', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = { js: /\.js$/ };

			mockFg.sync.mockReturnValueOnce([]);
			mockFg.sync.mockReturnValueOnce([
				{ path: '/mock/build/app.js', stats: { size: 1000 } },
				{ path: '/mock/build/style.css', stats: { size: 500 } },
			]);

			mockGzipSize
				.mockReturnValueOnce(400)
				.mockReturnValueOnce(200);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total.js).toEqual({ files: 1, size: 1000, gzipSize: 400 });
			expect(result.total.all).toEqual({ files: 2, size: 1500, gzipSize: 600 });
			expect(result.total.other).toEqual({ files: 1, size: 500, gzipSize: 200 });
		});

		test('should handle empty categories', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValueOnce([]);
			mockFg.sync.mockReturnValueOnce([
				{ path: '/mock/build/file.txt', stats: { size: 100 } },
			]);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total).toHaveProperty('all');
			expect(result.total).not.toHaveProperty('other');
		});

		test('should handle git reference correctly', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValue([]);

			// Test with branch
			mockExecSync.mockReturnValueOnce(Buffer.from('feature-branch'));
			let result = generateSnapshot({ buildDirectory, buildTime, categories });
			expect(result.gitRef).toBe('feature-branch');

			// Test with commit
			mockExecSync
				.mockReturnValueOnce(Buffer.from(''))
				.mockReturnValueOnce(Buffer.from('abcdef1234567890'));
			result = generateSnapshot({ buildDirectory, buildTime, categories });
			expect(result.gitRef).toBe('abcdef');

			// Test without git
			mockExecSync.mockImplementation(() => {
				throw new Error('Not a git repository');
			});
			result = generateSnapshot({ buildDirectory, buildTime, categories });
			expect(result).not.toHaveProperty('gitRef');
		});
	});

	describe('error handling', () => {
		test('should throw error when buildDirectory is not provided', () => {
			expect(() => generateSnapshot({ buildTime: [1, 0], categories: {} }))
				.toThrow('Build path is not set');
		});

		test('should throw error when buildDirectory is empty', () => {
			expect(() => generateSnapshot({ buildDirectory: '', buildTime: [1, 0], categories: {} }))
				.toThrow('Build path is not set');
		});

		test('should throw error when buildDirectory is not a directory', () => {
			vi.spyOn(fs, 'statSync').mockReturnValueOnce({
				isDirectory: () => false,
			});

			expect(() => generateSnapshot({
				buildDirectory: '/mock/file.txt',
				buildTime: [1, 0],
				categories: {},
			})).toThrow('is not a directory');
		});

		test('should throw error when buildDirectory does not exist', () => {
			vi.spyOn(fs, 'statSync').mockImplementation(() => {
				throw new Error('ENOENT: no such file or directory');
			});

			expect(() => generateSnapshot({
				buildDirectory: '/nonexistent',
				buildTime: [1, 0],
				categories: {},
			})).toThrow('ENOENT');
		});
	});

	describe('file system entries', () => {
		test('should create correct fsEntries structure', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValueOnce(['/mock/build/assets/']);
			mockFg.sync
				.mockReturnValueOnce([
					{ path: '/mock/build/index.html', stats: { size: 1000 } },
				])
				.mockReturnValueOnce([
					{ path: '/mock/build/assets/style.css', stats: { size: 500 } },
				]);

			mockGzipSize
				.mockReturnValueOnce(400)
				.mockReturnValueOnce(200);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.fsEntries).toHaveLength(4); // 2 directories + 2 files

			const fileEntry = result.fsEntries.find(entry =>
				entry.path === '/mock/build/index.html',
			);
			expect(fileEntry).toEqual({
				path: '/mock/build/index.html',
				size: 1000,
				gzipSize: 400,
			});
		});
	});

	describe('category filtering', () => {
		test('should filter files by regex patterns correctly', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {
				js: /\.js$/,
				css: /\.css$/,
				images: /\.(png|jpg|jpeg|gif)$/,
			};

			mockFg.sync.mockReturnValueOnce([]);
			mockFg.sync.mockReturnValueOnce([
				{ path: '/mock/build/app.js', stats: { size: 1000 } },
				{ path: '/mock/build/style.css', stats: { size: 500 } },
				{ path: '/mock/build/logo.png', stats: { size: 2000 } },
				{ path: '/mock/build/index.html', stats: { size: 800 } },
			]);

			mockGzipSize
				.mockReturnValueOnce(400)
				.mockReturnValueOnce(200)
				.mockReturnValueOnce(1800)
				.mockReturnValueOnce(300);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total.js).toEqual({ files: 1, size: 1000, gzipSize: 400 });
			expect(result.total.css).toEqual({ files: 1, size: 500, gzipSize: 200 });
			expect(result.total.images).toEqual({ files: 1, size: 2000, gzipSize: 1800 });
			expect(result.total.other).toEqual({ files: 1, size: 800, gzipSize: 300 });
			expect(result.total.all).toEqual({ files: 4, size: 4300, gzipSize: 2700 });
		});
	});

	describe('edge cases', () => {
		test('should handle empty build directory', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValue([]);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total.all).toEqual({ files: 0, size: 0, gzipSize: 0 });
		});

		test('should handle very large files', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValueOnce([]);
			mockFg.sync.mockReturnValueOnce([
				{ path: '/mock/build/huge-file.bin', stats: { size: Number.MAX_SAFE_INTEGER } },
			]);

			mockGzipSize.mockReturnValueOnce(1_000_000);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total.all.size).toBe(Number.MAX_SAFE_INTEGER);
			expect(result.total.all.gzipSize).toBe(1_000_000);
		});

		test('should handle special characters in file paths', () => {
			const buildDirectory = '/mock/build';
			const buildTime = [1, 0];
			const categories = {};

			mockFg.sync.mockReturnValueOnce([]);
			mockFg.sync.mockReturnValueOnce([
				{ path: '/mock/build/файл с пробелами.txt', stats: { size: 100 } },
				{ path: '/mock/build/file-with-émojis-🚀.js', stats: { size: 200 } },
			]);

			const result = generateSnapshot({ buildDirectory, buildTime, categories });

			expect(result.total.all.files).toBe(2);
			expect(result.fsEntries.some(entry =>
				entry.path === '/mock/build/файл с пробелами.txt',
			)).toBe(true);
		});
	});
});
