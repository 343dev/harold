/**
 * Unit тесты для утилиты ansi-strip
 * Тестирует функции удаления ANSI кодов из текста
 */

const ansiStrip = require('../../utils/ansi-strip.cjs');

describe('ANSI Strip Utility', () => {
	describe('stripAllAnsi', () => {
		test('should remove basic ANSI color codes', () => {
			const input = '\u001B[31mRed text\u001B[0m';
			const expected = 'Red text';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});

		test('should remove multiple ANSI codes', () => {
			const input = '\u001B[31mRed\u001B[0m and \u001B[32mgreen\u001B[0m text';
			const expected = 'Red and green text';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});

		test('should remove complex ANSI sequences', () => {
			const input = '\u001B[1;31;40mBold red on black\u001B[0m';
			const expected = 'Bold red on black';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});

		test('should handle text without ANSI codes', () => {
			const input = 'Plain text without colors';
			expect(ansiStrip.stripAllAnsi(input)).toBe(input);
		});

		test('should handle empty string', () => {
			expect(ansiStrip.stripAllAnsi('')).toBe('');
		});

		test('should handle null and undefined', () => {
			expect(ansiStrip.stripAllAnsi(null)).toBe('');
			expect(ansiStrip.stripAllAnsi()).toBe('');
		});

		test('should handle non-string input', () => {
			expect(ansiStrip.stripAllAnsi(123)).toBe('123');
			expect(ansiStrip.stripAllAnsi(true)).toBe('true');
		});

		test('should remove cursor movement codes', () => {
			const input = '\u001B[2J\u001B[H\u001B[1;1HText at position';
			const expected = 'Text at position';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});

		test('should remove extended ANSI sequences', () => {
			const input = '\u001B]0;Window Title\u0007Text content';
			const expected = 'Text content';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});
	});

	describe('stripAnsiAndNormalize', () => {
		test('should remove ANSI codes and normalize line endings', () => {
			const input = '\u001B[31mRed\u001B[0m\r\ntext\r\nwith\r\nmixed\nline\nendings';
			const expected = 'Red\ntext\nwith\nmixed\nline\nendings';
			expect(ansiStrip.stripAnsiAndNormalize(input)).toBe(expected);
		});

		test('should replace tabs with spaces', () => {
			const input = 'Text\twith\ttabs';
			const expected = 'Text    with    tabs';
			expect(ansiStrip.stripAnsiAndNormalize(input)).toBe(expected);
		});

		test('should remove trailing spaces', () => {
			const input = 'Line with trailing spaces   \nAnother line   ';
			const expected = 'Line with trailing spaces\nAnother line';
			expect(ansiStrip.stripAnsiAndNormalize(input)).toBe(expected);
		});

		test('should limit multiple newlines', () => {
			const input = 'Text\n\n\n\n\nwith\n\n\n\nmany\n\n\nnewlines';
			const expected = 'Text\n\nwith\n\nmany\n\nnewlines';
			expect(ansiStrip.stripAnsiAndNormalize(input)).toBe(expected);
		});

		test('should handle complex mixed content', () => {
			const input = '\u001B[31mRed\u001B[0m\t\t  \r\n\r\n\r\n\u001B[32mGreen\u001B[0m   ';
			const expected = 'Red\n\nGreen';
			expect(ansiStrip.stripAnsiAndNormalize(input)).toBe(expected);
		});
	});

	describe('hasAnsiCodes', () => {
		test('should detect basic ANSI codes', () => {
			expect(ansiStrip.hasAnsiCodes('\u001B[31mRed text\u001B[0m')).toBe(true);
		});

		test('should detect complex ANSI codes', () => {
			expect(ansiStrip.hasAnsiCodes('\u001B[1;31;40mComplex\u001B[0m')).toBe(true);
		});

		test('should detect extended ANSI codes', () => {
			expect(ansiStrip.hasAnsiCodes('\u001B]0;Title\u0007')).toBe(true);
		});

		test('should return false for plain text', () => {
			expect(ansiStrip.hasAnsiCodes('Plain text')).toBe(false);
		});

		test('should return false for empty string', () => {
			expect(ansiStrip.hasAnsiCodes('')).toBe(false);
		});

		test('should return false for null/undefined', () => {
			expect(ansiStrip.hasAnsiCodes(null)).toBe(false);
			expect(ansiStrip.hasAnsiCodes()).toBe(false);
		});
	});

	describe('cleanHaroldOutput', () => {
		test('should clean typical Harold diff output', () => {
			const input = `\u001B[36mSnapshots:\u001B[39m
 \u001B[31mLeft:\u001B[39m 12/2/2025 3:45:12 PM • my-project • main
 \u001B[32mRight:\u001B[39m 12/2/2025 3:47:23 PM • my-project • feature

\u001B[36mTotal:\u001B[39m
 \u001B[32m+ 1.2 KB\u001B[39m (\u001B[32m+2.5%\u001B[39m)`;

			const expected = `Snapshots:
 Left: 12/2/2025 3:45:12 PM • my-project • main
 Right: 12/2/2025 3:47:23 PM • my-project • feature

Total:
 + 1.2 KB (+2.5%)`;

			expect(ansiStrip.cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle empty Harold output', () => {
			expect(ansiStrip.cleanHaroldOutput('')).toBe('No changes detected');
			expect(ansiStrip.cleanHaroldOutput('   \n\n   ')).toBe('No changes detected');
		});

		test('should handle null/undefined Harold output', () => {
			expect(ansiStrip.cleanHaroldOutput(null)).toBe('No output available');
			expect(ansiStrip.cleanHaroldOutput()).toBe('No output available');
		});

		test('should remove separator lines', () => {
			const input = `Header
———————————————
Content
   ———
Footer`;

			const expected = `Header
Content
Footer`;

			expect(ansiStrip.cleanHaroldOutput(input)).toBe(expected);
		});

		test('should preserve table structure', () => {
			const input = `\u001B[36mFiles:\u001B[39m
 \u001B[32mapp.js\u001B[39m     +1.2 KB  (+5.2%)
 \u001B[31mstyle.css\u001B[39m  -0.8 KB  (-3.1%)`;

			const expected = `Files:
 app.js     +1.2 KB  (+5.2%)
 style.css  -0.8 KB  (-3.1%)`;

			expect(ansiStrip.cleanHaroldOutput(input)).toBe(expected);
		});

		test('should handle Harold error output', () => {
			const input = '\u001B[31mError: Could not find snapshot file\u001B[0m';
			const expected = 'Error: Could not find snapshot file';
			expect(ansiStrip.cleanHaroldOutput(input)).toBe(expected);
		});
	});

	describe('alias functions', () => {
		test('strip alias should work like stripAllAnsi', () => {
			const input = '\u001B[31mRed text\u001B[0m';
			expect(ansiStrip.strip(input)).toBe(ansiStrip.stripAllAnsi(input));
		});

		test('clean alias should work like cleanHaroldOutput', () => {
			const input = '\u001B[36mHarold output\u001B[39m';
			expect(ansiStrip.clean(input)).toBe(ansiStrip.cleanHaroldOutput(input));
		});

		test('normalize alias should work like stripAnsiAndNormalize', () => {
			const input = '\u001B[31mText\u001B[0m\r\n\twith\tnormalization';
			expect(ansiStrip.normalize(input)).toBe(ansiStrip.stripAnsiAndNormalize(input));
		});
	});

	describe('real-world Harold output examples', () => {
		test('should handle Harold snapshot comparison', () => {
			const realHaroldOutput = `\u001B[36mSnapshots:\u001B[39m
 \u001B[31mLeft:\u001B[39m 2/9/2025, 3:45:12 PM • harold-action • main (abc1234)
 \u001B[32mRight:\u001B[39m 2/9/2025, 3:47:23 PM • harold-action • feature-branch (def5678)

\u001B[36mTotal:\u001B[39m
 \u001B[32m+ 2.1 KB\u001B[39m (\u001B[32m+1.8%\u001B[39m) • \u001B[36m120.5 KB\u001B[39m

\u001B[36mFiles:\u001B[39m
 \u001B[32mjs/app.bundle.js\u001B[39m      \u001B[32m+ 1.8 KB\u001B[39m (\u001B[32m+2.1%\u001B[39m) • \u001B[36m87.3 KB\u001B[39m
 \u001B[32mjs/vendor.bundle.js\u001B[39m   \u001B[32m+ 0.3 KB\u001B[39m (\u001B[32m+0.9%\u001B[39m) • \u001B[36m33.2 KB\u001B[39m

\u001B[36mBuild time:\u001B[39m
 \u001B[31mLeft:\u001B[39m 2.34s
 \u001B[32mRight:\u001B[39m 2.41s (\u001B[32m+0.07s\u001B[39m)`;

			const cleaned = ansiStrip.cleanHaroldOutput(realHaroldOutput);

			expect(cleaned).toContain('Snapshots:');
			expect(cleaned).toContain('Left: 2/9/2025, 3:45:12 PM');
			expect(cleaned).toContain('Right: 2/9/2025, 3:47:23 PM');
			expect(cleaned).toContain('Total:');
			expect(cleaned).toContain('+ 2.1 KB');
			expect(cleaned).toContain('Files:');
			expect(cleaned).toContain('js/app.bundle.js');
			expect(cleaned).toContain('Build time:');
			expect(cleaned).not.toContain('\u001B');
		});

		test('should handle Harold no changes output', () => {
			const noChangesOutput = `\u001B[36mSnapshots:\u001B[39m
 \u001B[31mLeft:\u001B[39m 2/9/2025, 3:45:12 PM • harold-action • main (abc1234)
 \u001B[32mRight:\u001B[39m 2/9/2025, 3:45:12 PM • harold-action • main (abc1234)

\u001B[36mNo changes detected\u001B[39m`;

			const cleaned = ansiStrip.cleanHaroldOutput(noChangesOutput);

			expect(cleaned).toContain('Snapshots:');
			expect(cleaned).toContain('No changes detected');
			expect(cleaned).not.toContain('\u001B');
		});

		test('should handle Harold error scenarios', () => {
			const errorOutput = `\u001B[31mError:\u001B[39m Could not find build directory: dist
\u001B[33mSuggestion:\u001B[39m Make sure your build command creates the expected output directory`;

			const cleaned = ansiStrip.cleanHaroldOutput(errorOutput);

			expect(cleaned).toContain('Error: Could not find build directory: dist');
			expect(cleaned).toContain('Suggestion: Make sure your build command');
			expect(cleaned).not.toContain('\u001B');
		});
	});

	describe('edge cases and error handling', () => {
		test('should handle malformed ANSI sequences', () => {
			const input = '\u001B[31mText\u001B[999mMore text\u001B[0m';
			const result = ansiStrip.stripAllAnsi(input);
			expect(result).toBe('TextMore text');
		});

		test('should handle very long strings', () => {
			const longText = 'A'.repeat(10_000);
			const withAnsi = `\u001B[31m${longText}\u001B[0m`;
			const result = ansiStrip.stripAllAnsi(withAnsi);
			expect(result).toBe(longText);
			expect(result.length).toBe(10_000);
		});

		test('should handle unicode characters mixed with ANSI', () => {
			const input = '\u001B[31m🚀 Rocket\u001B[0m and \u001B[32m✅ Check\u001B[0m';
			const expected = '🚀 Rocket and ✅ Check';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});

		test('should handle nested ANSI codes', () => {
			const input = '\u001B[31m\u001B[1mBold Red\u001B[0m\u001B[0m';
			const expected = 'Bold Red';
			expect(ansiStrip.stripAllAnsi(input)).toBe(expected);
		});
	});
});
