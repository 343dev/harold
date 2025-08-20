// eslint-disable-next-line import/no-unresolved
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Test execution environment
		environment: 'node',

		// Global settings
		globals: true,

		// Patterns for finding test files
		include: ['**/__tests__/**/*.test.js', '**/*.test.js'],

		// Exclusions
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/.git/**',
		],

		// Code coverage settings
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'__tests__/',
				'*.config.js',
				'.haroldrc.js',
				'.eslintrc.cjs',
				'coverage/',
				'dist/',
			],
			thresholds: {
				global: {
					branches: 95,
					functions: 100,
					lines: 99,
					statements: 99,
				},
			},
		},

		// Timeouts
		testTimeout: 10_000,
		hookTimeout: 10_000,

		// Settings for working with temporary files
		setupFiles: [],

		// Clear mocks after each test
		clearMocks: true,
		restoreMocks: true,

		// ES modules support
		pool: 'forks',
	},
});
