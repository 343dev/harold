import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { createSpinner } from 'nanospinner';
import snapshot from '../../tasks/snapshot.js';
import buildProject from '../../lib/build-project.js';
import checkConfigPath from '../../lib/check-config-path.js';
import findConfig from '../../lib/find-config.js';
import generateSnapshot from '../../lib/generate-snapshot.js';
import writeSnapshotFile from '../../lib/write-snapshot-file.js';
import { createMockSnapshot, createMockConfig } from '../test-utils.js';

// Mock all dependencies
vi.mock('nanospinner');
vi.mock('../../lib/build-project.js');
vi.mock('../../lib/check-config-path.js');
vi.mock('../../lib/find-config.js');
vi.mock('../../lib/generate-snapshot.js');
vi.mock('../../lib/write-snapshot-file.js');

describe('snapshot', () => {
	let mockSpinner;
	let mockBuildProject;
	let mockCheckConfigPath;
	let mockFindConfig;
	let mockGenerateSnapshot;
	let mockWriteSnapshotFile;
	let consoleLogSpy;
	let processHrtimeSpy;

	beforeEach(() => {
		// Mock spinner
		mockSpinner = {
			start: vi.fn(),
			clear: vi.fn(),
			error: vi.fn(),
			success: vi.fn(),
		};
		vi.mocked(createSpinner).mockReturnValue(mockSpinner);

		// Mock modules
		mockBuildProject = vi.mocked(buildProject);
		mockCheckConfigPath = vi.mocked(checkConfigPath);
		mockFindConfig = vi.mocked(findConfig);
		mockGenerateSnapshot = vi.mocked(generateSnapshot);
		mockWriteSnapshotFile = vi.mocked(writeSnapshotFile);

		// Configure default return values
		mockFindConfig.mockReturnValue('/mock/config/.haroldrc.js');
		mockCheckConfigPath.mockReturnValue('/mock/config/custom.js');
		mockGenerateSnapshot.mockReturnValue(createMockSnapshot());
		mockWriteSnapshotFile.mockResolvedValue('snapshot.json has been saved');

		// Mock console.log
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Mock process.hrtime
		processHrtimeSpy = vi.spyOn(process, 'hrtime')
			.mockReturnValueOnce([0, 0]) // buildStartTime
			.mockReturnValueOnce([2, 500_000_000]); // totalTime

		// Mock dynamic configuration import
		vi.doMock('/mock/config/.haroldrc.js', () => ({
			default: createMockConfig(),
		}), { virtual: true });

		vi.doMock('/mock/config/custom.js', () => ({
			default: createMockConfig(),
		}), { virtual: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	describe('successful snapshot creation', () => {
		test('should complete full snapshot workflow', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
				output: 'test-snapshot.json',
			};

			await snapshot(options);

			// Check that all stages are completed
			expect(mockSpinner.start).toHaveBeenCalledTimes(3);
			expect(mockSpinner.start).toHaveBeenNthCalledWith(1, { text: 'Build project' });
			expect(mockSpinner.start).toHaveBeenNthCalledWith(2, { text: 'Generate snapshot' });
			expect(mockSpinner.start).toHaveBeenNthCalledWith(3, { text: 'Save snapshot' });

			expect(mockSpinner.clear).toHaveBeenCalledTimes(3);
			expect(mockSpinner.success).toHaveBeenCalledWith({ text: 'Done!' });

			expect(mockBuildProject).toHaveBeenCalled();
			expect(mockGenerateSnapshot).toHaveBeenCalled();
			expect(mockWriteSnapshotFile).toHaveBeenCalled();
		});

		test('should use custom config when provided', async () => {
			const options = {
				config: '/custom/config.js',
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockCheckConfigPath).toHaveBeenCalledWith('/custom/config.js');
			expect(mockFindConfig).not.toHaveBeenCalled();
		});

		test('should use default config when no custom config provided', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockFindConfig).toHaveBeenCalled();
			expect(mockCheckConfigPath).not.toHaveBeenCalled();
		});

		test('should override config with command line options', async () => {
			const options = {
				exec: 'npm run build:prod',
				path: 'public',
				output: 'custom-snapshot.json',
			};

			await snapshot(options);

			// Check that buildProject is called with overridden command
			expect(mockBuildProject).toHaveBeenCalledWith(
				'npm run build:prod',
				expect.any(Object),
			);

			// Check that generateSnapshot is called with overridden path
			expect(mockGenerateSnapshot).toHaveBeenCalledWith({
				buildDirectory: 'public',
				buildTime: expect.any(Array),
				categories: expect.any(Object),
			});

			// Check that writeSnapshotFile is called with overridden output file
			expect(mockWriteSnapshotFile).toHaveBeenCalledWith({
				buildSnapshot: expect.any(Object),
				outputPath: 'custom-snapshot.json',
			});
		});

		test('should measure build time correctly', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(processHrtimeSpy).toHaveBeenCalledTimes(2);
			expect(mockGenerateSnapshot).toHaveBeenCalledWith({
				buildDirectory: 'dist',
				buildTime: [2, 500_000_000],
				categories: expect.any(Object),
			});
		});

		test('should display progress messages', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(consoleLogSpy).toHaveBeenCalledWith();
			expect(consoleLogSpy).toHaveBeenCalledWith('Taking a snapshot...');
		});
	});

	describe('error handling', () => {
		test('should handle build project errors', async () => {
			const buildError = new Error('Build failed');
			mockBuildProject.mockRejectedValue(buildError);

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await expect(snapshot(options)).rejects.toThrow('Build failed');

			expect(mockSpinner.start).toHaveBeenCalledWith({ text: 'Build project' });
			expect(mockSpinner.error).toHaveBeenCalled();
			expect(mockGenerateSnapshot).not.toHaveBeenCalled();
			expect(mockWriteSnapshotFile).not.toHaveBeenCalled();
		});

		test('should handle generate snapshot errors', async () => {
			const snapshotError = new Error('Snapshot generation failed');
			mockGenerateSnapshot.mockImplementation(() => {
				throw snapshotError;
			});

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await expect(snapshot(options)).rejects.toThrow('Snapshot generation failed');

			expect(mockSpinner.start).toHaveBeenCalledWith({ text: 'Generate snapshot' });
			expect(mockSpinner.error).toHaveBeenCalled();
			expect(mockBuildProject).toHaveBeenCalled();
			expect(mockWriteSnapshotFile).not.toHaveBeenCalled();
		});

		test('should handle write snapshot file errors', async () => {
			const writeError = new Error('Failed to write file');
			mockWriteSnapshotFile.mockRejectedValue(writeError);

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await expect(snapshot(options)).rejects.toThrow('Failed to write file');

			expect(mockSpinner.start).toHaveBeenCalledWith({ text: 'Save snapshot' });
			expect(mockSpinner.error).toHaveBeenCalled();
			expect(mockBuildProject).toHaveBeenCalled();
			expect(mockGenerateSnapshot).toHaveBeenCalled();
		});

		test('should handle config loading errors', async () => {
			// Mock error when finding configuration
			mockFindConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await expect(snapshot(options)).rejects.toThrow();
		});
	});

	describe('configuration handling', () => {
		test('should handle config without build section', async () => {
			vi.doMock('/mock/config/.haroldrc.js', () => ({
				default: { categories: { js: /\.js$/ } },
			}), { virtual: true });

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockBuildProject).toHaveBeenCalledWith(
				'npm run build',
				expect.any(Object),
			);
		});

		test('should handle empty config', async () => {
			vi.doMock('/mock/config/.haroldrc.js', () => ({
				default: {},
			}), { virtual: true });

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockGenerateSnapshot).toHaveBeenCalledWith({
				buildDirectory: 'dist',
				buildTime: expect.any(Array),
				categories: {},
			});
		});
	});

	describe('spinner behavior', () => {
		test('should clear spinner after successful build', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockSpinner.start).toHaveBeenCalledWith({ text: 'Build project' });
			expect(mockSpinner.clear).toHaveBeenCalled();
		});

		test('should show error on spinner when build fails', async () => {
			mockBuildProject.mockRejectedValue(new Error('Build failed'));

			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await expect(snapshot(options)).rejects.toThrow();

			expect(mockSpinner.error).toHaveBeenCalled();
		});

		test('should show success message when all steps complete', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockSpinner.success).toHaveBeenCalledWith({ text: 'Done!' });
		});
	});

	describe('edge cases', () => {
		test('should handle options with undefined values', async () => {
			const options = {
				config: undefined,
				exec: 'npm run build',
				path: 'dist',
				output: undefined,
			};

			await snapshot(options);

			expect(mockFindConfig).toHaveBeenCalled();
		});

		test('should handle options with empty strings', async () => {
			const options = {
				config: '',
				exec: 'npm run build',
				path: 'dist',
				output: '',
			};

			await snapshot(options);

			expect(mockFindConfig).toHaveBeenCalled();
		});

		test('should pass environment variables to build project', async () => {
			const options = {
				exec: 'npm run build',
				path: 'dist',
			};

			await snapshot(options);

			expect(mockBuildProject).toHaveBeenCalledWith(
				'npm run build',
				expect.any(Object),
			);
		});
	});
});
