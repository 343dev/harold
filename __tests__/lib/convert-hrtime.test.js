import { describe, test, expect } from 'vitest';
import convertHrtime from '../../lib/convert-hrtime.js';

describe('convertHrtime', () => {
	test('should convert hrtime to different time units', () => {
		// 1 second in hrtime format: [1, 0]
		const hrtime = [1, 0];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(1);
		expect(result.milliseconds).toBe(1000);
		expect(result.nanoseconds).toBe(1_000_000_000);
	});

	test('should handle fractional seconds', () => {
		// 1.5 seconds in hrtime format: [1, 500000000]
		const hrtime = [1, 500_000_000];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(1.5);
		expect(result.milliseconds).toBe(1500);
		expect(result.nanoseconds).toBe(1_500_000_000);
	});

	test('should handle zero time', () => {
		const hrtime = [0, 0];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(0);
		expect(result.milliseconds).toBe(0);
		expect(result.nanoseconds).toBe(0);
	});

	test('should handle only nanoseconds', () => {
		// 500 milliseconds in hrtime format: [0, 500000000]
		const hrtime = [0, 500_000_000];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(0.5);
		expect(result.milliseconds).toBe(500);
		expect(result.nanoseconds).toBe(500_000_000);
	});

	test('should handle large time values', () => {
		// 10 seconds and 999999999 nanoseconds
		const hrtime = [10, 999_999_999];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBeCloseTo(10.999_999_999, 9);
		expect(result.milliseconds).toBeCloseTo(10_999.999_999, 6);
		expect(result.nanoseconds).toBe(10_999_999_999);
	});

	test('should handle small nanosecond values', () => {
		// Only 1 nanosecond
		const hrtime = [0, 1];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(0.000_000_001);
		expect(result.milliseconds).toBe(0.000_001);
		expect(result.nanoseconds).toBe(1);
	});

	test('should maintain precision for milliseconds', () => {
		// 123 milliseconds in hrtime format: [0, 123000000]
		const hrtime = [0, 123_000_000];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(0.123);
		expect(result.milliseconds).toBe(123);
		expect(result.nanoseconds).toBe(123_000_000);
	});

	test('should handle typical build times', () => {
		// Typical build time: 2.5 seconds
		const hrtime = [2, 500_000_000];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBe(2.5);
		expect(result.milliseconds).toBe(2500);
		expect(result.nanoseconds).toBe(2_500_000_000);
	});

	test('should return object with correct structure', () => {
		const hrtime = [1, 0];
		const result = convertHrtime(hrtime);

		expect(result).toHaveProperty('seconds');
		expect(result).toHaveProperty('milliseconds');
		expect(result).toHaveProperty('nanoseconds');
		expect(typeof result.seconds).toBe('number');
		expect(typeof result.milliseconds).toBe('number');
		expect(typeof result.nanoseconds).toBe('number');
	});

	test('should handle edge case with maximum nanoseconds', () => {
		// Maximum nanoseconds value in a second: 999999999
		const hrtime = [0, 999_999_999];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBeCloseTo(0.999_999_999, 9);
		expect(result.milliseconds).toBeCloseTo(999.999_999, 6);
		expect(result.nanoseconds).toBe(999_999_999);
	});

	test('should handle multiple seconds with precise nanoseconds', () => {
		// 5 seconds and 123456789 nanoseconds
		const hrtime = [5, 123_456_789];
		const result = convertHrtime(hrtime);

		expect(result.seconds).toBeCloseTo(5.123_456_789, 9);
		expect(result.milliseconds).toBeCloseTo(5123.456_789, 6);
		expect(result.nanoseconds).toBe(5_123_456_789);
	});

	describe('mathematical accuracy', () => {
		test('should maintain accuracy for conversion calculations', () => {
			const hrtime = [3, 750_000_000];
			const result = convertHrtime(hrtime);

			// Check that all conversions are mathematically correct
			expect(result.nanoseconds).toBe((hrtime[0] * 1e9) + hrtime[1]);
			expect(result.milliseconds).toBe(result.nanoseconds / 1e6);
			expect(result.seconds).toBe(result.nanoseconds / 1e9);
		});

		test('should handle floating point precision correctly', () => {
			// Test for floating point precision
			const hrtime = [0, 1];
			const result = convertHrtime(hrtime);

			expect(result.seconds * 1e9).toBe(1);
			expect(result.milliseconds * 1e6).toBe(1);
		});
	});
});
