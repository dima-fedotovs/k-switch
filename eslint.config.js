import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  {
    ignores: ['node_modules/**', '.venv/**', '.build/**', 'dist/**', 'artifacts/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-warning-comments': 'error' },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: ['**/*.ts'] })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'no-warning-comments': 'error',
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSAnyKeyword', message: 'Use a precise type or validate unknown input.' },
        {
          selector: 'TSNonNullExpression',
          message: 'Narrow the value instead of asserting it exists.',
        },
      ],
    },
  },
  {
    files: [
      'src/prefs.ts',
      'src/prefs/**/*.ts',
      'test/prefs-smoke.ts',
      'test/localized-prefs.ts',
      'test/session-guard-smoke.ts',
      'test/transfer-smoke.ts',
    ],
    rules: {
      // GNOME Shell 50 still supplies this host window in fillPreferencesWindow().
      '@typescript-eslint/no-deprecated': [
        'error',
        {
          allow: [
            {
              from: 'package',
              package: '@girs/adw-1',
              name: ['PreferencesWindow', 'add_toast', 'add', 'remove'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'gi://*',
            'resource://*',
            'node:*',
            'gettext',
            '../shared/*',
            '../runtime/*',
            '../prefs/*',
          ],
        },
      ],
    },
  },
  {
    files: ['src/runtime/**/*.ts', 'src/extension.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['gi://Gtk*', 'gi://Adw*', '../prefs/*'] }],
    },
  },
  {
    files: ['src/prefs.ts', 'src/prefs/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['gi://Shell*', 'gi://Meta*', 'gi://St*', 'gi://Clutter*', '../runtime/*'] },
      ],
    },
  },
  {
    files: ['src/shared/i18n.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['gi://*', 'resource://*', '../prefs/*', '../runtime/*'] },
      ],
    },
  },
  prettier,
);
