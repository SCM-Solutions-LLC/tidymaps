import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The AI analysis ran two unbounded model calls inside a function Supabase
   kills at its wall-clock limit. In production that showed up as a 546 after
   150.2 seconds: no response body, no error the client could report, and a
   silent fall back to the deterministic plan after a two-and-a-half-minute
   wait. Nothing about it looked like a failure from the outside, which is why
   it survived so long. These pin the parts that made it survivable. */

const fn = readFileSync(new URL('../supabase/functions/analyze-space/index.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('../js/api.js', import.meta.url), 'utf8');

function constant(name) {
  const match = fn.match(new RegExp(`const ${name} = ([0-9_]+)`));
  assert.ok(match, `${name} must be declared in analyze-space`);
  return Number(match[1].replace(/_/g, ''));
}

test('the whole handler is budgeted below the platform wall clock', () => {
  const budget = constant('TOTAL_BUDGET_MS');
  assert.ok(budget < 150_000, `budget ${budget}ms must leave room under the 150s limit`);
  assert.ok(budget > 60_000, `budget ${budget}ms is too tight for a vision analysis`);
  // Measured from the first line of the handler, not from the model call, so
  // rate limiting and image validation count against it too.
  assert.match(fn, /const startedAt = Date\.now\(\);/);
  assert.match(fn, /const remainingMs = \(\) => TOTAL_BUDGET_MS - elapsedMs\(\)/);
});

test('each model call is bounded by whatever budget is left', () => {
  assert.match(fn, /signal: AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(fn, /callModelOnce\(messages, budgetMs\)/);
  assert.doesNotMatch(fn, /callModelOnce\(messages\)/, 'no unbounded call may remain');
});

test('a retry only runs when there is time for one', () => {
  assert.match(fn, /attempt === MAX_ATTEMPTS - 1 \|\| remainingMs\(\) < MIN_RETRY_MS/);
  const retryFloor = constant('MIN_RETRY_MS');
  const budget = constant('TOTAL_BUDGET_MS');
  assert.ok(retryFloor > 0 && retryFloor < budget, 'the retry floor must fit inside the budget');
});

test('running out of time answers, rather than letting the worker be killed', () => {
  assert.match(fn, /error: 'analysis_timeout'/);
  assert.match(fn, /error: 'upstream_timeout'/);
  assert.match(fn, /504/);
});

test('effort and thinking are set explicitly, not left to the model default', () => {
  // Sonnet 4.6 defaults to `high` effort; that default was doing the analysis
  // no favours and cost most of the wall clock.
  assert.match(fn, /const EFFORT = '(low|medium|high)'/);
  assert.match(fn, /output_config: \{ effort: EFFORT \}/);
  assert.match(fn, /thinking: \{ type: 'disabled' \}/);
});

test('a model that rejects the tuning degrades to slow, not to broken', () => {
  // Nothing in CI can send a real request, so the tuning ships unverified.
  assert.match(fn, /let tuningRejected = false;/);
  assert.match(fn, /res\.status === 400 && \/output_config\|effort\|thinking\|cache_control\//);
  assert.match(fn, /tuningRejected\s*\n?\s*\? \{ model: MODEL, max_tokens: 8192, messages: untuned\(messages\) \}/);
});

test('the retry reads the photos from cache instead of re-processing them', () => {
  // A retry re-sends every image; at ~100s of total budget that is most of
  // what deciding to retry costs.
  assert.match(fn, /cache_control: \{ type: 'ephemeral' \}/);
  // The breakpoint belongs on the last block of the first user turn, so the
  // cached prefix is every photo plus the prompt. Sitting on an image instead
  // would leave the prompt text out of the cached prefix.
  const turn = fn.slice(fn.indexOf('const content: unknown[]'), fn.indexOf('const requestId'));
  assert.ok(
    turn.lastIndexOf('cache_control') > turn.lastIndexOf('type: \'image\''),
    'the cache breakpoint must come after the image blocks',
  );
});

test('the untuned fallback drops cache_control too', () => {
  // cache_control rides inside the messages, not alongside them: a fallback
  // that rebuilt only the top level would re-send whatever just 400'd.
  assert.match(fn, /function untuned\(/);
  assert.match(fn, /cache_control: _drop, \.\.\.block/);
});

test('the client gives up before waiting forever, and says why', () => {
  // The deadline is composed with the caller's optional cancel signal now, but
  // it is still unconditional: requestSignal() returns the timeout alone when
  // no signal is passed, and combines rather than replaces when one is.
  assert.match(api, /AbortSignal\.timeout\(TIMEOUT_MS\[name\] \|\| DEFAULT_TIMEOUT_MS\)/);
  assert.match(api, /if\(!signal\) return deadline;/);
  assert.match(api, /AbortSignal\.any\(\[deadline, signal\]\)/);
  assert.match(api, /signal: requestSignal\(name, signal\)/);
  const clientBudget = Number(api.match(/'analyze-space': (\d+)/)[1]);
  assert.ok(
    clientBudget > constant('TOTAL_BUDGET_MS'),
    'the client must outlast the function it is calling, so the server\'s own error is what the user sees',
  );
  assert.match(api, /code:'timeout'/);
  assert.match(api, /res\.status === 504/);
});
