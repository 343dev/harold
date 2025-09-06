/**
 * Integration тесты для полного workflow Harold Action
 * Тестирует взаимодействие всех компонентов системы
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawn } = require('node:child_process');

// Мокаем fs для контроля файловой системы
jest.mock('node:fs');

describe('Harold Action Full Workflow Integration', () => {
	let testWorkspace;
	let originalCwd;

	beforeAll(() => {
		originalCwd = process.cwd();
		testWorkspace = path.join(__dirname, '..', 'temp-workspace');
	});

	afterAll(() => {
		process.chdir(originalCwd);
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Настраиваем переменные окружения для тестов
		process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
		process.env.GITHUB_EVENT_NAME = 'pull_request';
		process.env.GITHUB_REF = 'refs/pull/123/merge';
		process.env.GITHUB_HEAD_REF = 'feature-branch';
		process.env.GITHUB_BASE_REF = 'main';
		process.env.IS_FORK = 'false';
		process.env.HAS_WRITE_ACCESS = 'true';
		process.env.CAN_COMMENT = 'true';
		process.env.ACCESS_LEVEL = 'full';
	});

	afterEach(() => {
		// Очищаем переменные окружения
		delete process.env.GITHUB_REPOSITORY;
		delete process.env.GITHUB_EVENT_NAME;
		delete process.env.GITHUB_REF;
		delete process.env.GITHUB_HEAD_REF;
		delete process.env.GITHUB_BASE_REF;
		delete process.env.IS_FORK;
		delete process.env.HAS_WRITE_ACCESS;
		delete process.env.CAN_COMMENT;
		delete process.env.ACCESS_LEVEL;
	});

	describe('Complete Harold Analysis Workflow', () => {
		test('should execute full workflow with size increase', async () => {
			// Настраиваем моки файловой системы
			const haroldOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • test-project • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • test-project • feature (def5678)

Total: + 2.1 KB (+500 B) (+1.8%)

Files:
 js/app.bundle.js      + 1.8 KB (+400 B) (+2.1%)
 js/vendor.bundle.js   + 0.3 KB (+100 B) (+0.9%)

Build time:
 Left: 2.34s
 Right: 2.41s (+0.07s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return haroldOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			// Мокаем GitHub API
			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			// Импортируем и выполняем основной скрипт
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

			// Проверяем, что workflow выполнился успешно
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('📊 Bundle Size Report'),
			});

			// Проверяем содержимое комментария
			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('**Base:** `main` (abc1234)');
			expect(commentCall.body).toContain('**Head:** `feature-branch` (def0987)');
			expect(commentCall.body).toContain('**Status:** Changes detected');
			expect(commentCall.body).toContain('Total: + 2.1 KB');
			expect(commentCall.body).toContain('js/app.bundle.js');
		});

		test('should handle no changes scenario', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'No changes detected';
				}

				if (filename === 'harold-exit-code.txt') {
					return '0';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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
			expect(commentCall.body).toContain('**Status:** No changes');
			expect(commentCall.body).toContain('✅');
		});

		test('should fail when thresholds are exceeded', async () => {
			const haroldOutput = 'Total: + 15.5 KB (+300 B) (+25.5%)';

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return haroldOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240, // 10KB (превышен)
				percentageThreshold: 20, // 20% (превышен)
				failOnIncrease: true,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Bundle size increased beyond threshold'),
			);
		});
	});

	describe('Fork Repository Workflow', () => {
		beforeEach(() => {
			process.env.IS_FORK = 'true';
			process.env.HAS_WRITE_ACCESS = 'false';
			process.env.CAN_COMMENT = 'false';
			process.env.ACCESS_LEVEL = 'limited';
		});

		test('should use fallback mode for fork with limited access', async () => {
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

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

			// Проверяем fallback поведение
			expect(mockGithub.rest.issues.createComment).not.toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith('⚠️  Limited access detected - using fallback mode');
			expect(consoleSpy).toHaveBeenCalledWith('📊 Harold results (would be posted as comment):');

			consoleSpy.mockRestore();
		});

		test('should handle 403 error gracefully in fork', async () => {
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

			const mockGithub = global.createMockGitHubAPI();
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: [] });

			const error403 = new Error('Forbidden');
			error403.status = 403;
			mockGithub.rest.issues.createComment.mockRejectedValue(error403);

			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

			expect(consoleSpy).toHaveBeenCalledWith(
				'⚠️  Insufficient permissions to create comment in fork - this is expected',
			);
			expect(mockCore.setFailed).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('Error Recovery Scenarios', () => {
		test('should recover from temporary GitHub API failures', async () => {
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

			const mockGithub = global.createMockGitHubAPI();

			// Первый вызов падает, но создание error комментария успешно
			mockGithub.rest.issues.listComments.mockRejectedValue(new Error('Temporary API failure'));
			mockGithub.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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

			// Основной процесс должен упасть
			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Harold comment processing failed'),
			);

			// Но должна быть попытка создать error комментарий
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				issue_number: 123,
				body: expect.stringContaining('❌'),
			});
		});

		test('should handle corrupted Harold output gracefully', async () => {
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return 'Completely corrupted output with binary data \u0000\u0001\u0002';
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 10_240,
				percentageThreshold: 5,
				failOnIncrease: true,
			});

			// Не должно падать из-за корруптированного вывода
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();
		});
	});

	describe('Comment Update Workflow', () => {
		test('should update existing comment instead of creating new one', async () => {
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

			const existingComment = {
				id: 789,
				body: '## 📊 Bundle Size Report\n\nOld content',
			};

			const mockGithub = global.createMockGitHubAPI();
			mockGithub.rest.issues.listComments.mockResolvedValue({
				data: [existingComment],
			});
			mockGithub.rest.issues.updateComment.mockResolvedValue({ data: { id: 789 } });

			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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

			expect(mockGithub.rest.issues.updateComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				comment_id: 789,
				body: expect.stringContaining('📊 Bundle Size Report'),
			});

			expect(mockGithub.rest.issues.createComment).not.toHaveBeenCalled();
		});

		test('should find correct comment among multiple comments', async () => {
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

			const comments = [
				{ id: 100, body: 'Some other comment' },
				{ id: 200, body: 'Another comment' },
				{ id: 300, body: '## 📊 Bundle Size Report\n\nHarold comment content' },
				{ id: 400, body: 'Yet another comment' },
			];

			const mockGithub = global.createMockGitHubAPI();
			mockGithub.rest.issues.listComments.mockResolvedValue({ data: comments });
			mockGithub.rest.issues.updateComment.mockResolvedValue({ data: { id: 300 } });

			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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

			// Должен обновить правильный комментарий (id: 300)
			expect(mockGithub.rest.issues.updateComment).toHaveBeenCalledWith({
				owner: 'test-owner',
				repo: 'test-repo',
				comment_id: 300,
				body: expect.stringContaining('📊 Bundle Size Report'),
			});
		});
	});

	describe('Real-world Harold Output Scenarios', () => {
		test('should handle complex multi-file changes', async () => {
			const complexHaroldOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • my-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • my-app • feature (def5678)

Total: + 5.7 KB (+1.2 KB) (+3.2%)

Diff by files:
+ assets/new-feature.js: +3.2 KB (+800 B)
m assets/app.js: +2.1 KB (+300 B) (+1.8%)
m assets/vendor.js: +400 B (+100 B) (+0.3%)
- assets/old-module.js: -0 B (-0 B)

Build time:
 Left: 3.21s
 Right: 3.45s (+0.24s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return complexHaroldOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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

			expect(commentCall.body).toContain('Total: + 5.7 KB');
			expect(commentCall.body).toContain('assets/new-feature.js');
			expect(commentCall.body).toContain('assets/app.js');
			expect(commentCall.body).toContain('Build time:');
			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});

		test('should handle Harold error output', async () => {
			const errorOutput = `Error: Could not find build directory: dist
Suggestion: Make sure your build command creates the expected output directory

Available directories:
- src/
- public/
- node_modules/`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return errorOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '2'; // Error exit code
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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

			expect(commentCall.body).toContain('Error: Could not find build directory');
			expect(commentCall.body).toContain('Suggestion: Make sure your build command');
			expect(mockCore.setFailed).not.toHaveBeenCalled();
		});

		test('should handle very large bundle changes', async () => {
			const largeBundleOutput = `Total: + 2.5 MB (+500 KB) (+45.2%)

Files:
 assets/huge-library.js: +2.3 MB (+480 KB) (+89.1%)
 assets/app.js: +200 KB (+20 KB) (+12.3%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return largeBundleOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const commentScript = require('../../scripts/comment.cjs');

			await commentScript({
				github: mockGithub,
				context: mockContext,
				core: mockCore,
				commentTitle: '📊 Bundle Size Report',
				sizeThreshold: 1024 * 1024, // 1MB (превышен)
				percentageThreshold: 40, // 40% (превышен)
				failOnIncrease: true,
			});

			expect(mockCore.setFailed).toHaveBeenCalledWith(
				expect.stringContaining('Bundle size increased beyond threshold'),
			);

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('+ 2.5 MB');
			expect(commentCall.body).toContain('huge-library.js');
		});
	});

	describe('Performance and Scalability', () => {
		test('should handle large number of changed files', async () => {
			// Генерируем вывод с большим количеством файлов
			let largeOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • large-project • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • large-project • feature (def5678)

Total: + 50.2 KB (+12.3 KB) (+8.7%)

Files:`;

			// Добавляем 100 файлов
			for (let index = 1; index <= 100; index++) {
				largeOutput += `\n components/Component${index}.js: +${index * 10} B (+${index * 2} B) (+${(index * 0.1).toFixed(1)}%)`;
			}

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return largeOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

			const startTime = Date.now();

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

			const executionTime = Date.now() - startTime;

			// Проверяем, что обработка завершилась быстро (< 1 секунды)
			expect(executionTime).toBeLessThan(1000);
			expect(mockCore.setFailed).not.toHaveBeenCalled();
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('Component1.js');
			expect(commentCall.body).toContain('Component100.js');
		});

		test('should handle very long Harold output', async () => {
			// Создаем очень длинный вывод (> 10KB)
			const longOutput = 'Total: + 1.2 KB (+300 B) (+2.5%)\n\n' + 'A'.repeat(10_000);

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return longOutput;
				}

				if (filename === 'harold-exit-code.txt') {
					return '1';
				}

				return '';
			});

			const mockGithub = global.createMockGitHubAPI();
			const mockContext = global.createMockGitHubContext();
			const mockCore = global.createMockCore();

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
			expect(mockGithub.rest.issues.createComment).toHaveBeenCalled();

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body.length).toBeGreaterThan(1000);
		});
	});
});
