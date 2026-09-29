import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STALE_THRESHOLD_HOURS,
  classifyHeartbeat,
  pickLastCompleted,
  main,
} from '../scripts/check-canary-heartbeat.mjs';

/* These tests match the shape of the ones behind the canary itself: each
   branch of the classifier is checked against a stub, and the end-to-end main
   is exercised with an injected fetch so no real network is touched. */

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 15, 10, 0, 0); // 2026-09-15T10:00:00Z, arbitrary fixed instant

function isoHoursAgo(h) { return new Date(NOW - h * HOUR).toISOString(); }

test('classifyHeartbeat: fresh under the 36h threshold', () => {
  const v = classifyHeartbeat(isoHoursAgo(24), NOW);
  assert.equal(v.kind, 'fresh');
  assert.ok(v.ageHours > 23.9 && v.ageHours < 24.1);
});

test('classifyHeartbeat: fresh right at the threshold minus one second', () => {
  const v = classifyHeartbeat(new Date(NOW - STALE_THRESHOLD_HOURS * HOUR + 1000).toISOString(), NOW);
  assert.equal(v.kind, 'fresh');
});

test('classifyHeartbeat: stale one hour past the threshold', () => {
  const v = classifyHeartbeat(isoHoursAgo(STALE_THRESHOLD_HOURS + 1), NOW);
  assert.equal(v.kind, 'stale');
  assert.equal(v.at, isoHoursAgo(STALE_THRESHOLD_HOURS + 1));
});

test('classifyHeartbeat: 36h clears the worst observed jitter without false-alarming', () => {
  /* Firings landed between 44m and 11h 21m late. Worst-case gap between two
     consecutive completions on a 24h schedule is 24 + 11h 21m ≈ 35.35h. The
     threshold must be strictly greater than that or a run that arrived late
     but did arrive would trip the alert on its own follower. */
  const worstNormalGapHours = 24 + 11 + 21 / 60;
  assert.ok(STALE_THRESHOLD_HOURS > worstNormalGapHours,
    `threshold ${STALE_THRESHOLD_HOURS}h must exceed worst normal gap ${worstNormalGapHours}h`);
  const v = classifyHeartbeat(isoHoursAgo(worstNormalGapHours), NOW);
  assert.equal(v.kind, 'fresh');
});

test('classifyHeartbeat: null updated_at is bootstrap, not stale', () => {
  assert.equal(classifyHeartbeat(null, NOW).kind, 'bootstrap');
  assert.equal(classifyHeartbeat(undefined, NOW).kind, 'bootstrap');
});

test('classifyHeartbeat: malformed timestamp is its own class, not silently fresh', () => {
  const v = classifyHeartbeat('not a date', NOW);
  assert.equal(v.kind, 'malformed');
  assert.equal(v.raw, 'not a date');
});

test('pickLastCompleted: takes the newest successful run and skips the current one', () => {
  const runs = [
    { id: 'CURRENT', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(0.1) },
    { id: 'B', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(24) },
    { id: 'C', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(48) },
  ];
  const r = pickLastCompleted(runs, 'CURRENT');
  assert.equal(r.id, 'B');
});

test('pickLastCompleted: a failed run counts, because it proves the schedule fired', () => {
  const runs = [
    { id: 'A', status: 'completed', conclusion: 'failure', updated_at: isoHoursAgo(1) },
    { id: 'B', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(25) },
  ];
  assert.equal(pickLastCompleted(runs, null)?.id, 'A');
});

test('pickLastCompleted: skips runs that have not completed', () => {
  const runs = [
    { id: 'A', status: 'in_progress', conclusion: null, updated_at: isoHoursAgo(1) },
    { id: 'B', status: 'completed', conclusion: 'failure', updated_at: isoHoursAgo(24) },
  ];
  assert.equal(pickLastCompleted(runs, null)?.id, 'B');
});

test('pickLastCompleted: an empty or missing array is null (bootstrap)', () => {
  assert.equal(pickLastCompleted([], 'X'), null);
  assert.equal(pickLastCompleted(null, 'X'), null);
});

test('pickLastCompleted: compares run ids as strings so numeric ids match', () => {
  const runs = [{ id: 12345, status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(2) }];
  assert.equal(pickLastCompleted(runs, '12345'), null);
  assert.equal(pickLastCompleted(runs, 12345), null);
});

function stubEnv() {
  return { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: 'CURRENT' };
}
function stubFetch(response) {
  return async () => response;
}
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}
function textResponse(text, status = 500) {
  return {
    ok: false,
    status,
    async json() { throw new Error('not json'); },
    async text() { return text; },
  };
}

async function runMain(opts) {
  const originalExit = process.exit;
  const originalErr = console.error;
  const originalLog = console.log;
  const exits = [];
  const errs = [];
  const logs = [];
  process.exit = (code) => { exits.push(code); throw new Error('__EXIT__'); };
  console.error = (...args) => { errs.push(args.join(' ')); };
  console.log = (...args) => { logs.push(args.join(' ')); };
  try {
    await main(opts);
  } catch (e) {
    if (e.message !== '__EXIT__') throw e;
  } finally {
    process.exit = originalExit;
    console.error = originalErr;
    console.log = originalLog;
  }
  return { exits, errs: errs.join('\n'), logs: logs.join('\n') };
}

test('main: a fresh last run exits 0 and logs the age', async () => {
  const runs = [{ id: 'B', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(24), run_number: 7 }];
  const { exits, logs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: runs })),
  });
  assert.deepEqual(exits, []);
  assert.match(logs, /OK — last completed run/);
});

test('main: a stale last run exits 1 under HEARTBEAT LOST', async () => {
  const runs = [{ id: 'B', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(48), run_number: 3 }];
  const { exits, errs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: runs })),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /CANARY HEARTBEAT LOST/);
});

test('main: an empty runs list exits 0 as bootstrap, not stale', async () => {
  const { exits, logs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: [] })),
  });
  assert.deepEqual(exits, []);
  assert.match(logs, /bootstrap/);
});

test('main: an API error exits 1 under HEARTBEAT CHECK COULD NOT RUN', async () => {
  const { exits, errs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(textResponse('rate limited', 403)),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /HEARTBEAT CHECK COULD NOT RUN/);
  assert.doesNotMatch(errs, /HEARTBEAT LOST/);
});

test('main: a malformed API response exits 1 as could-not-check, not as fresh', async () => {
  const { exits, errs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ nope: 'wrong shape' })),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /HEARTBEAT CHECK COULD NOT RUN/);
});

test('main: a missing token exits 1 as could-not-check', async () => {
  const { exits, errs } = await runMain({
    env: { GITHUB_REPOSITORY: 'o/r' },
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: [] })),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /no GITHUB_TOKEN or GH_TOKEN/);
});

test('main: a missing repo exits 1 as could-not-check', async () => {
  const { exits, errs } = await runMain({
    env: { GH_TOKEN: 't' },
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: [] })),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /GITHUB_REPOSITORY/);
});

test('main: a model-path outage is not reported as a skipped schedule', async () => {
  /* Runs #31 to #40 (2026-09-19 to 09-28): every day fired, every day failed
     on an invalid API key. Counting only successes made day 3 onward also
     say HEARTBEAT LOST and blame the schedule. */
  const runs = [
    { id: 'D1', status: 'completed', conclusion: 'failure', updated_at: isoHoursAgo(24) },
    { id: 'D2', status: 'completed', conclusion: 'failure', updated_at: isoHoursAgo(48) },
    { id: 'D3', status: 'completed', conclusion: 'failure', updated_at: isoHoursAgo(72) },
    { id: 'OK', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(242) },
  ];
  let requested = '';
  const { exits, errs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: async (url) => { requested = url; return jsonResponse({ workflow_runs: runs }); },
  });
  assert.deepEqual(exits, []);
  assert.doesNotMatch(errs, /HEARTBEAT LOST/);
  assert.match(requested, /status=completed/);
});

test('main: the current run itself is never treated as its own predecessor', async () => {
  /* A stale actual-previous run must still trip the alert even when the
     current run is somehow returned first by the API. */
  const runs = [
    { id: 'CURRENT', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(0.1) },
    { id: 'PREV', status: 'completed', conclusion: 'success', updated_at: isoHoursAgo(60) },
  ];
  const { exits, errs } = await runMain({
    env: stubEnv(),
    now: NOW,
    fetchImpl: stubFetch(jsonResponse({ workflow_runs: runs })),
  });
  assert.deepEqual(exits, [1]);
  assert.match(errs, /HEARTBEAT LOST/);
});

test('workflow: model-path-canary.yml grants actions:read and runs the heartbeat step', () => {
  const src = readFileSync(new URL('../.github/workflows/model-path-canary.yml', import.meta.url), 'utf8');
  assert.match(src, /^permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read\s*$/m,
    'model-path-canary.yml does not grant actions: read alongside contents: read');
  assert.match(src, /node scripts\/check-canary-heartbeat\.mjs/,
    'model-path-canary.yml does not run the heartbeat script');
  assert.match(src, /if:\s*always\(\)/,
    'the heartbeat step should run even if the canary itself failed');
});
