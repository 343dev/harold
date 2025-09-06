/**
 * Integration тесты для различных типов проектов
 * Тестирует Harold Action с React, Vue, Angular и другими проектами
 */

const fs = require('node:fs');

// Мокаем fs модуль
jest.mock('node:fs');

describe('Harold Action Project Types Integration', () => {
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

	describe('React Project Integration', () => {
		test('should handle typical React build output', async () => {
			const reactHaroldOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • react-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • react-app • feature (def5678)

Total: + 3.2 KB (+800 B) (+2.1%)

Files:
 static/js/main.chunk.js        + 2.1 KB (+500 B) (+1.8%)
 static/js/2.chunk.js           + 800 B (+200 B) (+3.2%)
 static/js/runtime-main.js      + 300 B (+100 B) (+1.1%)
 static/css/main.css            + 0 B (+0 B) (+0.0%)

Build time:
 Left: 12.34s
 Right: 12.89s (+0.55s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return reactHaroldOutput;
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

			expect(mockCore.setFailed).not.toHaveBeenCalled();

			const commentCall = mockGithub.rest.issues.createComment.mock.calls[0][0];
			expect(commentCall.body).toContain('static/js/main.chunk.js');
			expect(commentCall.body).toContain('static/js/2.chunk.js');
			expect(commentCall.body).toContain('static/css/main.css');
			expect(commentCall.body).toContain('Build time:');
		});

		test('should handle React code splitting changes', async () => {
			const codeSplittingOutput = `Total: + 5.1 KB (+1.2 KB) (+1.8%)

Files:
+ static/js/3.chunk.js          +4.2 KB (+1.0 KB) (new file)
m static/js/main.chunk.js       -2.1 KB (-500 B) (-1.2%)
m static/js/2.chunk.js          +3.0 KB (+700 B) (+8.9%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return codeSplittingOutput;
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
			expect(commentCall.body).toContain('3.chunk.js');
			expect(commentCall.body).toContain('new file');
			expect(commentCall.body).toContain('-2.1 KB'); // Уменьшение в main.chunk.js
		});
	});

	describe('Vue.js Project Integration', () => {
		test('should handle Vue CLI build output', async () => {
			const vueHaroldOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • vue-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • vue-app • feature (def5678)

Total: + 2.8 KB (+600 B) (+1.9%)

Files:
 js/app.js                      + 1.8 KB (+400 B) (+2.1%)
 js/chunk-vendors.js            + 800 B (+150 B) (+0.8%)
 js/chunk-common.js             + 200 B (+50 B) (+1.2%)
 css/app.css                    + 0 B (+0 B) (+0.0%)

Build time:
 Left: 8.21s
 Right: 8.45s (+0.24s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return vueHaroldOutput;
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
			expect(commentCall.body).toContain('js/app.js');
			expect(commentCall.body).toContain('js/chunk-vendors.js');
			expect(commentCall.body).toContain('css/app.css');
		});

		test('should handle Vite build output', async () => {
			const viteOutput = `Total: + 1.5 KB (+300 B) (+1.2%)

Files:
 assets/index.js                + 1.2 KB (+250 B) (+1.8%)
 assets/index.css               + 300 B (+50 B) (+0.9%)
 assets/vendor.js               + 0 B (+0 B) (+0.0%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return viteOutput;
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
			expect(commentCall.body).toContain('assets/index.js');
			expect(commentCall.body).toContain('assets/index.css');
		});
	});

	describe('Angular Project Integration', () => {
		test('should handle Angular CLI build output', async () => {
			const angularOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • angular-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • angular-app • feature (def5678)

Total: + 4.2 KB (+1.1 KB) (+2.8%)

Files:
 main.js                        + 2.8 KB (+700 B) (+3.1%)
 polyfills.js                   + 800 B (+200 B) (+1.8%)
 runtime.js                     + 400 B (+100 B) (+2.1%)
 vendor.js                      + 200 B (+100 B) (+0.3%)
 styles.css                     + 0 B (+0 B) (+0.0%)

Build time:
 Left: 15.67s
 Right: 16.12s (+0.45s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return angularOutput;
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
			expect(commentCall.body).toContain('main.js');
			expect(commentCall.body).toContain('polyfills.js');
			expect(commentCall.body).toContain('vendor.js');
		});

		test('should handle Angular lazy loading modules', async () => {
			const lazyLoadingOutput = `Total: + 6.8 KB (+1.5 KB) (+3.2%)

Files:
+ lazy-feature-module.js        +5.2 KB (+1.2 KB) (new module)
m main.js                       +1.6 KB (+300 B) (+1.8%)
m vendor.js                     +0 B (+0 B) (+0.0%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return lazyLoadingOutput;
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
			expect(commentCall.body).toContain('lazy-feature-module.js');
			expect(commentCall.body).toContain('new module');
		});
	});

	describe('Next.js Project Integration', () => {
		test('should handle Next.js build output', async () => {
			const nextjsOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • nextjs-app • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • nextjs-app • feature (def5678)

Total: + 3.8 KB (+900 B) (+2.4%)

Files:
 _app.js                        + 1.8 KB (+400 B) (+2.1%)
 index.js                       + 1.2 KB (+300 B) (+1.8%)
 _buildManifest.js              + 500 B (+100 B) (+3.2%)
 chunks/framework.js            + 300 B (+100 B) (+0.8%)

Build time:
 Left: 18.34s
 Right: 19.12s (+0.78s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return nextjsOutput;
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
			expect(commentCall.body).toContain('_app.js');
			expect(commentCall.body).toContain('chunks/framework.js');
		});

		test('should handle Next.js dynamic imports', async () => {
			const dynamicImportsOutput = `Total: + 4.5 KB (+1.0 KB) (+2.1%)

Files:
+ pages/dynamic-page.js         +3.2 KB (+800 B) (new page)
m _app.js                       +800 B (+150 B) (+1.2%)
m chunks/commons.js             +500 B (+50 B) (+0.8%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return dynamicImportsOutput;
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
			expect(commentCall.body).toContain('pages/dynamic-page.js');
			expect(commentCall.body).toContain('new page');
		});
	});

	describe('Vanilla JavaScript Project Integration', () => {
		test('should handle Webpack build output', async () => {
			const webpackOutput = `Total: + 2.1 KB (+500 B) (+1.8%)

Files:
 bundle.js                      + 1.8 KB (+400 B) (+2.1%)
 vendor.bundle.js               + 300 B (+100 B) (+0.9%)
 style.css                      + 0 B (+0 B) (+0.0%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return webpackOutput;
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
			expect(commentCall.body).toContain('bundle.js');
			expect(commentCall.body).toContain('vendor.bundle.js');
		});

		test('should handle Rollup build output', async () => {
			const rollupOutput = `Total: + 1.5 KB (+300 B) (+1.2%)

Files:
 dist/index.js                  + 1.2 KB (+250 B) (+1.8%)
 dist/index.css                 + 300 B (+50 B) (+0.9%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return rollupOutput;
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
			expect(commentCall.body).toContain('dist/index.js');
			expect(commentCall.body).toContain('dist/index.css');
		});
	});

	describe('Monorepo Project Integration', () => {
		test('should handle monorepo with multiple packages', async () => {
			const monorepoOutput = `Snapshots:
 Left: 2/9/2025, 3:45:12 PM • monorepo • main (abc1234)
 Right: 2/9/2025, 3:47:23 PM • monorepo • feature (def5678)

Total: + 8.2 KB (+2.1 KB) (+3.1%)

Files:
 packages/ui/dist/index.js      + 3.2 KB (+800 B) (+2.8%)
 packages/utils/dist/index.js   + 2.1 KB (+600 B) (+1.9%)
 packages/core/dist/index.js    + 1.8 KB (+400 B) (+2.1%)
 packages/theme/dist/index.css  + 1.1 KB (+300 B) (+4.2%)

Build time:
 Left: 25.67s
 Right: 27.12s (+1.45s)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return monorepoOutput;
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
			expect(commentCall.body).toContain('packages/ui/dist/index.js');
			expect(commentCall.body).toContain('packages/utils/dist/index.js');
			expect(commentCall.body).toContain('packages/core/dist/index.js');
			expect(commentCall.body).toContain('packages/theme/dist/index.css');
		});

		test('should handle selective package changes in monorepo', async () => {
			const selectiveChangesOutput = `Total: + 2.8 KB (+600 B) (+1.9%)

Files:
m packages/ui/dist/index.js     + 2.8 KB (+600 B) (+3.1%)
  packages/utils/dist/index.js  + 0 B (+0 B) (+0.0%)
  packages/core/dist/index.js   + 0 B (+0 B) (+0.0%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return selectiveChangesOutput;
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
			expect(commentCall.body).toContain('packages/ui/dist/index.js');
			expect(commentCall.body).toContain('+ 2.8 KB'); // Только UI пакет изменился
		});
	});

	describe('Library Project Integration', () => {
		test('should handle library build with multiple formats', async () => {
			const libraryOutput = `Total: + 1.8 KB (+400 B) (+1.5%)

Files:
 dist/index.umd.js              + 800 B (+200 B) (+1.8%)
 dist/index.esm.js              + 600 B (+150 B) (+1.2%)
 dist/index.cjs.js              + 400 B (+50 B) (+0.9%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return libraryOutput;
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
			expect(commentCall.body).toContain('index.umd.js');
			expect(commentCall.body).toContain('index.esm.js');
			expect(commentCall.body).toContain('index.cjs.js');
		});

		test('should handle TypeScript library build', async () => {
			const typescriptLibraryOutput = `Total: + 2.2 KB (+500 B) (+1.8%)

Files:
 lib/index.js                   + 1.5 KB (+350 B) (+2.1%)
 lib/index.d.ts                 + 400 B (+100 B) (+1.2%)
 lib/utils.js                   + 300 B (+50 B) (+0.8%)`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return typescriptLibraryOutput;
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
			expect(commentCall.body).toContain('lib/index.js');
			expect(commentCall.body).toContain('lib/index.d.ts');
			expect(commentCall.body).toContain('lib/utils.js');
		});
	});

	describe('Error Scenarios by Project Type', () => {
		test('should handle React build failure', async () => {
			const reactBuildError = `Error: Build failed
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! react-app@0.1.0 build: \`react-scripts build\`
npm ERR! Exit status 1

Suggestion: Check your React components for syntax errors`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return reactBuildError;
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
			expect(commentCall.body).toContain('Build failed');
			expect(commentCall.body).toContain('react-scripts build');
			expect(commentCall.body).toContain('Suggestion: Check your React components');
		});

		test('should handle Angular build memory error', async () => {
			const angularMemoryError = `Error: JavaScript heap out of memory
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed

Suggestion: Increase Node.js memory limit with --max-old-space-size=4096`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return angularMemoryError;
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
			expect(commentCall.body).toContain('JavaScript heap out of memory');
			expect(commentCall.body).toContain('--max-old-space-size=4096');
		});
	});

	describe('Performance Optimization Scenarios', () => {
		test('should handle tree-shaking improvements', async () => {
			const treeShakingOutput = `Total: - 5.2 KB (-1.2 KB) (-3.8%)

Files:
m bundle.js                     - 5.2 KB (-1.2 KB) (-4.1%)
  vendor.js                     + 0 B (+0 B) (+0.0%)

Note: Tree-shaking removed unused exports`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return treeShakingOutput;
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
			expect(commentCall.body).toContain('- 5.2 KB'); // Уменьшение размера
			expect(commentCall.body).toContain('Tree-shaking');
		});

		test('should handle code splitting optimization', async () => {
			const codeSplittingOptimization = `Total: + 0.5 KB (+100 B) (+0.2%)

Files:
+ chunks/lazy-component.js      +2.1 KB (+500 B) (new chunk)
m main.js                       -1.6 KB (-400 B) (-1.8%)

Note: Code splitting moved component to separate chunk`;

			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(filename => {
				if (filename === 'harold-output.txt') {
					return codeSplittingOptimization;
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
			expect(commentCall.body).toContain('lazy-component.js');
			expect(commentCall.body).toContain('new chunk');
			expect(commentCall.body).toContain('-1.6 KB'); // Уменьшение main.js
		});
	});
});
