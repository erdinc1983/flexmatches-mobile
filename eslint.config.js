// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**', '.expo/**', 'node_modules/**'],
    rules: {
      // React Native <Text> doesn't have HTML escaping concerns — apostrophes
      // and quotes render fine. The rule is designed for browser JSX.
      'react/no-unescaped-entities': 'off',
      // Allow underscore-prefixed identifiers to remain unused (conventional
      // way to mark "intentionally unused"). Don't warn on function args at all.
      '@typescript-eslint/no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
]);
