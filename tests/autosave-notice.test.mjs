import test from 'node:test';
import assert from 'node:assert/strict';

/* A signed-in plan is written to "My spaces" the moment it is built, and
   every later change is patched onto the row. Both failed in silence: an
   expired sign-in (PostgREST answers a stale JWT with 401, PGRST301) left the
   row untouched and the screen looking saved, and the patch retried every
   four seconds against it forever. Now the expiry is recognised, said once,
   and not retried. */

/* toast() writes to #toast; a stub records what it said. */
const shown = [];
globalThis.document = {
  getElementById: () => ({
    set textContent(v) { if (v) shown.push(v); },
    classList: { add() {}, remove() {} },
  }),
  addEventListener() {},
  visibilityState: 'visible',
};
globalThis.addEventListener = () => {};

const db = await import('../js/db.js');

test('an expired sign-in is told apart from a server that is down', () => {
  assert.equal(db.sessionExpired({ code: 'PGRST301', message: 'JWT expired' }), true);
  assert.equal(db.sessionExpired({ status: 401, message: 'Unauthorized' }), true);
  assert.equal(db.sessionExpired(Object.assign(new Error('Saving failed. Please try again.'), { cause: { code: 'PGRST301' } })), true, 'the cause is not read');
  assert.equal(db.sessionExpired({ code: 'PGRST116', message: 'The result contains 0 rows' }), false);
  assert.equal(db.sessionExpired(new Error('Failed to fetch')), false);
});

test('a patch refused for an expired sign-in is kept, said once, and not retried', async () => {
  shown.length = 0;
  const attempts = [];
  const expired = { from: () => ({ update: (body) => ({ eq: async () => { attempts.push(body); return { error: { code: 'PGRST301', message: 'JWT expired' } }; } }) }) };
  await db.writePatch(expired, 'space-a', { progress: { stepsDone: [true] } });
  await db.writePatch(expired, 'space-a', { shopping: ['a'] });
  assert.equal(attempts.length, 2, 'each call makes one attempt');
  assert.deepEqual(shown, ['Your sign-in has expired, so this plan is not being saved to My spaces. Sign in again to keep it.'],
    'the expiry is said once, not once per write');
  // Nothing retries on its own against the dead session.
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(attempts.length, 2, 'a retry timer fired against the dead session');
  // The keys wait for the next flush after a sign-in rather than being dropped.
  const pending = db.takePendingPatch();
  assert.equal(pending.targetId, 'space-a');
  assert.deepEqual(pending.patch, { progress: { stepsDone: [true] }, shopping: ['a'] });
});

test('any other failed patch keeps the retry it had and says nothing', async () => {
  shown.length = 0;
  const down = { from: () => ({ update: () => ({ eq: async () => ({ error: { message: 'fetch failed' } }) }) }) };
  await db.writePatch(down, 'space-b', { shopping: ['b'] });
  assert.deepEqual(shown, []);
  const pending = db.takePendingPatch();
  assert.deepEqual(pending, { patch: { shopping: ['b'] }, targetId: 'space-b' });
});
