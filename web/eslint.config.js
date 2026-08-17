module.exports = [
  // Minimal permissive flat config so the ESLint CLI can run in this environment.
  {
    ignores: ["node_modules"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json']
      }
    },
    rules: {}
  }
];
