import eslint from '@eslint/js';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  eslintPluginUnicorn.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      }
    },
    rules: {
      'unicorn/no-array-reduce': 'off',
    },
  },
];
