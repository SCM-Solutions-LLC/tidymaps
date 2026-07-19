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
    'product_clicked', 'screen_viewed', 'share_link_created',
    'shared_plan_viewed', 'step_checked',
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
