import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
    rules: {
      'no-unused-vars': 'error',
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['quality/tests/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.jest } }
  }
];
