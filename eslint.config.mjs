import js from '@eslint/js';
import globals from 'globals';

/* Static checking, chosen for what it can actually catch here.

   `tsc --checkJs` was the obvious candidate and was measured first: 161 errors
   across js/, almost all of them the shared `state` object, which is a plain
   literal that the app extends at runtime (`state.dimsFt`, `state['detail_x']`).
   Making those pass means typing the state model, which is a migration rather
   than a check — worth doing, but not something to bolt onto a lint script.

   So this is scoped to rules that find broken code without needing types: a
   name that does not exist, a case that falls through, a condition that cannot
   vary, a promise executor that swallows its own return. Every rule below is
   an error rather than a warning, because a warning nobody has to fix is a
   check nobody runs.

   Deliberately NOT here: formatting and style. Quote marks and semicolons are
   not defects, and a lint run that shouts about them trains people to ignore
   the run that finds a real one. */
export default [
  {
    ignores: [
      // Third-party bundles, minified and not ours to fix.
      'vendor/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      // Has its own toolchain and tsconfig.
      'remotion/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      /* An unused binding is usually a rename that missed a spot or a value
         someone meant to return. Caught args are exempt: `catch(_)` is the
         house idiom for "this failure is deliberately ignored", and it appears
         throughout with a comment saying why. */
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_',
      }],
      /* `catch(_){ /* private mode: session-only *\/ }` is the house idiom for
         a failure that is deliberately survivable, and it appears throughout
         with a comment giving the reason. An empty block anywhere else is
         still an error, because that one is usually an unfinished branch. */
      'no-empty': ['error', { allowEmptyCatch: true }],
      // A promise executor returning a value is a sign an async function was
      // wrapped in `new Promise` by mistake, and the rejection is lost.
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'off',       // sequential writes are deliberate in db.js
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'require-atomic-updates': 'off',  // too noisy on the debounced patch queue
    },
  },
  {
    // Node runs the unit suite and the scripts; both use Node globals.
    files: ['tests/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.mjs', 'playwright.config.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Deno runtime, and the shared modules the Node suite also imports.
    files: ['supabase/functions/**/*.js'],
    languageOptions: { globals: { ...globals.node, Deno: 'readonly' } },
  },
];
