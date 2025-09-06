/**
 * Unit тесты для утилиты очистки ANSI кодов
 */

const { cleanHaroldOutput } = require('../utils/ansi-strip.cjs');

describe('ANSI Strip Utility', () => {
	describe('cleanHaroldOutput', () => {
		test('should remove basic ANSI color codes', () => {
			const input = '\u001B[31mRed text\u001B[0m';
			const expected = 'Red text';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should remove multiple ANSI codes', () => {
			const input = '\u001B[31m\u001B[1mBold red text\u001B[0m\u001B[0m';
			const expected = 'Bold red text';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle complex ANSI sequences', () => {
			const input = '\u001B[38;5;196mComplex color\u001B[0m';
			const expected = 'Complex color';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should preserve text without ANSI codes', () => {
			const input = 'Plain text without colors';
			const expected = 'Plain text without colors';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle empty string', () => {
			expect(cleanHaroldOutput('')).toBe('');
		});

		test('should handle null and undefined', () => {
			expect(cleanHaroldOutput(null)).toBe('');
			expect(cleanHaroldOutput()).toBe('');
		});

		test('should handle real Harold output with colors', () => {
			const input = `\u001B[32m✓\u001B[0m Total: \u001B[31m+1.2 kB\u001B[0m (\u001B[31m+300 B\u001B[0m)
\u001B[33m⚠\u001B[0m Large increase detected
\u001B[36mDiff by files:\u001B[0m
\u001B[32m+\u001B[0m main.js: \u001B[31m+800 B\u001B[0m (\u001B[31m+200 B\u001B[0m)
\u001B[33mm\u001B[0m vendor.js: \u001B[31m+400 B\u001B[0m (\u001B[31m+100 B\u001B[0m)`;

			const expected = `✓ Total: +1.2 kB (+300 B)
⚠ Large increase detected
Diff by files:
+ main.js: +800 B (+200 B)
m vendor.js: +400 B (+100 B)`;

			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle cursor movement codes', () => {
			const input = '\u001B[2J\u001B[H\u001B[31mCleared screen\u001B[0m';
			const expected = 'Cleared screen';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle background colors', () => {
			const input = '\u001B[41m\u001B[37mWhite text on red background\u001B[0m';
			const expected = 'White text on red background';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle mixed content', () => {
			const input = 'Normal text \u001B[31mred\u001B[0m more normal \u001B[32mgreen\u001B[0m end';
			const expected = 'Normal text red more normal green end';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle malformed ANSI codes gracefully', () => {
			const input = '\u001B[31mIncomplete\u001B[ code and \u001B[0mnormal end';
			const result = cleanHaroldOutput(input);
			// Should remove valid codes and leave malformed ones or handle gracefully
			expect(result).toContain('Incomplete');
			expect(result).toContain('normal end');
		});
	});

	describe('Edge cases', () => {
		test('should handle very long strings', () => {
			const longText = 'a'.repeat(10_000);
			const input = `\u001B[31m${longText}\u001B[0m`;
			const result = cleanHaroldOutput(input);
			expect(result).toBe(longText);
			expect(result.length).toBe(10_000);
		});

		test('should handle strings with only ANSI codes', () => {
			const input = '\u001B[31m\u001B[0m\u001B[32m\u001B[0m';
			const expected = '';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle newlines and special characters', () => {
			const input = '\u001B[31mLine 1\nLine 2\tTabbed\u001B[0m';
			const expected = 'Line 1\nLine 2\tTabbed';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle Unicode characters', () => {
			const input = '\u001B[31m🎉 Unicode emoji 中文 العربية\u001B[0m';
			const expected = '🎉 Unicode emoji 中文 العربية';
			expect(cleanHaroldOutput(input)).toBe(expected);
		});
	});

	describe('Performance', () => {
		test('should handle large inputs efficiently', () => {
			const largeInput = '\u001B[31m' + 'test '.repeat(1000) + '\u001B[0m';
			const start = Date.now();
			const result = cleanHaroldOutput(largeInput);
			const end = Date.now();

			expect(result).toBe('test '.repeat(1000));
			expect(end - start).toBeLessThan(100); // Should complete in less than 100ms
		});
	});
});
