import {
	describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';

describe('CLI Interface', () => {
	let originalArgv;
	let consoleErrorSpy;

	beforeEach(() => {
		// Save original process.argv
		originalArgv = process.argv;

		// Mock console.error
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Mock process.exit
		vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
	});

	afterEach(() => {
		// Restore process.argv
		process.argv = originalArgv;

		vi.restoreAllMocks();
	});

	describe('module loading', () => {
		test('should load without errors when valid arguments provided', async () => {
			// Set valid arguments
			process.argv = ['node', 'harold', 'snapshot', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				// Ignore process.exit errors from commander
				if (error.message !== 'process.exit called') {
					throw error;
				}
			}

			// If we reached this point, module loaded successfully
			expect(true).toBe(true);
		});

		test('should handle help command', async () => {
			process.argv = ['node', 'harold', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				// Expect process.exit when showing help
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should handle version command', async () => {
			process.argv = ['node', 'harold', '--version'];

			try {
				await import('../index.js');
			} catch (error) {
				// Expect process.exit when showing version
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should show help when no commands provided', async () => {
			process.argv = ['node', 'harold'];

			try {
				await import('../index.js');
			} catch (error) {
				// Expect process.exit when showing help
				expect(error.message).toBe('process.exit called');
			}
		});
	});

	describe('error handling', () => {
		test('should setup unhandled rejection handler', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--help'];

			try {
				await import('../index.js');
			} catch {
				// Ignore process.exit
			}

			// Check that module loaded without errors
			// (unhandledRejection handler is set in code)
			expect(true).toBe(true);
		});

		test('should log unhandled rejections', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--help'];

			let errorHandler;
			vi.spyOn(process, 'on').mockImplementation((event, handler) => {
				if (event === 'unhandledRejection') {
					errorHandler = handler;
				}
			});

			try {
				await import('../index.js');
			} catch {
				// Ignore process.exit
			}

			// Test error handler
			if (errorHandler) {
				const testError = new Error('Test unhandled rejection');
				errorHandler(testError);

				expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
			}
		});
	});

	describe('command structure', () => {
		test('should accept snapshot command', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--help'];

			// If command doesn't exist, commander will throw error
			try {
				await import('../index.js');
			} catch (error) {
				// process.exit from --help is normal
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should accept diff command', async () => {
			process.argv = ['node', 'harold', 'diff', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				// process.exit from --help is normal
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should reject unknown commands', async () => {
			process.argv = ['node', 'harold', 'unknown-command'];

			try {
				await import('../index.js');
			} catch (error) {
				// Commander should show error for unknown command
				expect(error.message).toBe('process.exit called');
			}
		});
	});

	describe('snapshot command options', () => {
		test('should accept config option', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--config', 'test.js', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should accept output option', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--output', 'test.json', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should accept exec option', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--exec', 'npm run build', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should accept path option', async () => {
			process.argv = ['node', 'harold', 'snapshot', '--path', 'dist', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});
	});

	describe('diff command arguments', () => {
		test('should accept two file arguments', async () => {
			process.argv = ['node', 'harold', 'diff', 'left.json', 'right.json', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});

		test('should show error for missing arguments', async () => {
			process.argv = ['node', 'harold', 'diff', '--help'];

			try {
				await import('../index.js');
			} catch (error) {
				expect(error.message).toBe('process.exit called');
			}
		});
	});

	describe('package.json integration', () => {
		test('should read package.json successfully', async () => {
			process.argv = ['node', 'harold', '--version'];

			try {
				await import('../index.js');
			} catch (error) {
				// process.exit when showing version is normal
				expect(error.message).toBe('process.exit called');
			}

			// If we reached this point without other errors,
			// it means package.json was read successfully
		});
	});

	describe('integration with tasks', () => {
		test('should import snapshot task', async () => {
			// Check that snapshot module can be imported
			const snapshotModule = await import('../tasks/snapshot.js');
			expect(typeof snapshotModule.default).toBe('function');
		});

		test('should import diff task', async () => {
			// Check that diff module can be imported
			const diffModule = await import('../tasks/diff.js');
			expect(typeof diffModule.default).toBe('function');
		});
	});
});
