import config from '@343dev/eslint-config';

export default [
	...config,

	{
		ignores: ['.haroldrc.js'],
	},

	{
		rules: {
			'@stylistic/indent-binary-ops': 'off',
		},
	},
];
