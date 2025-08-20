import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import printSnapshotInfo from '../../lib/print-snapshot-info.js';

describe('printSnapshotInfo', () => {
	let mockConsoleLog;
	let _dateToLocaleDateStringSpy;
	let _dateToLocaleTimeStringSpy;

	beforeEach(() => {
		// Mock console.log
		mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Mock Date methods for predictable output
		_dateToLocaleDateStringSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('1/1/2024');
		_dateToLocaleTimeStringSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('12:00:00 PM');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('basic functionality', () => {
		test('should print snapshot info with all fields', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot, 'Left');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Left:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'test-project',
				'•',
				'main',
			);
		});

		test('should handle different labels', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'my-app',
				gitRef: 'feature-branch',
			};

			printSnapshotInfo(snapshot, 'Right');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Right:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'my-app',
				'•',
				'feature-branch',
			);
		});

		test('should handle missing label', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'undefined:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'test-project',
				'•',
				'main',
			);
		});
	});

	describe('date formatting', () => {
		test('should format ISO date string correctly', () => {
			const snapshot = {
				date: '2024-12-31T23:59:59.999Z',
				project: 'test-project',
				gitRef: 'main',
			};

			// Mock specific values for this date
			Date.prototype.toLocaleDateString.mockReturnValue('12/31/2024');
			Date.prototype.toLocaleTimeString.mockReturnValue('11:59:59 PM');

			printSnapshotInfo(snapshot, 'Test');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Test:',
				'12/31/2024',
				'11:59:59 PM',
				'•',
				'test-project',
				'•',
				'main',
			);
		});

		test('should handle different date formats', () => {
			const snapshot = {
				date: '2024-06-15T14:30:45.123Z',
				project: 'test-project',
				gitRef: 'develop',
			};

			Date.prototype.toLocaleDateString.mockReturnValue('6/15/2024');
			Date.prototype.toLocaleTimeString.mockReturnValue('2:30:45 PM');

			printSnapshotInfo(snapshot, 'Snapshot');

			expect(Date.prototype.toLocaleDateString).toHaveBeenCalled();
			expect(Date.prototype.toLocaleTimeString).toHaveBeenCalled();
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Snapshot:',
				'6/15/2024',
				'2:30:45 PM',
				'•',
				'test-project',
				'•',
				'develop',
			);
		});

		test('should create Date object from string', () => {
			const dateString = '2024-03-15T10:30:00.000Z';
			const snapshot = {
				date: dateString,
				project: 'test-project',
				gitRef: 'main',
			};

			const DateSpy = vi.spyOn(globalThis, 'Date').mockImplementation(date => {
				if (date === dateString) {
					return {
						toLocaleDateString: () => '3/15/2024',
						toLocaleTimeString: () => '10:30:00 AM',
					};
				}

				return new Date(date);
			});

			printSnapshotInfo(snapshot, 'Test');

			expect(DateSpy).toHaveBeenCalledWith(dateString);
			DateSpy.mockRestore();
		});
	});

	describe('project and git ref handling', () => {
		test('should handle different project names', () => {
			const testCases = [
				{ project: 'my-awesome-app', gitRef: 'main' },
				{ project: 'simple-app', gitRef: 'develop' },
				{ project: 'complex-project-name-with-dashes', gitRef: 'feature/new-feature' },
				{ project: '@scoped/package', gitRef: 'release/v1.0.0' },
			];

			for (const [index, testCase] of testCases.entries()) {
				const snapshot = {
					date: '2024-01-01T12:00:00.000Z',
					...testCase,
				};

				printSnapshotInfo(snapshot, `Test${index}`);

				expect(mockConsoleLog).toHaveBeenCalledWith(
					'',
					`Test${index}:`,
					'1/1/2024',
					'12:00:00 PM',
					'•',
					testCase.project,
					'•',
					testCase.gitRef,
				);
			}
		});

		test('should handle different git refs', () => {
			const testCases = [
				'main',
				'develop',
				'feature/user-auth',
				'hotfix/critical-bug',
				'release/v2.1.0',
				'HEAD',
				'abc123def456', // commit hash
			];

			for (const [index, gitReference] of testCases.entries()) {
				const snapshot = {
					date: '2024-01-01T12:00:00.000Z',
					project: 'test-project',
					gitRef: gitReference,
				};

				printSnapshotInfo(snapshot, `Test${index}`);

				expect(mockConsoleLog).toHaveBeenCalledWith(
					'',
					`Test${index}:`,
					'1/1/2024',
					'12:00:00 PM',
					'•',
					'test-project',
					'•',
					gitReference,
				);
			}
		});

		test('should handle undefined or undefined git ref', () => {
			const snapshot1 = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: undefined,
			};

			const snapshot2 = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: undefined,
			};

			printSnapshotInfo(snapshot1, 'Test1');
			printSnapshotInfo(snapshot2, 'Test2');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Test1:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'test-project',
				'•',
				undefined,
			);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Test2:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'test-project',
				'•',
				undefined,
			);
		});

		test('should handle empty strings', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: '',
				gitRef: '',
			};

			printSnapshotInfo(snapshot, 'Empty');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Empty:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'',
				'•',
				'',
			);
		});
	});

	describe('edge cases', () => {
		test('should handle invalid date strings', () => {
			const snapshot = {
				date: 'invalid-date',
				project: 'test-project',
				gitRef: 'main',
			};

			// Date constructor with invalid string creates Invalid Date
			Date.prototype.toLocaleDateString.mockReturnValue('Invalid Date');
			Date.prototype.toLocaleTimeString.mockReturnValue('Invalid Date');

			printSnapshotInfo(snapshot, 'Invalid');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Invalid:',
				'Invalid Date',
				'Invalid Date',
				'•',
				'test-project',
				'•',
				'main',
			);
		});

		test('should handle missing snapshot properties', () => {
			const snapshot = {
				// missing date
				project: 'test-project',
				gitRef: 'main',
			};

			// Date(undefined) creates current date
			printSnapshotInfo(snapshot, 'Missing');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Missing:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'test-project',
				'•',
				'main',
			);
		});

		test('should handle completely empty snapshot', () => {
			const snapshot = {};

			printSnapshotInfo(snapshot, 'Empty');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Empty:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				undefined,
				'•',
				undefined,
			);
		});

		test('should handle undefined snapshot', () => {
			expect(() => printSnapshotInfo(undefined, 'Undefined')).toThrow();
		});

		test('should handle undefined snapshot', () => {
			expect(() => printSnapshotInfo(undefined, 'Undefined')).toThrow();
		});
	});

	describe('locale formatting', () => {
		test('should use system locale for date formatting', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot, 'Locale');

			// Check that Date methods were called without arguments (system locale is used)
			expect(Date.prototype.toLocaleDateString).toHaveBeenCalledWith();
			expect(Date.prototype.toLocaleTimeString).toHaveBeenCalledWith();
		});

		test('should handle different timezone scenarios', () => {
			// Test with different time zones
			const testDates = [
				'2024-01-01T00:00:00.000Z', // UTC midnight
				'2024-01-01T12:00:00.000Z', // UTC noon
				'2024-01-01T23:59:59.999Z', // UTC end of day
				'2024-06-15T14:30:45.123Z', // Summer time
			];

			for (const [index, dateString] of testDates.entries()) {
				const snapshot = {
					date: dateString,
					project: 'test-project',
					gitRef: 'main',
				};

				Date.prototype.toLocaleDateString.mockReturnValue(`Date${index}`);
				Date.prototype.toLocaleTimeString.mockReturnValue(`Time${index}`);

				printSnapshotInfo(snapshot, `TZ${index}`);

				expect(mockConsoleLog).toHaveBeenCalledWith(
					'',
					`TZ${index}:`,
					`Date${index}`,
					`Time${index}`,
					'•',
					'test-project',
					'•',
					'main',
				);
			}
		});
	});

	describe('output formatting', () => {
		test('should use bullet points as separators', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot, 'Format');

			const call = mockConsoleLog.mock.calls[0];
			expect(call).toContain('•');
			expect(call.filter(argument => argument === '•')).toHaveLength(2); // Two bullet points
		});

		test('should start with empty string for indentation', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot, 'Indent');

			const call = mockConsoleLog.mock.calls[0];
			expect(call[0]).toBe(''); // First argument should be empty string
		});

		test('should format label with colon', () => {
			const snapshot = {
				date: '2024-01-01T12:00:00.000Z',
				project: 'test-project',
				gitRef: 'main',
			};

			printSnapshotInfo(snapshot, 'MyLabel');

			const call = mockConsoleLog.mock.calls[0];
			expect(call[1]).toBe('MyLabel:'); // Second argument should be label with colon
		});
	});

	describe('integration scenarios', () => {
		test('should handle real-world snapshot data', () => {
			const realSnapshot = {
				date: '2024-01-15T09:30:45.123Z',
				project: '@company/web-app',
				gitRef: 'feature/user-dashboard',
				total: {
					all: { files: 150, size: 2_500_000, gzipSize: 800_000 },
				},
				fsEntries: [
					{ path: '/build/main.js', size: 1_500_000, gzipSize: 500_000 },
					{ path: '/build/styles.css', size: 300_000, gzipSize: 100_000 },
				],
			};

			Date.prototype.toLocaleDateString.mockReturnValue('1/15/2024');
			Date.prototype.toLocaleTimeString.mockReturnValue('9:30:45 AM');

			printSnapshotInfo(realSnapshot, 'Production');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Production:',
				'1/15/2024',
				'9:30:45 AM',
				'•',
				'@company/web-app',
				'•',
				'feature/user-dashboard',
			);
		});

		test('should work with minimal snapshot data', () => {
			const minimalSnapshot = {
				date: '2024-01-01T00:00:00.000Z',
				project: 'app',
				gitRef: 'main',
			};

			printSnapshotInfo(minimalSnapshot, 'Min');

			expect(mockConsoleLog).toHaveBeenCalledTimes(1);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				'',
				'Min:',
				'1/1/2024',
				'12:00:00 PM',
				'•',
				'app',
				'•',
				'main',
			);
		});
	});
});
