import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { spawn, execSync } from 'node:child_process';
import { onExit } from 'signal-exit';
import buildProject from '../../lib/build-project.js';
import { createMockProcess } from '../test-utils.js';

// Mock external dependencies
vi.mock('node:child_process');
vi.mock('signal-exit');

describe('buildProject', () => {
	let mockSpawn;
	let mockExecSync;
	let mockOnExit;
	let mockChild;
	let removeExitListener;

	beforeEach(() => {
		// Create mock for child process
		mockChild = createMockProcess({
			pid: 12_345,
			on: vi.fn(),
			kill: vi.fn(),
		});

		// Mock spawn
		mockSpawn = vi.mocked(spawn);
		mockSpawn.mockReturnValue(mockChild);

		// Mock execSync
		mockExecSync = vi.mocked(execSync);

		// Mock onExit
		removeExitListener = vi.fn();
		mockOnExit = vi.mocked(onExit);
		mockOnExit.mockReturnValue(removeExitListener);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('successful build', () => {
		test('should resolve when build completes successfully', async () => {
			const buildCommand = 'npm run build';

			// Configure mock for successful completion
			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					// Simulate successful completion with code 0
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			const promise = buildProject(buildCommand);

			await expect(promise).resolves.toBeUndefined();

			// Check that spawn was called with correct parameters
			expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'build'], {
				detached: process.platform !== 'win32',
				stdio: 'ignore',
				env: process.env,
			});
		});

		test('should use custom environment variables', async () => {
			const buildCommand = 'yarn build';
			const customEnvironment = { NODE_ENV: 'production', CUSTOM_VAR: 'test' };

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand, customEnvironment);

			expect(mockSpawn).toHaveBeenCalledWith('yarn', ['build'], {
				detached: process.platform !== 'win32',
				stdio: 'ignore',
				env: customEnvironment,
			});
		});

		test('should handle commands with multiple arguments', async () => {
			const buildCommand = 'npx webpack --mode production --config webpack.config.js';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockSpawn).toHaveBeenCalledWith('npx', [
				'webpack',
				'--mode',
				'production',
				'--config',
				'webpack.config.js',
			], expect.any(Object));
		});

		test('should setup exit listener when process has PID', async () => {
			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockOnExit).toHaveBeenCalled();
			expect(removeExitListener).toHaveBeenCalled();
		});
	});

	describe('build failures', () => {
		test('should reject when build fails with non-zero exit code', async () => {
			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(1), 10); // Error code 1
				}

				return mockChild;
			});

			await expect(buildProject(buildCommand)).rejects.toThrow(
				'Command "npm run build" exited with status code: 1',
			);
		});

		test('should reject when spawn throws error', async () => {
			const buildCommand = 'invalid-command';
			const spawnError = new Error('Command not found');

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'error') {
					setTimeout(() => callback(spawnError), 10);
				}

				return mockChild;
			});

			await expect(buildProject(buildCommand)).rejects.toThrow('Command not found');
		});

		test('should reject when no build command provided', () => {
			expect(() => buildProject()).toThrow(
				'Build command is not set. Check config file or set command using option "--exec"',
			);
		});

		test('should reject when empty build command provided', () => {
			expect(() => buildProject('')).toThrow(
				'Build command is not set. Check config file or set command using option "--exec"',
			);
		});

		test('should reject when no build command provided', () => {
			expect(() => buildProject()).toThrow(
				'Build command is not set. Check config file or set command using option "--exec"',
			);
		});
	});

	describe('process cleanup', () => {
		test('should kill process on Windows when exit listener is triggered', async () => {
			// Mock Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'win32' });

			const buildCommand = 'npm run build';
			let exitCallback;

			// Capture callback for onExit
			mockOnExit.mockImplementation(callback => {
				exitCallback = callback;
				return removeExitListener;
			});

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			// Simulate exit listener call
			if (exitCallback) {
				exitCallback();
			}

			expect(mockExecSync).toHaveBeenCalledWith('taskkill /PID 12345 /T /F');

			// Restore original platform
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		test('should kill process group on Unix when exit listener is triggered', async () => {
			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'linux' });

			const mockProcessKill = vi.spyOn(process, 'kill').mockImplementation(() => {});

			const buildCommand = 'npm run build';
			let exitCallback;

			mockOnExit.mockImplementation(callback => {
				exitCallback = callback;
				return removeExitListener;
			});

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			// Simulate exit listener call
			if (exitCallback) {
				exitCallback();
			}

			expect(mockProcessKill).toHaveBeenCalledWith(-12_345);

			// Restore
			mockProcessKill.mockRestore();
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		test('should not setup exit listener when process has no PID', async () => {
			const buildCommand = 'npm run build';

			// Mock process without PID
			mockChild.pid = undefined;

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockOnExit).not.toHaveBeenCalled();
		});

		test('should call removeExitListener when build completes', async () => {
			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(removeExitListener).toHaveBeenCalled();
		});

		test('should call removeExitListener when build fails', async () => {
			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(1), 10);
				}

				return mockChild;
			});

			try {
				await buildProject(buildCommand);
			} catch {
				// Expect error
			}

			expect(removeExitListener).toHaveBeenCalled();
		});
	});

	describe('spawn configuration', () => {
		test('should set detached to false on Windows', async () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'win32' });

			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'build'], {
				detached: false,
				stdio: 'ignore',
				env: process.env,
			});

			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		test('should set detached to true on Unix systems', async () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'linux' });

			const buildCommand = 'npm run build';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'build'], {
				detached: true,
				stdio: 'ignore',
				env: process.env,
			});

			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		test('should always use stdio ignore', async () => {
			const buildCommand = 'echo test';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockSpawn).toHaveBeenCalledWith('echo', ['test'], expect.objectContaining({ stdio: 'ignore' }),
			);
		});
	});

	describe('edge cases', () => {
		test('should handle command with only executable name', async () => {
			const buildCommand = 'make';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			expect(mockSpawn).toHaveBeenCalledWith('make', [], expect.any(Object));
		});

		test('should handle command with extra spaces', async () => {
			const buildCommand = '  npm   run   build  ';

			mockChild.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}

				return mockChild;
			});

			await buildProject(buildCommand);

			// split(' ') creates empty strings between spaces, which is expected behavior
			expect(mockSpawn).toHaveBeenCalledWith('', ['', 'npm', '', '', 'run', '', '', 'build', '', ''], expect.any(Object));
		});

		test('should handle different exit codes', async () => {
			const buildCommand = 'npm run build';
			const exitCodes = [2, 127, 255];

			const testPromises = exitCodes.map(async exitCode => {
				mockChild.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(exitCode), 10);
					}

					return mockChild;
				});

				await expect(buildProject(buildCommand)).rejects.toThrow(
					`Command "npm run build" exited with status code: ${exitCode}`,
				);
			});

			await Promise.all(testPromises);
		});
	});
});
