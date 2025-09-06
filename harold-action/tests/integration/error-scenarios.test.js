/**
 * Integration тесты для сценариев ошибок Harold Action
 * Тестирует обработку различных типов ошибок и восстановление
 */

const fs = require('node:fs');

// Мокаем fs модуль
jest.mock('node:fs');

describe('Harold Action Error Scenarios Integration', () => {
	let mockGithub;
	let mockContext;
	let mockCore;

	beforeEach(() => {
		jest.clearAllMocks();

		mockGithub = global.createMockGitHubAPI();
		mockContext = global.createMockGitHubContext();
		mockCore = global.createMockCore();

		// Настраиваем переменные окружения
		process.env.IS_FORK = 'false';
		process.env.HAS_WRITE_ACCESS = 'true';
		process.env.CAN_COMMENT = 'true';
		process.env.ACCESS_LEVEL = 'full';
	});

	afterEach(() => {
		delete process.env.IS_FORK;
		delete process.env.HAS_WRITE_ACCESS;
		delete process.env.CAN_COMMENT;
		delete process.env.ACCESS_LEVEL;
	});

	describe('Harold Execution Errors', () => {
		test('should handle Harold command not found error', async () => {
			const haroldNotFoundError = `Error: harold command not found
Command 'harold' not found in PATH

Suggestion: Install harold with 'npm install -g @343dev/harold'`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return haroldNotFoundError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '127'; // Command not found
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).not.toHaveBeenCalled();

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('harold command not found');
			expect(commentCall.body).toContain('npm install -g @343dev/harold');
		});

		test('should handle Harold configuration error', async () => {
			const configError = `Error: Invalid harold configuration
Configuration file '.haroldrc.js' contains syntax errors

SyntaxError: Unexpected token '}' in .haroldrc.js:15:1

Suggestion: Check your harold configuration file for syntax errors`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return configError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('Invalid harold configuration');
			expect(commentCall.body).toContain('SyntaxError');
			expect(commentCall.body).toContain('.haroldrc.js:15:1');
		});

		test('should handle Harold snapshot creation failure', async () => {
			const snapshotError = `Error: Failed to create snapshot
Could not read build directory: dist

ENOENT: no such file or directory, scandir 'dist'

Suggestion: Make sure your build command creates the 'dist' directory`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return snapshotError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '2';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('Failed to create snapshot');
			expect(commentCall.body).toContain('ENOENT: no such file or directory');
		});

		test('should handle Harold diff comparison error', async () => {
			const diffError = `Error: Failed to compare snapshots
Base snapshot file is corrupted or invalid

JSON parse error at position 156: Unexpected token

Suggestion: Try regenerating the base snapshot`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return diffError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '3';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('Failed to compare snapshots');
			expect(commentCall.body).toContain('JSON parse error');
		});
	});

	describe('Build Process Errors', () => {
		test('should handle npm install failure', async () => {
			const npmInstallError = `Error: npm install failed
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree

npm ERR! peer dep missing: react@^18.0.0, required by react-dom@18.2.0

Suggestion: Fix dependency conflicts or use --legacy-peer-deps`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return npmInstallError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('npm install failed');
			expect(commentCall.body).toContain('ERESOLVE unable to resolve dependency tree');
			expect(commentCall.body).toContain('--legacy-peer-deps');
		});

		test('should handle build script missing', async () => {
			const buildScriptMissing = `Error: Build script not found
npm ERR! missing script: build

Available scripts:
  start, test, lint

Suggestion: Add a 'build' script to your package.json`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return buildScriptMissing;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('Build script not found');
			expect(commentCall.body).toContain('missing script: build');
			expect(commentCall.body).toContain('Add a \'build\' script');
		});

		test('should handle TypeScript compilation errors', async () => {
			const typescriptError = `Error: TypeScript compilation failed
src/components/Button.tsx(15,7): error TS2322: Type 'string' is not assignable to type 'number'
src/utils/helpers.ts(23,12): error TS2304: Cannot find name 'proces'

Found 2 errors. Watching for file changes.

Suggestion: Fix TypeScript errors before building`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return typescriptError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '2';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('TypeScript compilation failed');
			expect(commentCall.body).toContain('Button.tsx(15,7): error TS2322');
			expect(commentCall.body).toContain('Found 2 errors');
		});

		test('should handle out of memory errors', async () => {
			const memoryError = `Error: Build process ran out of memory
<--- Last few GCs --->

[1234:0x5555] 12345 ms: Mark-Sweep 2048.0 (2048.0) -> 2048.0 (2048.0) MB, 1234.5 / 0.0 ms  (average mu = 0.123, current mu = 0.123) allocation failure scavenge might not succeed

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory

Suggestion: Increase Node.js memory limit with --max-old-space-size=4096`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return memoryError;
				}

				if (filename === 'harold-exit-code.txt') {
					return '134'; // SIGABRT
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('ran out of memory');
			expect(commentCall.body).toContain('JavaScript heap out of memory');
			expect(commentCall.body).toContain('--max-old-space-size=4096');
		});
	});

	describe('GitHub API Error Recovery', () => {
		test('should retry on temporary API failures', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			// Первый вызов падает, второй успешен
			mockGithub.rest.issues.listComments
				.mockRejectedValueOnce(new Error('Service Temporarily Unavailable'))
				.mockResolvedValueOnce({ data: [] });

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Должно упасть на первой ошибке, но создать fallback комментарий
			expect(mockCore.setFailed).toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('❌'),
			});
		});

		test('should handle rate limiting gracefully', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const rateLimitError = new Error('API rate limit exceeded');
			rateLimitError.status = 403;
			rateLimitError.response = {
				headers: {
					'x-ratelimit-remaining': '0',
					'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600,
				},
			};

			mockGithub.rest.issues.listComments.mockRejectedValue(rateLimitError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Harold comment processing failed'),
			);

			// Должна быть попытка создать error комментарий
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('❌'),
			});
		});

		test('should handle repository access denied', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const accessDeniedError = new Error('Repository access denied');
			accessDeniedError.status = 404; // GitHub returns 404 for private repos without access

			mockGithub.rest.issues.listComments.mockRejectedValue(accessDeniedError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalled();
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('Repository access denied'),
			);
		});
	});

	describe('File System Error Recovery', () => {
		test('should handle permission denied errors', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(() => {
				const error = new Error('Permission denied');
				error.code = 'EACCES';
				throw error;
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith('Failed to read Harold results');
		});

		test('should handle disk space errors', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(() => {
				const error = new Error('No space left on device');
				error.code = 'ENOSPC';
				throw error;
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith('Failed to read Harold results');
		});

		test('should handle corrupted files gracefully', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					// Возвращаем бинарные данные как строку
					return Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]).toString();
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Не должно падать из-за корруптированных данных
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();
		});
	});

	describe('Network and Connectivity Errors', () => {
		test('should handle network timeout', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const timeoutError = new Error('Request timeout');
			timeoutError.code = 'ETIMEDOUT';

			mockGithub.rest.issues.listComments.mockRejectedValue(timeoutError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalled();
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('Request timeout'),
			);
		});

		test('should handle DNS resolution failure', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const dnsError = new Error('getaddrinfo ENOTFOUND api.github.com');
			dnsError.code = 'ENOTFOUND';

			mockGithub.rest.issues.listComments.mockRejectedValue(dnsError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalled();
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('ENOTFOUND'),
			);
		});
	});

	describe('Cascading Error Recovery', () => {
		test('should handle multiple consecutive failures', async () => {
			fs.existsSync.mockReturnValue(false); // Первая ошибка - файлы не найдены

			// Вторая ошибка - fallback комментарий тоже падает
			const fallbackError = new Error('GitHub API completely unavailable');
			mockGithub.rest.issues.createComment.mockRejectedValue(fallbackError);

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Основная ошибка
			expect(mockCore.setFailed).toHaveBeenCalledWith('Failed to read Harold results');

			// Ошибка fallback комментария
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to create fallback comment'),
			);
		});

		test('should provide meaningful error context', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			// Создаем ошибку с дополнительным контекстом
			const contextualError = new Error('Detailed API error');
			contextualError.status = 422;
			contextualError.response = {
				data: {
					message: 'Validation Failed',
					errors: [
						{ field: 'body', code: 'too_long' },
					],
				},
			};

			mockGithub.rest.issues.listComments.mockRejectedValue(contextualError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Harold comment processing failed'),
			);

			// Проверяем, что error комментарий содержит полезную информацию
			const errorCommentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(errorCommentCall.body).toContain('❌');
			expect(errorCommentCall.body).toContain('Detailed API error');
		});
	});
});
