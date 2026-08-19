import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_NAMES, sanitizeEvent, sanitizeBatch } from '../supabase/functions/_shared/telemetryEvents.js';

// The telemetry contract is privacy-by-construction: a fixed name allowlist
// and flat primitive props make photos, free text blobs, and structured
// personal data unrepresentable. These tests pin that boundary — the same
// sanitizer runs client-side (courtesy) and in the edge function (boundary).

test('allowlist covers exactly the product events', () => {
  assert.deepEqual([...EVENT_NAMES].sort(), [
    'after_render_requested', 'feedback_submitted', 'plan_created',
    'plan_rated', 'product_clicked', 'screen_viewed', 'share_link_created',
    'shared_plan_viewed', 'space_saved', 'step_checked',
  ]);
});

test('unknown event names are dropped entirely', () => {
  assert.equal(sanitizeEvent({ name: 'password_typed', props: {} }), null);
  assert.equal(sanitizeEvent({ name: '', props: {} }), null);
  assert.equal(sanitizeEvent(null), null);
});

test('props are flattened to primitives; nested data cannot ride along', () => {
  const ev = sanitizeEvent({
    name: 'plan_created',
    props: {
      space: 'pantry',
      steps: 9,
      ok: true,
      household: { kids: { present: 'yes' } },   // object: dropped
      photos: ['base64...'],                     // array: dropped
      note: null,                                // null: dropped
    },
  });
  assert.deepEqual(ev, { name: 'plan_created', props: { space: 'pantry', steps: 9, ok: true } });
});

test('long strings are truncated and oversized events dropped', () => {
  const ev = sanitizeEvent({ name: 'screen_viewed', props: { screen: 'x'.repeat(500) } });
  assert.equal(ev.props.screen.length, 80);
  // many long-ish props → serialized size cap kicks in
  const props = {};
  for (let i = 0; i < 30; i++) props['k' + i] = 'y'.repeat(79);
  assert.equal(sanitizeEvent({ name: 'screen_viewed', props }), null);
});

test('prop keys are validated; weird keys are dropped', () => {
  const ev = sanitizeEvent({ name: 'screen_viewed', props: { 'ok_key': 1, '"; drop table': 2, '': 3 } });
  assert.deepEqual(ev.props, { ok_key: 1 });
});

test('batches are capped at 25 and cleaned element-wise', () => {
  const batch = Array.from({ length: 40 }, (_, i) => ({ name: i % 2 ? 'screen_viewed' : 'nope', props: { i } }));
  const out = sanitizeBatch(batch);
  assert.ok(out.length <= 25);
  assert.ok(out.every((e) => e.name === 'screen_viewed'));
  assert.equal(sanitizeBatch('junk').length, 0);
});

/* ---------- telemetry never leaves a Node process ----------

   The privacy posture above is enforced at the boundary. This is the other
   half: the client must not send *at all* unless a real person is looking at
   a real page.

   It failed silently for a day. `optedOut()` disabled itself under automation
   by reading `navigator.webdriver`, which covers Playwright but not Node —
   Node has had a global `navigator` since v21, without `webdriver` on it. So
   `node --test` looked like a consenting browser: every unit-test run that
   drove a successful insert through js/db.js posted two real `space_saved`
   events to production, each with a null anon_id because a Node process has
   no localStorage. Sixty-six landed in `telemetry_events` — outnumbering the
   real rows, and unjoinable to the funnel by the one column it is read by.

   Nothing about that was visible from a passing test run, which is why the
   assertion here is about the socket rather than about the flag. */

test('telemetry is off in a process with no document, and says why', async () => {
  const { telemetryEnabled, telemetryStatus } = await import('../js/telemetry.js');
  assert.equal(typeof document, 'undefined', 'precondition: node has no DOM');
  assert.equal(telemetryEnabled(), false);
  assert.match(telemetryStatus(), /^off: no document/);
});

test('driving a real save from Node opens no socket', async () => {
  const { state, resetPlanRecord } = await import('../js/state.js');
  const { snapshotSave, persistSpace } = await import('../js/db.js');

  /* Spy rather than stub the network: a stub that answers 200 would let this
     pass while the request still left the machine. The only acceptable count
     is zero. */
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { sent.push(String(url)); return new Response('{}', { status: 200 }); };

  try {
    resetPlanRecord(state);
    state.space = 'pantry';
    const client = {
      from: (table) => {
        if (table === 'spaces') return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }),
        };
        if (table === 'space_media') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
        throw new Error('unexpected table ' + table);
      },
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    };

    /* This is the exact path that leaked: a successful insert is the one
       outcome js/db.js reports with track(). */
    const id = await persistSpace(client, 'user-1', snapshotSave('Pantry', { media: false }));
    assert.equal(id, 'row-1', 'precondition: the insert branch actually ran');

    /* track() batches on a 4s timer, so a leak would not have shown up by
       now anyway — force the flush and prove the queue was never filled. */
    const { flush } = await import('../js/telemetry.js');
    flush();
    await new Promise((r) => setTimeout(r, 20));

    assert.deepEqual(sent, [], `telemetry left the process: ${sent.join(', ')}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});
