import { describe, test, expect } from 'vitest';
import getPlural from '../../lib/get-plural.js';

describe('getPlural', () => {
	describe('singular cases', () => {
		test('should return singular form for 1', () => {
			const result = getPlural(1, 'item', 'items');
			expect(result).toBe('item');
		});

		test('should return singular form for -1', () => {
			const result = getPlural(-1, 'item', 'items');
			expect(result).toBe('item');
		});

		test('should return singular form for 1.0', () => {
			const result = getPlural(1, 'second', 'seconds');
			expect(result).toBe('second');
		});

		test('should return singular form for -1.0', () => {
			const result = getPlural(-1, 'file', 'files');
			expect(result).toBe('file');
		});
	});

	describe('plural cases', () => {
		test('should return plural form for 0', () => {
			const result = getPlural(0, 'item', 'items');
			expect(result).toBe('items');
		});

		test('should return plural form for 2', () => {
			const result = getPlural(2, 'item', 'items');
			expect(result).toBe('items');
		});

		test('should return plural form for -2', () => {
			const result = getPlural(-2, 'item', 'items');
			expect(result).toBe('items');
		});

		test('should return plural form for large numbers', () => {
			const result = getPlural(100, 'file', 'files');
			expect(result).toBe('files');
		});

		test('should return plural form for negative large numbers', () => {
			const result = getPlural(-100, 'byte', 'bytes');
			expect(result).toBe('bytes');
		});
	});

	describe('decimal numbers', () => {
		test('should return plural form for 1.1', () => {
			const result = getPlural(1.1, 'second', 'seconds');
			expect(result).toBe('seconds');
		});

		test('should return plural form for 0.5', () => {
			const result = getPlural(0.5, 'item', 'items');
			expect(result).toBe('items');
		});

		test('should return plural form for -1.5', () => {
			const result = getPlural(-1.5, 'unit', 'units');
			expect(result).toBe('units');
		});

		test('should return plural form for 2.7', () => {
			const result = getPlural(2.7, 'meter', 'meters');
			expect(result).toBe('meters');
		});
	});

	describe('edge cases', () => {
		test('should handle very small positive numbers', () => {
			const result = getPlural(0.001, 'gram', 'grams');
			expect(result).toBe('grams');
		});

		test('should handle very small negative numbers', () => {
			const result = getPlural(-0.001, 'degree', 'degrees');
			expect(result).toBe('degrees');
		});

		test('should handle exactly 1 as string number', () => {
			const result = getPlural('1', 'item', 'items');
			expect(result).toBe('item');
		});

		test('should handle exactly -1 as string number', () => {
			const result = getPlural('-1', 'point', 'points');
			expect(result).toBe('point');
		});

		test('should handle zero as string', () => {
			const result = getPlural('0', 'element', 'elements');
			expect(result).toBe('elements');
		});
	});

	describe('different word types', () => {
		test('should work with regular plurals', () => {
			expect(getPlural(1, 'cat', 'cats')).toBe('cat');
			expect(getPlural(2, 'cat', 'cats')).toBe('cats');
		});

		test('should work with irregular plurals', () => {
			expect(getPlural(1, 'child', 'children')).toBe('child');
			expect(getPlural(2, 'child', 'children')).toBe('children');
		});

		test('should work with same singular and plural forms', () => {
			expect(getPlural(1, 'sheep', 'sheep')).toBe('sheep');
			expect(getPlural(2, 'sheep', 'sheep')).toBe('sheep');
		});

		test('should work with technical terms', () => {
			expect(getPlural(1, 'byte', 'bytes')).toBe('byte');
			expect(getPlural(1024, 'byte', 'bytes')).toBe('bytes');
		});
	});

	describe('real-world usage scenarios', () => {
		test('should work for file counting', () => {
			expect(getPlural(0, 'file', 'files')).toBe('files');
			expect(getPlural(1, 'file', 'files')).toBe('file');
			expect(getPlural(5, 'file', 'files')).toBe('files');
		});

		test('should work for time units', () => {
			expect(getPlural(1, 'second', 'seconds')).toBe('second');
			expect(getPlural(30, 'second', 'seconds')).toBe('seconds');
			expect(getPlural(1, 'minute', 'minutes')).toBe('minute');
			expect(getPlural(5, 'minute', 'minutes')).toBe('minutes');
		});

		test('should work for size measurements', () => {
			expect(getPlural(1, 'KB', 'KB')).toBe('KB');
			expect(getPlural(1024, 'KB', 'KB')).toBe('KB');
		});

		test('should work for build statistics', () => {
			expect(getPlural(1, 'error', 'errors')).toBe('error');
			expect(getPlural(0, 'error', 'errors')).toBe('errors');
			expect(getPlural(3, 'warning', 'warnings')).toBe('warnings');
		});
	});

	describe('parameter validation', () => {
		test('should handle undefined number', () => {
			const result = getPlural(undefined, 'item', 'items');
			// undefined is not equal to 1, so should return plural
			expect(result).toBe('items');
		});

		test('should handle undefined number', () => {
			const result = getPlural(undefined, 'item', 'items');
			// undefined is not equal to 1, so should return plural
			expect(result).toBe('items');
		});

		test('should handle NaN', () => {
			const result = getPlural(Number.NaN, 'item', 'items');
			// NaN is not equal to 1, so should return plural
			expect(result).toBe('items');
		});

		test('should handle Infinity', () => {
			expect(getPlural(Infinity, 'item', 'items')).toBe('items');
			expect(getPlural(-Infinity, 'item', 'items')).toBe('items');
		});
	});
});
