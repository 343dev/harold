module.exports = {
	extends: '@343dev',
	ignorePatterns: ['coverage/**'],
	overrides: [
		{
			files: ['__tests__/**/*.js'],
			rules: {
				// Allow abbreviated variable names in tests
				'unicorn/prevent-abbreviations': 'off',
				// Allow more nested callbacks in tests
				'max-nested-callbacks': ['warn', 6],
				// Allow await in loops in tests (for resource cleanup)
				'no-await-in-loop': 'off',
			},
		},
	],
};
