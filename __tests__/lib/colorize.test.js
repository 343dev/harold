import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import colorize from '../../lib/colorize.js';

describe('colorize', () => {
	let originalIsTTY;

	beforeEach(() => {
		originalIsTTY = process.stdout.isTTY;
	});

	afterEach(() => {
		process.stdout.isTTY = originalIsTTY;
		vi.restoreAllMocks();
	});

	describe('in TTY mode', () => {
		beforeEach(() => {
			process.stdout.isTTY = true;
		});

		test('should apply color codes when in TTY mode', () => {
			const result = colorize('test text');

			expect(result.red).toBe('\u001B[31mtest text\u001B[39m');
			expect(result.green).toBe('\u001B[32mtest text\u001B[39m');
			expect(result.blue).toBe('\u001B[34mtest text\u001B[39m');
			expect(result.yellow).toBe('\u001B[33mtest text\u001B[39m');
		});

		test('should apply background colors when in TTY mode', () => {
			const result = colorize('test text');

			expect(result.bgRed).toBe('\u001B[41mtest text\u001B[0m');
			expect(result.bgGreen).toBe('\u001B[42mtest text\u001B[0m');
			expect(result.bgBlue).toBe('\u001B[44mtest text\u001B[0m');
			expect(result.bgYellow).toBe('\u001B[43mtest text\u001B[0m');
		});

		test('should apply text formatting when in TTY mode', () => {
			const result = colorize('test text');

			expect(result.dim).toBe('\u001B[2mtest text\u001B[22m');
			expect(result.reset).toBe('\u001B[0mtest text\u001B[0m');
		});

		test('should handle all available colors', () => {
			const result = colorize('test');

			// Check all text colors
			expect(result.black).toBe('\u001B[30mtest\u001B[39m');
			expect(result.red).toBe('\u001B[31mtest\u001B[39m');
			expect(result.green).toBe('\u001B[32mtest\u001B[39m');
			expect(result.yellow).toBe('\u001B[33mtest\u001B[39m');
			expect(result.blue).toBe('\u001B[34mtest\u001B[39m');
			expect(result.magenta).toBe('\u001B[35mtest\u001B[39m');
			expect(result.cyan).toBe('\u001B[36mtest\u001B[39m');
			expect(result.white).toBe('\u001B[37mtest\u001B[39m');

			// Check all background colors
			expect(result.bgBlack).toBe('\u001B[40mtest\u001B[0m');
			expect(result.bgRed).toBe('\u001B[41mtest\u001B[0m');
			expect(result.bgGreen).toBe('\u001B[42mtest\u001B[0m');
			expect(result.bgYellow).toBe('\u001B[43mtest\u001B[0m');
			expect(result.bgBlue).toBe('\u001B[44mtest\u001B[0m');
			expect(result.bgMagenta).toBe('\u001B[45mtest\u001B[0m');
			expect(result.bgCyan).toBe('\u001B[46mtest\u001B[0m');
			expect(result.bgWhite).toBe('\u001B[47mtest\u001B[0m');
		});
	});

	describe('in non-TTY mode', () => {
		beforeEach(() => {
			process.stdout.isTTY = false;
		});

		test('should not apply color codes when not in TTY mode', () => {
			const result = colorize('test text');

			expect(result.red).toBe('test text');
			expect(result.green).toBe('test text');
			expect(result.blue).toBe('test text');
			expect(result.yellow).toBe('test text');
		});

		test('should not apply background colors when not in TTY mode', () => {
			const result = colorize('test text');

			expect(result.bgRed).toBe('test text');
			expect(result.bgGreen).toBe('test text');
			expect(result.bgBlue).toBe('test text');
			expect(result.bgYellow).toBe('test text');
		});

		test('should not apply text formatting when not in TTY mode', () => {
			const result = colorize('test text');

			expect(result.dim).toBe('test text');
			expect(result.reset).toBe('test text');
		});
	});

	describe('with multiple arguments', () => {
		test('should join multiple arguments with spaces', () => {
			const result = colorize('hello', 'world', 'test');

			expect(result.red).toContain('hello world test');
		});

		test('should handle empty arguments', () => {
			const result = colorize();

			expect(result.red).toBe(process.stdout.isTTY ? '\u001B[31m\u001B[39m' : '');
		});

		test('should handle mixed argument types', () => {
			const result = colorize('text', 123, true);

			expect(result.green).toContain('text 123 true');
		});
	});

	describe('edge cases', () => {
		test('should handle undefined process.stdout.isTTY', () => {
			process.stdout.isTTY = undefined;
			const result = colorize('test');

			expect(result.red).toBe('test');
		});

		test('should handle undefined process.stdout.isTTY', () => {
			process.stdout.isTTY = undefined;
			const result = colorize('test');

			expect(result.red).toBe('test');
		});

		test('should handle empty string', () => {
			const result = colorize('');

			expect(result.red).toBe(process.stdout.isTTY ? '\u001B[31m\u001B[39m' : '');
		});

		test('should handle special characters', () => {
			const specialText = 'test\nwith\tspecial\rchars';
			const result = colorize(specialText);

			expect(result.blue).toContain(specialText);
		});

		test('should handle unicode characters', () => {
			const unicodeText = 'тест 🚀 测试';
			const result = colorize(unicodeText);

			expect(result.cyan).toContain(unicodeText);
		});
	});

	describe('return object structure', () => {
		test('should return object with all expected color properties', () => {
			const result = colorize('test');

			const expectedProperties = [
				'dim',
				'reset',
				'black',
				'red',
				'green',
				'yellow',
				'blue',
				'magenta',
				'cyan',
				'white',
				'bgBlack',
				'bgRed',
				'bgGreen',
				'bgYellow',
				'bgBlue',
				'bgMagenta',
				'bgCyan',
				'bgWhite',
			];

			for (const property of expectedProperties) {
				expect(result).toHaveProperty(property);
				expect(typeof result[property]).toBe('string');
			}
		});

		test('should return different objects for different calls', () => {
			const result1 = colorize('test1');
			const result2 = colorize('test2');

			expect(result1).not.toBe(result2);
			expect(result1.red).not.toBe(result2.red);
		});
	});
});
