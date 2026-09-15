import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* GITHUB_TOKEN defaults to read/write on many repos unless the workflow says
   otherwise. None of these three jobs writes through it — they checkout,
   install, and either test or deploy to Supabase with its own access token —
   so each should declare the read-only default explicitly rather than rely
   on whatever the repo's own token settings happen to be. pages.yml already
   does this (it needs `pages: write` and `id-token: write` for the Pages
   deploy), so it is not re-asserted here. */
const WORKFLOWS = ['test', 'supabase-functions', 'model-path-canary'];

test('CI workflows that never write through GITHUB_TOKEN declare read-only permissions', () => {
  for (const name of WORKFLOWS) {
    const src = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(src, /^permissions:\n\s*contents:\s*read\s*$/m,
      `${name}.yml does not declare contents: read`);
  }
});
