/**
 * Unit тесты для обработки ошибок в Harold Action
 * Тестирует различные сценарии ошибок и их корректную обработку
 */

const fs = require('node:fs');

// Мокаем fs модуль
jest.mock('node:fs');

// Мокаем утилиту ansi-strip
jest.mock('../../utils/ansi-strip.cjs', () => ({
	cleanHaroldOutput: jest.fn(text => text?.replace(/\u001B\[[\d;]*m/g, '') || 'No output available'),
}));

const commentScript = require('../../scripts/comment.cjs');

describe('Error Handling', () => {
	let mockGithub;
	let mockContext;
	let mockCore;

	beforeEach(() => {
		jest.clearAllMocks();

		mockGithub = {
			rest: {
				issues: {
					listComments: jest.fn(),
					createComment: jest.fn(),
					updateComment: jest.fn(),
				},
			},
		};

		mockContext = {
			repo: {
				owner: 'test-owner',
				repo: 'test-repo',
			},
			payload: {
				pull_request: {
					number: 123,
					base: {
						sha: 'abc1234567890',
						ref: 'main',
					},
					head: {
						sha: 'def0987654321',
						ref: 'feature-branch',
					},
				},
			},
		};

		mockCore = {
			info: jest.fn(),
			error: jest.fn(),
			setFailed: jest.fn(),
		};

		// Настраиваем переменные окружения по умолчанию
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

	describe('File System Errors', () => {
		test('should handle missing harold-output.txt file', async () => {
			fs.existsSync.mockImplementation(filename =>
				filename === 'harold-exit-code.txt', // Только exit code файл существует
			);

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('❌'),
			});
		});

		test('should handle missing harold-exit-code.txt file', async () => {
			fs.existsSync.mockImplementation(filename =>
				filename === 'harold-output.txt', // Только output файл существует
			);

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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

		test('should handle file read errors', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(() => {
				throw new Error('Permission denied');
			});

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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

		test('should handle corrupted exit code file', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Some output';
				}

				if (filename === 'harold-exit-code.txt') {
					return 'not-a-number';
				}

				return '';
			});

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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

		test('should handle empty files', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return ''; // Пустой файл
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Пустой файл не должен вызывать ошибку, но должен обрабатываться корректно
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();
		});
	});

	describe('GitHub API Errors', () => {
		beforeEach(() => {
			// Настраиваем успешное чтение файлов
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
		});

		test('should handle GitHub API rate limiting', async () => {
			const rateLimitError = new Error('API rate limit exceeded');
			rateLimitError.status = 403;
			rateLimitError.response = {
				headers: {
					'x-ratelimit-remaining': '0',
				},
			};

			mockGithub.rest.issues.listComments.mockRejectedValue(rateLimitError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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

		test('should handle network timeouts', async () => {
			const timeoutError = new Error('Request timeout');
			timeoutError.code = 'ETIMEDOUT';

			mockGithub.rest.issues.listComments.mockRejectedValue(timeoutError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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

		test('should handle repository not found error', async () => {
			const notFoundError = new Error('Not Found');
			notFoundError.status = 404;

			mockGithub.rest.issues.listComments.mockRejectedValue(notFoundError);
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

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
		});

		test('should handle comment creation failure', async () => {
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });

			const createError = new Error('Failed to create comment');
			mockGithub.rest.issues.createComment.mockRejectedValue(createError);

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
		});

		test('should handle comment update failure', async () => {
			const existingComment = {
				id: 789,
				body: '## 📊 Bundle Size Report\n\nOld content',
			};

			mockGithub.rest.issues.listComments.mockResolvedValue({
				data: [existingComment],
			});

			const updateError = new Error('Failed to update comment');
			mockGithub.rest.issues.updateComment.mockRejectedValue(updateError);

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
		});

		test('should handle fallback comment creation failure', async () => {
			// Первая ошибка - чтение файлов
			fs.existsSync.mockReturnValue(false);

			// Вторая ошибка - создание fallback комментария
			const fallbackError = new Error('Failed to create fallback comment');
			mockGithub.rest.issues.createComment.mockRejectedValue(fallbackError);

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
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to create fallback comment'),
			);
		});
	});

	describe('Fork Security Errors', () => {
		beforeEach(() => {
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
		});

		test('should handle 403 error gracefully for forks', async () => {
			process.env.IS_FORK = 'true';
			process.env.CAN_COMMENT = 'true';

			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });

			const forbiddenError = new Error('Forbidden');
			forbiddenError.status = 403;
			mockGithub.rest.issues.createComment.mockRejectedValue(forbiddenError);

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(consoleSpy).toHaveBeenCalledWith(
				'⚠️  Insufficient permissions to create comment in fork - this is expected',
			);
			expect(mockCore.setFailed).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		test('should handle non-403 errors in forks normally', async () => {
			process.env.IS_FORK = 'true';
			process.env.CAN_COMMENT = 'true';

			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });

			const serverError = new Error('Internal Server Error');
			serverError.status = 500;
			mockGithub.rest.issues.createComment.mockRejectedValue(serverError);

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Для не-403 ошибок в fork'ах должна быть обычная обработка ошибок
			expect(mockCore.setFailed).toHaveBeenCalled();
		});

		test('should use fallback mode when access is limited', async () => {
			process.env.IS_FORK = 'true';
			process.env.CAN_COMMENT = 'false';
			process.env.ACCESS_LEVEL = 'limited';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(consoleSpy).toHaveBeenCalledWith('⚠️  Limited access detected - using fallback mode');
			expect(mockGithub.rest.issues.createComment).not.toHaveBeenCalled();
			expect(mockCore.setFailed).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('Threshold Analysis Errors', () => {
		beforeEach(() => {
			fs.existsSync.mockReturnValue(true);
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });
		});

		test('should handle malformed Harold output gracefully', async () => {
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Completely malformed output with no recognizable patterns';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 1000,
				percentageThreshold: 5,
				failOnIncrease: true,
			});

			// Не должно падать из-за невозможности парсинга
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();
		});

		test('should handle threshold analysis errors', async () => {
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + Infinity KB (+NaN%) - invalid numbers';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 1000,
				percentageThreshold: 5,
				failOnIncrease: true,
			});

			// Должно обработать ошибку парсинга gracefully
			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});
	});

	describe('Parameter Validation Errors', () => {
		beforeEach(() => {
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
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });
		});

		test('should handle invalid threshold parameters', async () => {
			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 'invalid-number',
				percentageThreshold: 'invalid-percentage',
				failOnIncrease: true,
			});

			// Должно обработать некорректные параметры без падения
			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});

		test('should handle missing context parameters', async () => {
			const incompleteContext = {
				repo: {
					owner: 'test-owner',
					repo: 'test-repo',
				},
				payload: {
					// Отсутствует pull_request
				},
			};

			await commentScript({
				github: mockGithub,
				context: incompleteContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalled();
		});

		test('should handle missing GitHub client methods', async () => {
			const incompleteGithub = {
				rest: {
					// Отсутствует issues
				},
			};

			await commentScript({
				github: incompleteGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).toHaveBeenCalled();
		});
	});

	describe('Recovery and Resilience', () => {
		test('should continue processing after non-critical errors', async () => {
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

			// Первый вызов API падает, второй успешен
			mockGithub.rest.issues.listComments
				.mockRejectedValueOnce(new Error('Temporary failure'))
				.mockResolvedValueOnce({ data: [] });

			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			// Должно упасть из-за первой ошибки, но попытаться создать fallback комментарий
			expect(mockCore.setFailed).toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();
		});

		test('should provide meaningful error messages', async () => {
			fs.existsSync.mockReturnValue(false);

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
			expect(mockCore.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to process Harold comment'),
			);
		});
	});
});
