/**
 * Unit тесты для функций форматирования комментариев
 * Тестирует логику создания и обновления комментариев в GitHub PR
 */

// Мокаем fs модуль для тестирования
const fs = require('node:fs');
jest.mock('node:fs');

// Мокаем утилиту ansi-strip
jest.mock('../../utils/ansi-strip.cjs', () => ({
	cleanHaroldOutput: jest.fn(text => text?.replace(/\u001B\[[\d;]*m/g, '') || 'No output available'),
}));

// Импортируем тестируемые функции
// Поскольку comment.cjs экспортирует только main функцию, нам нужно получить доступ к внутренним функциям
const commentScript = require('../../scripts/comment.cjs');

// Создаем моки для внутренних функций (они не экспортированы, поэтому тестируем через main)
describe('Comment Formatting Functions', () => {
	let mockGithub;
	let mockContext;
	let mockCore;

	beforeEach(() => {
		// Очищаем все моки
		jest.clearAllMocks();

		// Настраиваем моки для GitHub API
		mockGithub = {
			rest: {
				issues: {
					listComments: jest.fn(),
					createComment: jest.fn(),
					updateComment: jest.fn(),
				},
			},
		};

		// Настраиваем мок для контекста GitHub Actions
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

		// Настраиваем мок для core утилит
		mockCore = {
			info: jest.fn(),
			error: jest.fn(),
			setFailed: jest.fn(),
		};

		// Настраиваем переменные окружения для тестов
		process.env.IS_FORK = 'false';
		process.env.HAS_WRITE_ACCESS = 'true';
		process.env.CAN_COMMENT = 'true';
		process.env.ACCESS_LEVEL = 'full';
		process.env.FORK_RESTRICTIONS = '';
	});

	afterEach(() => {
		// Очищаем переменные окружения
		delete process.env.IS_FORK;
		delete process.env.HAS_WRITE_ACCESS;
		delete process.env.CAN_COMMENT;
		delete process.env.ACCESS_LEVEL;
		delete process.env.FORK_RESTRICTIONS;
	});

	describe('Harold results reading', () => {
		test('should read Harold results successfully', async () => {
			// Настраиваем моки файловой системы
			fs.existsSync.mockImplementation(filename => filename === 'harold-output.txt' || filename === 'harold-exit-code.txt');

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

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(fs.existsSync).toHaveBeenCalledWith('harold-output.txt');
			expect(fs.existsSync).toHaveBeenCalledWith('harold-exit-code.txt');
			expect(fs.readFileSync).toHaveBeenCalledWith('harold-output.txt', 'utf8');
			expect(fs.readFileSync).toHaveBeenCalledWith('harold-exit-code.txt', 'utf8');
			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});

		test('should handle missing Harold output file', async () => {
			fs.existsSync.mockImplementation(filename =>
				filename === 'harold-exit-code.txt', // Только exit code файл существует
			);

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

		test('should handle invalid exit code', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Some output';
				}

				if (filename === 'harold-exit-code.txt') {
					return 'invalid-number';
				}

				return '';
			});

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
	});

	describe('Comment creation and updating', () => {
		beforeEach(() => {
			// Настраиваем успешное чтение Harold результатов
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

		test('should create new comment when none exists', async () => {
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

			expect(mockGithub.rest.issues.listComments).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
			});

			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('📊 Bundle Size Report'),
			});

			expect(mockGithub.rest.updateComment).not.toHaveBeenCalled();
		});

		test('should update existing comment', async () => {
			const existingComment = {
				id: 789,
				body: '## 📊 Bundle Size Report\n\nOld content',
			};

			mockGithub.rest.issues.listComments.mockResolvedValue({
				data: [existingComment],
			});

			mockGithub.rest.issues.updateComment.mockResolvedValue({ data: { id: 789 } });

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: false,
			});

			expect(mockGithub.rest.issues.updateComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				comment_id: 789,
				body: expect.stringContaining('📊 Bundle Size Report'),
			});

			expect(mockGithub.rest.issues.createComment).not.toHaveBeenCalled();
		});

		test('should format comment correctly', async () => {
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

			const createCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			const commentBody = createCall.body;

			expect(commentBody).toContain('## 📊 Bundle Size Report');
			expect(commentBody).toContain('**Base:** `main` (abc1234)');
			expect(commentBody).toContain('**Head:** `feature-branch` (def0987)');
			expect(commentBody).toContain('**Status:** Changes detected');
			expect(commentBody).toContain('Total: + 1.2 KB (+2.5%)');
			expect(commentBody).toContain('Generated by [Harold Action]');
		});

		test('should handle no changes scenario', async () => {
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'No changes detected';
				}

				if (filename === 'harold-exit-code.txt') {
					return '0'; // Exit code 0 означает отсутствие изменений
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

			const createCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			const commentBody = createCall.body;

			expect(commentBody).toContain('**Status:** No changes');
			expect(commentBody).toContain('✅');
		});
	});

	describe('Fork and security handling', () => {
		test('should use fallback mode for fork with limited access', async () => {
			// Настраиваем контекст fork'а с ограниченным доступом
			process.env.IS_FORK = 'true';
			process.env.CAN_COMMENT = 'false';
			process.env.ACCESS_LEVEL = 'limited';

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

			// Мокаем console.log для проверки fallback вывода
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

			// Проверяем, что API не вызывался
			expect(mockGithub.rest.issues.createComment).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.updateComment).not.toHaveBeenCalled();

			// Проверяем, что результат выведен в лог
			expect(consoleSpy).toHaveBeenCalledWith('⚠️  Limited access detected - using fallback mode');
			expect(consoleSpy).toHaveBeenCalledWith('📊 Harold results (would be posted as comment):');

			consoleSpy.mockRestore();
		});

		test('should handle 403 error gracefully for forks', async () => {
			process.env.IS_FORK = 'true';
			process.env.CAN_COMMENT = 'true'; // Думаем что можем, но получаем 403

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

			// Мокаем 403 ошибку
			const error403 = new Error('Forbidden');
			error403.status = 403;
			mockGithub.rest.issues.createComment.mockRejectedValue(error403);

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

			// Проверяем graceful handling
			expect(consoleSpy).toHaveBeenCalledWith('⚠️  Insufficient permissions to create comment in fork - this is expected');
			expect(mockCore.setFailed).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('Threshold analysis', () => {
		beforeEach(() => {
			fs.existsSync.mockReturnValue(true);
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });
		});

		test('should fail when size threshold is exceeded', async () => {
			// Harold output с увеличением на 15KB (больше порога в 10KB)
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 15.5 KB (+10.2%)';
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
				sizeThreshold: 10_240, // 10KB
				percentageThreshold: 15, // 15%
				failOnIncrease: true,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Bundle size increased beyond threshold'),
			);
		});

		test('should fail when percentage threshold is exceeded', async () => {
			// Harold output с увеличением на 20% (больше порога в 15%)
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 2.1 KB (+20.5%)';
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
				sizeThreshold: 50_000, // 50KB (не превышен)
				percentageThreshold: 15, // 15% (превышен)
				failOnIncrease: true,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Bundle size increased beyond threshold'),
			);
		});

		test('should not fail when thresholds are not exceeded', async () => {
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Total: + 1.2 KB (+2.5%)';
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
				sizeThreshold: 10_240, // 10KB (не превышен)
				percentageThreshold: 5, // 5% (превышен, но failOnIncrease = false)
				failOnIncrease: false,
			});

			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});

		test('should not fail when no changes detected', async () => {
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'No changes detected';
				}

				if (filename === 'harold-exit-code.txt') {
					return '0';
				}

				return '';
			});

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 1, // Очень низкий порог
				percentageThreshold: 0.1, // Очень низкий порог
				failOnIncrease: true,
			});

			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});
	});

	describe('Error handling', () => {
		test('should create error comment when main processing fails', async () => {
			// Настраиваем ошибку чтения файлов
			fs.existsSync.mockReturnValue(false);

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

			// Проверяем, что была попытка создать error комментарий
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('❌'),
			});
		});

		test('should handle GitHub API errors', async () => {
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

			mockGithub.rest.issues.listComments.mockRejectedValue(new Error('API Error'));

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
		});
	});
});
