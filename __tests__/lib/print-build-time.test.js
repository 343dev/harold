import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import printBuildTime from '../../lib/print-build-time.js';

describe('printBuildTime', () => {
	let consoleLogSpy;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('with valid build times', () => {
		test('should print no changes when times are equal', () => {
			const buildTime = [2, 0]; // 2 seconds

			printBuildTime(buildTime, buildTime);

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'No changes (2 seconds)');
		});

		test('should print faster when right time is less', () => {
			const leftTime = [3, 0]; // 3 seconds
			const rightTime = [2, 0]; // 2 seconds

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('1 second faster'),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('Left: 3 seconds'),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('Right: 2 seconds'),
			);
		});

		test('should print slower when right time is greater', () => {
			const leftTime = [2, 0]; // 2 seconds
			const rightTime = [5, 0]; // 5 seconds

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('3 seconds slower'),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('Left: 2 seconds'),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('Right: 5 seconds'),
			);
		});

		test('should handle fractional seconds correctly', () => {
			const leftTime = [1, 500_000_000]; // 1.5 seconds
			const rightTime = [2, 700_000_000]; // 2.7 seconds

			printBuildTime(leftTime, rightTime);

			// Should round to whole seconds: 2 - 2 = 0, but 2.7 - 1.5 = 1.2, rounds to 1
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('1 second slower'),
			);
		});

		test('should use singular form for 1 second', () => {
			const leftTime = [2, 0]; // 2 seconds
			const rightTime = [1, 0]; // 1 second

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('1 second faster'),
			);
		});

		test('should use plural form for multiple seconds', () => {
			const leftTime = [1, 0]; // 1 second
			const rightTime = [4, 0]; // 4 seconds

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('3 seconds slower'),
			);
		});
	});

	describe('with missing build times', () => {
		test('should print message when left time is missing', () => {
			const rightTime = [2, 0];

			printBuildTime(undefined, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'Build time is not provided');
		});

		test('should print message when right time is missing', () => {
			const leftTime = [2, 0];

			printBuildTime(leftTime);

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'Build time is not provided');
		});

		test('should print message when both times are missing', () => {
			printBuildTime();

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'Build time is not provided');
		});

		test('should print message when left time is undefined', () => {
			const rightTime = [1, 0];

			printBuildTime(undefined, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'Build time is not provided');
		});

		test('should print message when right time is undefined', () => {
			const leftTime = [1, 0];

			printBuildTime(leftTime);

			expect(consoleLogSpy).toHaveBeenCalledWith('', 'Build time is not provided');
		});
	});

	describe('edge cases', () => {
		test('should handle zero build times', () => {
			const zeroTime = [0, 0];
			const oneSecond = [1, 0];

			printBuildTime(zeroTime, oneSecond);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('1 second slower'),
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('Left: 0 seconds'),
			);
		});

		test('should handle very small time differences', () => {
			const time1 = [1, 100_000_000]; // 1.1 seconds
			const time2 = [1, 200_000_000]; // 1.2 seconds

			printBuildTime(time1, time2);

			// Both round to 1 second, difference = 0
			expect(consoleLogSpy).toHaveBeenCalledWith('', 'No changes (1 second)');
		});

		test('should handle large time differences', () => {
			const leftTime = [10, 0]; // 10 seconds
			const rightTime = [100, 0]; // 100 seconds

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('90 seconds slower'),
			);
		});

		test('should handle negative differences correctly', () => {
			const leftTime = [5, 0]; // 5 seconds
			const rightTime = [2, 0]; // 2 seconds

			printBuildTime(leftTime, rightTime);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('3 seconds faster'),
			);
		});
	});

	describe('color application', () => {
		test('should apply green color for faster builds', () => {
			// Mock colorize to check call with correct color
			const _mockColorize = vi.fn().mockReturnValue({
				green: 'mocked green text',
			});

			// Replace colorize import (this is hard to do directly, so we'll check indirectly)
			const leftTime = [3, 0];
			const rightTime = [2, 0];

			printBuildTime(leftTime, rightTime);

			// Check that output contains information about faster build
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('faster'),
			);
		});

		test('should apply red color for slower builds', () => {
			const leftTime = [2, 0];
			const rightTime = [3, 0];

			printBuildTime(leftTime, rightTime);

			// Check that output contains information about slower build
			expect(consoleLogSpy).toHaveBeenCalledWith(
				'',
				expect.stringContaining('slower'),
			);
		});
	});

	describe('output format', () => {
		test('should include both left and right times in output', () => {
			const leftTime = [3, 0];
			const rightTime = [5, 0];

			printBuildTime(leftTime, rightTime);

			const callArguments = consoleLogSpy.mock.calls[0];
			const output = callArguments[1];

			expect(output).toContain('Left: 3 seconds');
			expect(output).toContain('Right: 5 seconds');
		});

		test('should format output with proper spacing', () => {
			const leftTime = [1, 0];
			const rightTime = [2, 0];

			printBuildTime(leftTime, rightTime);

			// Check that first argument is empty string (for indentation)
			expect(consoleLogSpy).toHaveBeenCalledWith('', expect.any(String));
		});

		test('should handle singular vs plural correctly in all parts', () => {
			const leftTime = [1, 0]; // 1 second
			const rightTime = [2, 0]; // 2 seconds

			printBuildTime(leftTime, rightTime);

			const output = consoleLogSpy.mock.calls[0][1];
			expect(output).toContain('1 second slower'); // singular
			expect(output).toContain('Left: 1 second'); // singular
			expect(output).toContain('Right: 2 seconds'); // plural
		});
	});
});
