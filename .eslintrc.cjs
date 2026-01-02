module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Code quality rules
    complexity: ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 500],
    'max-lines-per-function': ['warn', 50],
    'max-params': ['warn', 4],
    'no-magic-numbers': ['warn', { ignore: [-1, 0, 1, 2] }],
    'no-duplicate-imports': 'error',
    'no-self-compare': 'error',
    'no-template-curly-in-string': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unreachable-loop': 'error',

    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Best practices
    'array-callback-return': 'error',
    'consistent-return': 'error',
    curly: 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    eqeqeq: ['error', 'always'],
    'no-caller': 'error',
    'no-constructor-return': 'error',
    'no-else-return': 'warn',
    'no-empty-function': 'warn',
    'no-eq-null': 'error',
    'no-extra-bind': 'error',
    'no-implicit-coercion': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-multi-spaces': 'error',
    'no-new-wrappers': 'error',
    'no-return-assign': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unneeded-ternary': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-const': 'error',
    'prefer-promise-reject-errors': 'error',
    radix: 'error',
    yoda: 'error',

    // Stylistic rules (handled by Prettier mostly, but some logic-related ones)
    'no-nested-ternary': 'warn',
    'no-underscore-dangle': ['warn', { allowAfterThis: true }],
    'prefer-destructuring': ['warn', { object: true, array: false }],

    // Error handling
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',

    // Overrides for CLI tool context
    'no-console': 'off', // Allow console for CLI tool
    'no-undef': 'off', // TypeScript handles this
    'no-useless-escape': 'off', // We need escaped $ for shell scripts
    'no-unused-vars': 'off', // Use TypeScript version instead

    // Prettier integration
    'prettier/prettier': 'error',
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.d.ts', 'coverage/', 'build/'],
  overrides: [
    {
      // Test files can be more relaxed
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
      },
    },
    {
      // Configuration files
      files: ['**/*.config.{js,ts}', '.eslintrc.cjs'],
      rules: {
        'no-magic-numbers': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
