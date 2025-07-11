import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.d.ts', 'eslint.config.js', 'tsup.config.ts', '**/*.test.ts', '**/*.spec.ts', '_docs/**', '.claude/**', 'src/commands/completion.ts'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'no-process-exit': 'off',
    },
  },
  // Prettierとの競合を防ぐルール
  {
    rules: {
      'max-len': 'off',
      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
    },
  },
]