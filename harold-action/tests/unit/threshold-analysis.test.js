/**
 * Unit тесты для функций анализа пороговых значений
 * Тестирует парсинг вывода Harold и определение превышения порогов
 */

describe('Threshold Analysis Functions', () => {
	// Поскольку функции парсинга не экспортированы из comment.cjs,
	// мы создаем их копии для тестирования

	/**
   * Парсит строку размера в байты (копия функции из comment.cjs)
   */
	function parseSizeString(sizeString) {
		if (!sizeString || typeof sizeString !== 'string') {
			return 0;
		}

		const match = sizeString.trim().match(/([+-]?)([\d,.]+)\s*([gkmt]?)b?/i);

		if (!match) {
			return 0;
		}

		const sign = match[1] === '-' ? -1 : 1;
		const number = Number.parseFloat(match[2].replaceAll(',', ''));
		const unit = match[3].toUpperCase();

		if (isNaN(number)) {
			return 0;
		}

		let bytes = number;
		switch (unit) {
			case 'K': {
				bytes *= 1024;
				break;
			}

			case 'M': {
				bytes *= 1024 * 1024;
				break;
			}

			case 'G': {
				bytes *= 1024 * 1024 * 1024;
				break;
			}

			case 'T': {
				bytes *= 1024 * 1024 * 1024 * 1024;
				break;
			}
		}

		return Math.abs(bytes * sign);
	}

	/**
   * Парсит вывод Harold для извлечения числовых данных (копия функции из comment.cjs)
   */
	function parseHaroldOutput(output) {
		const result = {
			hasChanges: false,
			totalSizeIncrease: 0,
			totalGzipIncrease: 0,
			percentageIncrease: 0,
			fileChanges: [],
		};

		if (!output || typeof output !== 'string') {
			return result;
		}

		if (output.includes('No changes') || output.includes('Snapshots are equal')) {
			return result;
		}

		result.hasChanges = true;

		// Ищем строку с общими изменениями (Total)
		const totalMatch = output.match(/total.*?([+-][\d,.]+\s*[gkmt]?b).*?\(([+-][\d,.]+\s*[gkmt]?b)\)/i);

		if (totalMatch) {
			result.totalSizeIncrease = parseSizeString(totalMatch[1]);
			result.totalGzipIncrease = parseSizeString(totalMatch[2]);
		}

		// Пытаемся найти процентное изменение
		const percentMatch = output.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
		if (percentMatch) {
			result.percentageIncrease = Math.abs(Number.parseFloat(percentMatch[1]));
		}

		return result;
	}

	/**
   * Анализирует превышение пороговых значений (копия функции из comment.cjs)
   */
	function shouldFailOnIncrease(output, sizeThreshold, percentageThreshold) {
		try {
			const analysis = parseHaroldOutput(output);

			if (!analysis.hasChanges) {
				return false;
			}

			if (analysis.totalSizeIncrease > sizeThreshold) {
				return true;
			}

			if (analysis.percentageIncrease > percentageThreshold) {
				return true;
			}

			return false;
		} catch {
			return false;
		}
	}

	describe('parseSizeString', () => {
		test('should parse bytes correctly', () => {
			expect(parseSizeString('100 B')).toBe(100);
			expect(parseSizeString('500B')).toBe(500);
			expect(parseSizeString('+250 B')).toBe(250);
			expect(parseSizeString('-150 B')).toBe(150); // Возвращаем абсолютное значение
		});

		test('should parse kilobytes correctly', () => {
			expect(parseSizeString('1 KB')).toBe(1024);
			expect(parseSizeString('2.5 kB')).toBe(2560);
			expect(parseSizeString('+1.5 K')).toBe(1536);
			expect(parseSizeString('-0.5 KB')).toBe(512);
		});

		test('should parse megabytes correctly', () => {
			expect(parseSizeString('1 MB')).toBe(1024 * 1024);
			expect(parseSizeString('2.5 mB')).toBe(2.5 * 1024 * 1024);
			expect(parseSizeString('+0.1 M')).toBe(0.1 * 1024 * 1024);
		});

		test('should parse gigabytes correctly', () => {
			expect(parseSizeString('1 GB')).toBe(1024 * 1024 * 1024);
			expect(parseSizeString('0.5 gB')).toBe(0.5 * 1024 * 1024 * 1024);
		});

		test('should handle numbers with commas', () => {
			expect(parseSizeString('1,024 B')).toBe(1024);
			expect(parseSizeString('2,048.5 KB')).toBe(2048.5 * 1024);
		});

		test('should handle invalid input', () => {
			expect(parseSizeString('')).toBe(0);
			expect(parseSizeString(null)).toBe(0);
			expect(parseSizeString()).toBe(0);
			expect(parseSizeString('invalid')).toBe(0);
			expect(parseSizeString('NaN KB')).toBe(0);
		});

		test('should handle edge cases', () => {
			expect(parseSizeString('0 B')).toBe(0);
			expect(parseSizeString('0.0 KB')).toBe(0);
			expect(parseSizeString('+0 MB')).toBe(0);
		});
	});

	describe('parseHaroldOutput', () => {
		test('should detect no changes', () => {
			const noChangesOutputs = [
				'No changes detected',
				'Snapshots are equal',
				'No changes in bundle size',
				'',
			];

			for (const output of noChangesOutputs) {
				const result = parseHaroldOutput(output);
				expect(result.hasChanges).toBe(false);
				expect(result.totalSizeIncrease).toBe(0);
				expect(result.percentageIncrease).toBe(0);
			}
		});

		test('should parse simple total changes', () => {
			const output = 'Total: + 1.2 KB (+300 B) (+2.5%)';
			const result = parseHaroldOutput(output);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(1.2 * 1024);
			expect(result.totalGzipIncrease).toBe(300);
			expect(result.percentageIncrease).toBe(2.5);
		});

		test('should parse complex Harold output', () => {
			const complexOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • harold-action • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • harold-action • feature-branch (def5678)

Total: + 2.1 KB (+500 B) (+1.8%)

Files:
 js/app.bundle.js      + 1.8 KB (+400 B) (+2.1%)
 js/vendor.bundle.js   + 0.3 KB (+100 B) (+0.9%)`;

			const result = parseHaroldOutput(complexOutput);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(2.1 * 1024);
			expect(result.totalGzipIncrease).toBe(500);
			expect(result.percentageIncrease).toBe(1.8);
		});

		test('should handle decrease in size', () => {
			const output = 'Total: - 1.5 KB (-400 B) (-3.2%)';
			const result = parseHaroldOutput(output);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(1.5 * 1024); // Абсолютное значение
			expect(result.totalGzipIncrease).toBe(400);
			expect(result.percentageIncrease).toBe(3.2); // Абсолютное значение
		});

		test('should handle missing percentage', () => {
			const output = 'Total: + 1.2 KB (+300 B)';
			const result = parseHaroldOutput(output);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(1.2 * 1024);
			expect(result.totalGzipIncrease).toBe(300);
			expect(result.percentageIncrease).toBe(0);
		});

		test('should handle missing total line', () => {
			const output = `Files:
 js/app.bundle.js      + 1.8 KB (+2.1%)`;

			const result = parseHaroldOutput(output);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(0);
			expect(result.totalGzipIncrease).toBe(0);
			expect(result.percentageIncrease).toBe(2.1); // Берется из первого найденного процента
		});

		test('should handle invalid input', () => {
			const invalidInputs = [null, undefined, 123, {}];

			for (const input of invalidInputs) {
				const result = parseHaroldOutput(input);
				expect(result.hasChanges).toBe(false);
				expect(result.totalSizeIncrease).toBe(0);
				expect(result.percentageIncrease).toBe(0);
			}
		});
	});

	describe('shouldFailOnIncrease', () => {
		test('should not fail when no changes detected', () => {
			const noChangesOutput = 'No changes detected';

			expect(shouldFailOnIncrease(noChangesOutput, 1000, 1)).toBe(false);
			expect(shouldFailOnIncrease(noChangesOutput, 0, 0)).toBe(false);
		});

		test('should fail when size threshold exceeded', () => {
			const output = 'Total: + 15.5 KB (+300 B) (+2.5%)';
			const sizeThreshold = 10 * 1024; // 10KB
			const percentageThreshold = 10; // 10%

			expect(shouldFailOnIncrease(output, sizeThreshold, percentageThreshold)).toBe(true);
		});

		test('should fail when percentage threshold exceeded', () => {
			const output = 'Total: + 1.2 KB (+300 B) (+15.5%)';
			const sizeThreshold = 50 * 1024; // 50KB (не превышен)
			const percentageThreshold = 10; // 10% (превышен)

			expect(shouldFailOnIncrease(output, sizeThreshold, percentageThreshold)).toBe(true);
		});

		test('should not fail when thresholds not exceeded', () => {
			const output = 'Total: + 1.2 KB (+300 B) (+2.5%)';
			const sizeThreshold = 10 * 1024; // 10KB (не превышен)
			const percentageThreshold = 5; // 5% (не превышен)

			expect(shouldFailOnIncrease(output, sizeThreshold, percentageThreshold)).toBe(false);
		});

		test('should handle size decrease correctly', () => {
			const output = 'Total: - 15.5 KB (-300 B) (-25.5%)';
			const sizeThreshold = 10 * 1024; // 10KB
			const percentageThreshold = 20; // 20%

			// Даже при уменьшении, если абсолютное значение превышает пороги, должно срабатывать
			expect(shouldFailOnIncrease(output, sizeThreshold, percentageThreshold)).toBe(true);
		});

		test('should handle edge case thresholds', () => {
			const output = 'Total: + 1.0 KB (+100 B) (+5.0%)';

			// Точно на пороге - не должно срабатывать (строгое неравенство)
			expect(shouldFailOnIncrease(output, 1024, 5)).toBe(false);

			// Чуть ниже порога - не должно срабатывать
			expect(shouldFailOnIncrease(output, 1025, 5.1)).toBe(false);

			// Чуть выше порога - должно срабатывать
			expect(shouldFailOnIncrease(output, 1023, 4.9)).toBe(true);
		});

		test('should handle malformed Harold output gracefully', () => {
			const malformedOutputs = [
				'Some random text without numbers',
				'Total: invalid format',
				'Total: + NaN KB',
				'',
				null,
				undefined,
			];

			for (const output of malformedOutputs) {
				expect(shouldFailOnIncrease(output, 1000, 5)).toBe(false);
			}
		});

		test('should handle real-world Harold outputs', () => {
			const realWorldExamples = [
				{
					output: `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • my-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • my-app • feature (def5678)

Total: + 2.1 KB (+500 B) (+1.8%)

Files:
 js/app.bundle.js      + 1.8 KB (+400 B) (+2.1%)
 js/vendor.bundle.js   + 0.3 KB (+100 B) (+0.9%)

Build time:
 Left: 2.34s
 Right: 2.41s (+0.07s)`,
					sizeThreshold: 1024, // 1KB
					percentageThreshold: 5,
					shouldFail: true, // 2.1KB > 1KB
				},
				{
					output: `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • my-app • main (abc1234)
 Right: 2/9/2025, 3:45:12 PM • my-app • main (abc1234)

No changes detected`,
					sizeThreshold: 0,
					percentageThreshold: 0,
					shouldFail: false, // Нет изменений
				},
				{
					output: `Total: - 500 B (-100 B) (-0.5%)

Files:
 css/styles.css        - 500 B (-100 B) (-2.1%)`,
					sizeThreshold: 1024, // 1KB
					percentageThreshold: 1, // 1%
					shouldFail: false, // 500B < 1KB и 0.5% < 1%
				},
			];

			for (const [index, { output, sizeThreshold, percentageThreshold, shouldFail }] of realWorldExamples.entries()) {
				const result = shouldFailOnIncrease(output, sizeThreshold, percentageThreshold);
				expect(result).toBe(shouldFail, `Example ${index + 1} failed`);
			}
		});
	});

	describe('Integration with different Harold output formats', () => {
		test('should handle Harold v1 format', () => {
			const v1Output = `Bundle analysis:
Total size: +1.2 kB (+2.5%)
Gzipped: +300 B (+1.8%)`;

			const result = parseHaroldOutput(v1Output);
			expect(result.hasChanges).toBe(true);
			// Может не найти точный формат, но не должно падать
		});

		test('should handle Harold error output', () => {
			const errorOutput = `Error: Could not find build directory: dist
Suggestion: Make sure your build command creates the expected output directory`;

			const result = parseHaroldOutput(errorOutput);
			expect(result.hasChanges).toBe(true); // Не содержит "No changes"
			expect(result.totalSizeIncrease).toBe(0); // Но числовые данные не найдены
			expect(result.percentageIncrease).toBe(0);
		});

		test('should handle very large numbers', () => {
			const largeOutput = 'Total: + 1,234.5 MB (+567.8 MB) (+45.6%)';
			const result = parseHaroldOutput(largeOutput);

			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(1234.5 * 1024 * 1024);
			expect(result.totalGzipIncrease).toBe(567.8 * 1024 * 1024);
			expect(result.percentageIncrease).toBe(45.6);
		});

		test('should handle unicode and special characters', () => {
			const unicodeOutput = `📊 Total: + 1.2 KB (+300 B) (+2.5%) ✅
🚀 Files improved!`;

			const result = parseHaroldOutput(unicodeOutput);
			expect(result.hasChanges).toBe(true);
			expect(result.totalSizeIncrease).toBe(1.2 * 1024);
			expect(result.percentageIncrease).toBe(2.5);
		});
	});
});
