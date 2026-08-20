import test from 'node:test';
import assert from 'node:assert/strict';
import { refundUsage } from '../supabase/functions/_shared/usageRefund.js';

/* A stand-in for the PostgREST builder: every filter returns `this` and records
   itself, and awaiting the chain resolves whatever the test configured. The
   point is to assert on the SHAPE of the query — which column the row is scoped
   by — because that is where this can silently do nothing. An anonymous refund
   that forgets `user_id is null` matches no row and quietly refunds nothing,
   and a test that only checked "delete was called" would pass anyway. */
function fakeAdmin({ selectResult, deleteResult = { error: null } } = {}) {
  const calls = { tables: [], filters: [], deleted: [], selects: 0, deletes: 0 };
  const builder = (resolve) => {
    const b = {
      select(cols) { calls.selects++; calls.cols = cols; return b; },
      delete() { calls.deletes++; b._deleting = true; return b; },
      eq(col, val) {
        calls.filters.push(['eq', col, val]);
        if (b._deleting) calls.deleted.push(val);
        return b;
      },
      is(col, val) { calls.filters.push(['is', col, val]); return b; },
      order(col, opts) { calls.order = [col, opts]; return b; },
      limit(n) { calls.limit = n; return b; },
      then(onOk, onErr) { return Promise.resolve(resolve(b)).then(onOk, onErr); },
    };
    return b;
  };
  const admin = {
    from(table) {
      calls.tables.push(table);
      return builder((b) => (b._deleting ? deleteResult : selectResult));
    },
  };
  return { admin, calls };
}

const SIGNED_IN = { userId: 'user-abc', ipHash: 'hash-xyz' };
const ANON = { userId: null, ipHash: 'hash-xyz' };

test('a signed-in caller gets their newest row for that function removed', async () => {
  const { admin, calls } = fakeAdmin({ selectResult: { data: [{ id: 4242 }], error: null } });

  assert.equal(await refundUsage(admin, 'render-after', SIGNED_IN), true);

  assert.deepEqual(calls.tables, ['usage_events', 'usage_events']);
  assert.deepEqual(calls.order, ['id', { ascending: false }]);
  assert.equal(calls.limit, 1);
  assert.deepEqual(calls.deleted, [4242], 'deleted the id the lookup returned');
});

test('a signed-in caller is scoped by user_id, never by ip_hash', async () => {
  const { admin, calls } = fakeAdmin({ selectResult: { data: [{ id: 1 }], error: null } });
  await refundUsage(admin, 'render-after', SIGNED_IN);

  const lookup = calls.filters.filter(([, col]) => col !== 'id');
  assert.deepEqual(lookup, [['eq', 'fn', 'render-after'], ['eq', 'user_id', 'user-abc']]);
  assert.ok(
    !calls.filters.some(([, col]) => col === 'ip_hash'),
    'the insert leaves ip_hash null for signed-in callers, so filtering on it would match nothing',
  );
});

test('an anonymous caller is scoped by ip_hash AND a null user_id', async () => {
  const { admin, calls } = fakeAdmin({ selectResult: { data: [{ id: 7 }], error: null } });
  await refundUsage(admin, 'render-after', ANON);

  const lookup = calls.filters.filter(([, col]) => col !== 'id');
  assert.deepEqual(lookup, [
    ['eq', 'fn', 'render-after'],
    ['is', 'user_id', null],
    ['eq', 'ip_hash', 'hash-xyz'],
  ]);
});

test('the function name scopes the refund, so one endpoint cannot refund another', async () => {
  const { admin, calls } = fakeAdmin({ selectResult: { data: [{ id: 9 }], error: null } });
  await refundUsage(admin, 'analyze-space', SIGNED_IN);
  assert.ok(calls.filters.some(([op, col, val]) =>
    op === 'eq' && col === 'fn' && val === 'analyze-space'));
});

test('no matching row deletes nothing and does not throw', async () => {
  const { admin, calls } = fakeAdmin({ selectResult: { data: [], error: null } });
  assert.equal(await refundUsage(admin, 'render-after', SIGNED_IN), false);
  assert.equal(calls.deletes, 0, 'nothing to give back, so nothing is deleted');
});

/* The row here is deliberately USABLE. An earlier version of this test paired
   the error with `data: null`, which the empty-result guard catches on its own —
   so it passed with the error check removed and proved nothing. Returning a row
   alongside the error means only an implementation that actually reads `error`
   can decline to delete it. */
test('a failed lookup is swallowed and deletes nothing', async () => {
  const { admin, calls } = fakeAdmin({
    selectResult: { data: [{ id: 99 }], error: { message: 'boom' } },
  });
  assert.equal(await refundUsage(admin, 'render-after', SIGNED_IN), false);
  assert.equal(calls.deletes, 0, 'an errored lookup must not lead to a blind delete');
});

test('a failed delete is swallowed rather than masking the original error', async () => {
  const { admin } = fakeAdmin({
    selectResult: { data: [{ id: 5 }], error: null },
    deleteResult: { error: { message: 'nope' } },
  });
  assert.equal(await refundUsage(admin, 'render-after', SIGNED_IN), false);
});

test('a client that throws outright is swallowed', async () => {
  const admin = { from() { throw new Error('connection reset'); } };
  assert.equal(await refundUsage(admin, 'render-after', SIGNED_IN), false);
});
