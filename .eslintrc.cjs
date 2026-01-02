module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'off', // Allow console for CLI tool
    'no-undef': 'off', // TypeScript handles this
    'no-useless-escape': 'off', // We need escaped $ for shell scripts
    'no-unused-vars': 'off', // Use TypeScript version instead
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
