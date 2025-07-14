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
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: '.',
      },
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
      // 未使用変数の検出（より厳密に）
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      
      // 型安全性の向上
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn', // 一旦warnに戻す
      // '@typescript-eslint/no-unsafe-assignment': 'warn', // 型情報が必要なので一旦無効化
      // '@typescript-eslint/no-unsafe-member-access': 'warn', // 型情報が必要なので一旦無効化
      // '@typescript-eslint/no-unsafe-call': 'warn', // 型情報が必要なので一旦無効化
      
      // 冗長コードの検出
      'no-useless-return': 'error',
      'no-redundant-type-constituents': 'off',
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'error',
      'no-empty-function': ['error', { allow: ['arrowFunctions', 'constructors'] }],
      'no-lonely-if': 'error',
      'no-useless-rename': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      
      // コード品質
      'no-console': 'off',
      'no-process-exit': 'off',
      'complexity': ['warn', { max: 15 }], // 循環的複雑度
      'max-depth': ['warn', { max: 4 }], // ネストの深さ
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
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