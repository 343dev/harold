/**
 * Unit тесты для интеграции с GitHub Actions
 */

describe('GitHub Actions Integration', () => {
	describe('Environment variable handling', () => {
		const originalEnvironment = process.env;

		beforeEach(() => {
			jest.resetModules();
			process.env = { ...originalEnvironment };
		});

		afterAll(() => {
			process.env = originalEnvironment;
		});

		test('should read GitHub context from environment', () => {
			process.env.GITHUB_REPOSITORY = 'owner/repo';
			process.env.GITHUB_EVENT_NAME = 'pull_request';
			process.env.GITHUB_REF = 'refs/pull/123/merge';

			const getGitHubContext = () => ({
				repository: process.env.GITHUB_REPOSITORY,
				eventName: process.env.GITHUB_EVENT_NAME,
				ref: process.env.GITHUB_REF,
				isPullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request',
			});

			const context = getGitHubContext();

			expect(context.repository).toBe('owner/repo');
			expect(context.eventName).toBe('pull_request');
			expect(context.isPullRequest).toBe(true);
		});

		test('should handle missing environment variables', () => {
			delete process.env.GITHUB_REPOSITORY;
			delete process.env.GITHUB_EVENT_NAME;

			const getGitHubContext = () => ({
				repository: process.env.GITHUB_REPOSITORY || 'unknown/unknown',
				eventName: process.env.GITHUB_EVENT_NAME || 'unknown',
				isPullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request',
			});

			const context = getGitHubContext();

			expect(context.repository).toBe('unknown/unknown');
			expect(context.eventName).toBe('unknown');
			expect(context.isPullRequest).toBe(false);
		});
	});

	describe('Action inputs processing', () => {
		const processActionInputs = inputs => {
			const processed = {};

			// Обработка github-token
			processed.githubToken = inputs['github-token'] || inputs.githubToken || process.env.GITHUB_TOKEN;

			// Обработка build-command
			processed.buildCommand = inputs['build-command'] || inputs.buildCommand || 'npm run build';

			// Обработка build-path
			processed.buildPath = inputs['build-path'] || inputs.buildPath || 'dist';

			// Обработка булевых значений
			processed.failOnIncrease = (inputs['fail-on-increase'] || inputs.failOnIncrease || 'false') === 'true';

			// Обработка числовых значений
			processed.sizeThreshold = Number.parseInt(inputs['size-threshold'] || inputs.sizeThreshold || '10240', 10);
			processed.percentageThreshold = Number.parseFloat(inputs['percentage-threshold'] || inputs.percentageThreshold || '5');

			return processed;
		};

		test('should process inputs with kebab-case names', () => {
			const inputs = {
				'github-token': 'ghp_test123',
				'build-command': 'yarn build',
				'build-path': 'build',
				'fail-on-increase': 'true',
				'size-threshold': '20480',
				'percentage-threshold': '10',
			};

			const result = processActionInputs(inputs);

			expect(result.githubToken).toBe('ghp_test123');
			expect(result.buildCommand).toBe('yarn build');
			expect(result.buildPath).toBe('build');
			expect(result.failOnIncrease).toBe(true);
			expect(result.sizeThreshold).toBe(20_480);
			expect(result.percentageThreshold).toBe(10);
		});

		test('should use default values when inputs are missing', () => {
			const inputs = {};
			const result = processActionInputs(inputs);

			expect(result.buildCommand).toBe('npm run build');
			expect(result.buildPath).toBe('dist');
			expect(result.failOnIncrease).toBe(false);
			expect(result.sizeThreshold).toBe(10_240);
			expect(result.percentageThreshold).toBe(5);
		});

		test('should handle camelCase input names', () => {
			const inputs = {
				githubToken: 'ghp_test123',
				buildCommand: 'pnpm build',
				failOnIncrease: 'true',
			};

			const result = processActionInputs(inputs);

			expect(result.githubToken).toBe('ghp_test123');
			expect(result.buildCommand).toBe('pnpm build');
			expect(result.failOnIncrease).toBe(true);
		});
	});

	describe('Action outputs', () => {
		const mockCore = {
			setOutput: jest.fn(),
			info: jest.fn(),
			warning: jest.fn(),
			error: jest.fn(),
			setFailed: jest.fn(),
		};

		beforeEach(() => {
			jest.clearAllMocks();
		});

		const setActionOutputs = (results, core = mockCore) => {
			// Основные выходы
			core.setOutput('has-changes', results.hasChanges.toString());
			core.setOutput('size-increase', results.sizeIncrease.toString());
			core.setOutput('percentage-increase', results.percentageIncrease.toString());

			// Статус анализа
			core.setOutput('analysis-status', results.hasErrors ? 'error' : 'success');

			// Дополнительная информация
			if (results.commentCreated) {
				core.setOutput('comment-id', results.commentId.toString());
			}

			// Логирование
			if (results.hasChanges) {
				core.info(`Bundle size changed: +${results.sizeIncrease} bytes (${results.percentageIncrease}%)`);
			} else {
				core.info('No bundle size changes detected');
			}

			if (results.hasErrors) {
				core.error(`Analysis failed: ${results.errorMessage}`);
				core.setFailed(results.errorMessage);
			}
		};

		test('should set outputs for successful analysis with changes', () => {
			const results = {
				hasChanges: true,
				sizeIncrease: 1024,
				percentageIncrease: 5.2,
				hasErrors: false,
				commentCreated: true,
				commentId: 123,
			};

			setActionOutputs(results);

			expect(mockCore.setOutput).toHaveBeenCalledWith('has-changes', 'true');
			expect(mockCore.setOutput).toHaveBeenCalledWith('size-increase', '1024');
			expect(mockCore.setOutput).toHaveBeenCalledWith('percentage-increase', '5.2');
			expect(mockCore.setOutput).toHaveBeenCalledWith('analysis-status', 'success');
			expect(mockCore.setOutput).toHaveBeenCalledWith('comment-id', '123');
			expect(mockCore.info).toHaveBeenCalledWith('Bundle size changed: +1024 bytes (5.2%)');
		});

		test('should set outputs for analysis without changes', () => {
			const results = {
				hasChanges: false,
				sizeIncrease: 0,
				percentageIncrease: 0,
				hasErrors: false,
				commentCreated: true,
				commentId: 124,
			};

			setActionOutputs(results);

			expect(mockCore.setOutput).toHaveBeenCalledWith('has-changes', 'false');
			expect(mockCore.setOutput).toHaveBeenCalledWith('size-increase', '0');
			expect(mockCore.info).toHaveBeenCalledWith('No bundle size changes detected');
		});

		test('should handle analysis errors', () => {
			const results = {
				hasChanges: false,
				sizeIncrease: 0,
				percentageIncrease: 0,
				hasErrors: true,
				errorMessage: 'Harold analysis failed',
				commentCreated: false,
			};

			setActionOutputs(results);

			expect(mockCore.setOutput).toHaveBeenCalledWith('analysis-status', 'error');
			expect(mockCore.error).toHaveBeenCalledWith('Analysis failed: Harold analysis failed');
			expect(mockCore.setFailed).toHaveBeenCalledWith('Harold analysis failed');
		});
	});

	describe('Workflow step conditions', () => {
		const evaluateStepCondition = (condition, context) => {
			// Симуляция условий GitHub Actions
			const conditions = {
				'success()': context.previousStepSuccess,
				'failure()': !context.previousStepSuccess,
				'always()': true,
				'cancelled()': context.cancelled,
				'github.event_name == "pull_request"': context.eventName === 'pull_request',
				'github.event.pull_request.draft == false': !context.isDraft,
				'contains(github.event.head_commit.message, "[skip ci]")':
          context.commitMessage && context.commitMessage.includes('[skip ci]'),
			};

			return conditions[condition] === undefined ? true : conditions[condition];
		};

		test('should evaluate success condition', () => {
			const context = { previousStepSuccess: true };
			expect(evaluateStepCondition('success()', context)).toBe(true);

			const failedContext = { previousStepSuccess: false };
			expect(evaluateStepCondition('success()', failedContext)).toBe(false);
		});

		test('should evaluate failure condition', () => {
			const context = { previousStepSuccess: false };
			expect(evaluateStepCondition('failure()', context)).toBe(true);

			const successContext = { previousStepSuccess: true };
			expect(evaluateStepCondition('failure()', successContext)).toBe(false);
		});

		test('should evaluate event type condition', () => {
			const prContext = { eventName: 'pull_request' };
			expect(evaluateStepCondition('github.event_name == "pull_request"', prContext)).toBe(true);

			const pushContext = { eventName: 'push' };
			expect(evaluateStepCondition('github.event_name == "pull_request"', pushContext)).toBe(false);
		});

		test('should evaluate draft PR condition', () => {
			const draftContext = { isDraft: true };
			expect(evaluateStepCondition('github.event.pull_request.draft == false', draftContext)).toBe(false);

			const readyContext = { isDraft: false };
			expect(evaluateStepCondition('github.event.pull_request.draft == false', readyContext)).toBe(true);
		});

		test('should evaluate commit message condition', () => {
			const skipContext = { commitMessage: 'Fix bug [skip ci]' };
			expect(evaluateStepCondition('contains(github.event.head_commit.message, "[skip ci]")', skipContext)).toBe(true);

			const normalContext = { commitMessage: 'Fix bug' };
			expect(evaluateStepCondition('contains(github.event.head_commit.message, "[skip ci]")', normalContext)).toBe(false);
		});
	});

	describe('Matrix strategy handling', () => {
		const generateMatrixJobs = matrix => {
			const jobs = [];

			if (matrix.os && matrix.node) {
				for (const os of matrix.os) {
					for (const node of matrix.node) {
						jobs.push({
							os,
							node,
							name: `${os}-node${node}`,
						});
					}
				}
			}

			return jobs;
		};

		test('should generate matrix jobs for multiple OS and Node versions', () => {
			const matrix = {
				os: ['ubuntu-latest', 'windows-latest', 'macos-latest'],
				node: ['16', '18', '20'],
			};

			const jobs = generateMatrixJobs(matrix);

			expect(jobs).toHaveLength(9); // 3 OS × 3 Node versions
			expect(jobs[0]).toEqual({
				os: 'ubuntu-latest',
				node: '16',
				name: 'ubuntu-latest-node16',
			});
			expect(jobs[8]).toEqual({
				os: 'macos-latest',
				node: '20',
				name: 'macos-latest-node20',
			});
		});

		test('should handle single values in matrix', () => {
			const matrix = {
				os: ['ubuntu-latest'],
				node: ['18'],
			};

			const jobs = generateMatrixJobs(matrix);

			expect(jobs).toHaveLength(1);
			expect(jobs[0]).toEqual({
				os: 'ubuntu-latest',
				node: '18',
				name: 'ubuntu-latest-node18',
			});
		});

		test('should handle empty matrix', () => {
			const matrix = {};
			const jobs = generateMatrixJobs(matrix);
			expect(jobs).toHaveLength(0);
		});
	});
});
