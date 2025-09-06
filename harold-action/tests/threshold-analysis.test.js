/**
 * Unit тесты для функций анализа пороговых значений
 */

describe('Threshold Analysis Functions', () => {
	describe('Size threshold analysis', () => {
		const checkSizeThreshold = (sizeIncrease, threshold) => sizeIncrease > threshold;

		test('should detect when size threshold is exceeded', () => {
			expect(checkSizeThreshold(2048, 1024)).toBe(true);
			expect(checkSizeThreshold(1500, 1024)).toBe(true);
		});

		test('should not trigger when under threshold', () => {
			expect(checkSizeThreshold(500, 1024)).toBe(false);
			expect(checkSizeThreshold(1024, 1024)).toBe(false);
		});

		test('should handle zero values', () => {
			expect(checkSizeThreshold(0, 1024)).toBe(false);
			expect(checkSizeThreshold(100, 0)).toBe(true);
		});

		test('should handle negative values', () => {
			expect(checkSizeThreshold(-100, 1024)).toBe(false);
			expect(checkSizeThreshold(100, -50)).toBe(true);
		});
	});

	describe('Percentage threshold analysis', () => {
		const checkPercentageThreshold = (percentageIncrease, threshold) => percentageIncrease > threshold;

		test('should detect when percentage threshold is exceeded', () => {
			expect(checkPercentageThreshold(15.5, 10)).toBe(true);
			expect(checkPercentageThreshold(25, 20)).toBe(true);
		});

		test('should not trigger when under threshold', () => {
			expect(checkPercentageThreshold(5, 10)).toBe(false);
			expect(checkPercentageThreshold(10, 10)).toBe(false);
		});

		test('should handle decimal values', () => {
			expect(checkPercentageThreshold(10.1, 10)).toBe(true);
			expect(checkPercentageThreshold(9.9, 10)).toBe(false);
		});

		test('should handle zero values', () => {
			expect(checkPercentageThreshold(0, 5)).toBe(false);
			expect(checkPercentageThreshold(1, 0)).toBe(true);
		});
	});

	describe('Combined threshold analysis', () => {
		const analyzeThresholds = (sizeIncrease, percentageIncrease, sizeThreshold, percentageThreshold) => ({
			sizeExceeded: sizeIncrease > sizeThreshold,
			percentageExceeded: percentageIncrease > percentageThreshold,
			shouldFail: sizeIncrease > sizeThreshold || percentageIncrease > percentageThreshold,
		});

		test('should fail when size threshold exceeded', () => {
			const result = analyzeThresholds(2048, 5, 1024, 10);
			expect(result.sizeExceeded).toBe(true);
			expect(result.percentageExceeded).toBe(false);
			expect(result.shouldFail).toBe(true);
		});

		test('should fail when percentage threshold exceeded', () => {
			const result = analyzeThresholds(500, 15, 1024, 10);
			expect(result.sizeExceeded).toBe(false);
			expect(result.percentageExceeded).toBe(true);
			expect(result.shouldFail).toBe(true);
		});

		test('should fail when both thresholds exceeded', () => {
			const result = analyzeThresholds(2048, 15, 1024, 10);
			expect(result.sizeExceeded).toBe(true);
			expect(result.percentageExceeded).toBe(true);
			expect(result.shouldFail).toBe(true);
		});

		test('should not fail when under both thresholds', () => {
			const result = analyzeThresholds(500, 5, 1024, 10);
			expect(result.sizeExceeded).toBe(false);
			expect(result.percentageExceeded).toBe(false);
			expect(result.shouldFail).toBe(false);
		});

		test('should handle edge cases', () => {
			// Exact threshold values
			const result1 = analyzeThresholds(1024, 10, 1024, 10);
			expect(result1.shouldFail).toBe(false);

			// Just over threshold
			const result2 = analyzeThresholds(1025, 10.1, 1024, 10);
			expect(result2.shouldFail).toBe(true);
		});
	});

	describe('Real-world scenarios', () => {
		const analyzeRealWorldScenario = (haroldOutput, sizeThreshold, percentageThreshold) => {
			// Симуляция реального анализа Harold output
			const parseOutput = output => {
				if (output.includes('No changes')) {
					return { sizeIncrease: 0, percentageIncrease: 0 };
				}

				let sizeIncrease = 0;
				let percentageIncrease = 0;

				// Парсим размер
				const sizeMatch = output.match(/([+-][\d,.]+)\s*([GKMgkm]?)B/);
				if (sizeMatch) {
					const value = Number.parseFloat(sizeMatch[1].replaceAll(',', ''));
					const unit = sizeMatch[2].toUpperCase();

					sizeIncrease = value;
					if (unit === 'K') {
						sizeIncrease *= 1024;
					} else if (unit === 'M') {
						sizeIncrease *= 1024 * 1024;
					}

					sizeIncrease = Math.abs(sizeIncrease);
				}

				// Парсим процент
				const percentMatch = output.match(/([+-]?[\d.]+)%/);
				if (percentMatch) {
					percentageIncrease = Math.abs(Number.parseFloat(percentMatch[1]));
				}

				return { sizeIncrease, percentageIncrease };
			};

			const { sizeIncrease, percentageIncrease } = parseOutput(haroldOutput);

			return {
				sizeIncrease,
				percentageIncrease,
				sizeExceeded: sizeIncrease > sizeThreshold,
				percentageExceeded: percentageIncrease > percentageThreshold,
				shouldFail: sizeIncrease > sizeThreshold || percentageIncrease > percentageThreshold,
			};
		};

		test('should handle typical bundle increase', () => {
			const output = 'Total: +1.5 kB (+800 B) - increase of 8.2%';
			const result = analyzeRealWorldScenario(output, 1024, 10);

			expect(result.sizeIncrease).toBe(1536); // 1.5 * 1024
			expect(result.percentageIncrease).toBe(8.2);
			expect(result.sizeExceeded).toBe(true); // 1536 > 1024
			expect(result.percentageExceeded).toBe(false); // 8.2 < 10
			expect(result.shouldFail).toBe(true);
		});

		test('should handle large percentage increase', () => {
			const output = 'Total: +500 B - increase of 25%';
			const result = analyzeRealWorldScenario(output, 1024, 10);

			expect(result.sizeIncrease).toBe(500);
			expect(result.percentageIncrease).toBe(25);
			expect(result.sizeExceeded).toBe(false); // 500 < 1024
			expect(result.percentageExceeded).toBe(true); // 25 > 10
			expect(result.shouldFail).toBe(true);
		});

		test('should handle no changes', () => {
			const output = 'No changes detected';
			const result = analyzeRealWorldScenario(output, 1024, 10);

			expect(result.sizeIncrease).toBe(0);
			expect(result.percentageIncrease).toBe(0);
			expect(result.shouldFail).toBe(false);
		});

		test('should handle small acceptable changes', () => {
			const output = 'Total: +200 B - increase of 2.1%';
			const result = analyzeRealWorldScenario(output, 1024, 10);

			expect(result.sizeIncrease).toBe(200);
			expect(result.percentageIncrease).toBe(2.1);
			expect(result.shouldFail).toBe(false);
		});

		test('should handle megabyte increases', () => {
			const output = 'Total: +2.5 MB - increase of 15%';
			const result = analyzeRealWorldScenario(output, 1_048_576, 20); // 1MB threshold, 20%

			expect(result.sizeIncrease).toBe(2_621_440); // 2.5 * 1024 * 1024
			expect(result.percentageIncrease).toBe(15);
			expect(result.sizeExceeded).toBe(true); // 2.5MB > 1MB
			expect(result.percentageExceeded).toBe(false); // 15% < 20%
			expect(result.shouldFail).toBe(true);
		});
	});

	describe('Error handling', () => {
		const safeAnalyzeThresholds = (sizeIncrease, percentageIncrease, sizeThreshold, percentageThreshold) => {
			try {
				// Валидация входных параметров
				if (typeof sizeIncrease !== 'number' || isNaN(sizeIncrease)) {
					sizeIncrease = 0;
				}

				if (typeof percentageIncrease !== 'number' || isNaN(percentageIncrease)) {
					percentageIncrease = 0;
				}

				if (typeof sizeThreshold !== 'number' || isNaN(sizeThreshold)) {
					sizeThreshold = Infinity;
				}

				if (typeof percentageThreshold !== 'number' || isNaN(percentageThreshold)) {
					percentageThreshold = Infinity;
				}

				return {
					sizeExceeded: sizeIncrease > sizeThreshold,
					percentageExceeded: percentageIncrease > percentageThreshold,
					shouldFail: sizeIncrease > sizeThreshold || percentageIncrease > percentageThreshold,
					error: null,
				};
			} catch (error) {
				return {
					sizeExceeded: false,
					percentageExceeded: false,
					shouldFail: false,
					error: error.message,
				};
			}
		};

		test('should handle invalid number inputs', () => {
			const result = safeAnalyzeThresholds('invalid', 'also invalid', 1024, 10);
			expect(result.shouldFail).toBe(false);
			expect(result.error).toBeNull();
		});

		test('should handle null/undefined inputs', () => {
			const result = safeAnalyzeThresholds(null, undefined, 1024, 10);
			expect(result.shouldFail).toBe(false);
			expect(result.error).toBeNull();
		});

		test('should handle invalid thresholds', () => {
			const result = safeAnalyzeThresholds(2048, 15, 'invalid', null);
			expect(result.shouldFail).toBe(false); // Infinity thresholds mean never fail
			expect(result.error).toBeNull();
		});

		test('should handle extreme values', () => {
			const result = safeAnalyzeThresholds(Number.MAX_VALUE, Number.MAX_VALUE, 1024, 10);
			expect(result.shouldFail).toBe(true);
			expect(result.error).toBeNull();
		});
	});
});
