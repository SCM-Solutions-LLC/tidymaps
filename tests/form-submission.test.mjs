import test from 'node:test';
import assert from 'node:assert/strict';
import { submitFeedbackRow, submitInviteRequest } from '../js/db.js';

/* Feedback and Founding Circle signups, and whether the app is allowed to say
   they arrived.

   Both helpers used to catch their own failure and resolve `false`. Both call
   sites were written as though they threw — the feedback screen even attaches
   a `.catch` that rolls back the thank-you and says so — and that catch could
   never run. The result was a UI that thanked people for feedback the server
   never received, a "You're signed up" for an address on no list, and a
   `feedback_submitted` count larger than the table it describes.

   `false` is a return value someone has to remember to check. These are the
   tests for the version that cannot be forgotten. */

const ok = () => ({ ok: true });
const record = (calls, response = ok()) => async (payload) => { calls.push(payload); return response; };
const rejects = (error) => async () => { throw error; };

test('feedback resolves only when the server confirms the row', async () => {
  const calls = [];
  await submitFeedbackRow({ useful: 'I would pay for this', vs: null }, record(calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'feedback');
  assert.equal(calls[0].useful, 'I would pay for this');
});

test('a failed feedback request rejects instead of answering false', async () => {
  const boom = Object.assign(new Error('Analysis failed on our side'), { code: 'http_500' });
  await assert.rejects(
    () => submitFeedbackRow({ useful: 'Very useful' }, rejects(boom)),
    /Analysis failed on our side/,
    'the caller cannot tell a stored answer from a lost one',
  );
});

test('a rate limit is a failure the caller can name', async () => {
  const limited = Object.assign(new Error('too many'), { code: 'rate_limited' });
  await assert.rejects(() => submitFeedbackRow({}, rejects(limited)), (e) => e.code === 'rate_limited');
});

/* callFn returns whatever JSON came back, and `null` when a 2xx body would not
   parse — which is what a captive portal's login page and a proxy's error page
   both look like. "No exception" is not "stored". */
test('a 200 that is not a confirmation is not treated as one', async () => {
  for (const body of [null, undefined, {}, { ok: false }, { error: 'internal' }, 'OK']) {
    await assert.rejects(
      () => submitFeedbackRow({}, async () => body),
      (e) => e.code === 'unconfirmed',
      `a response of ${JSON.stringify(body)} passed as a stored row`,
    );
  }
});

test('the signup sends the address and resolves on confirmation', async () => {
  const calls = [];
  await submitInviteRequest('someone@example.com', record(calls));
  assert.deepEqual(calls, [{ kind: 'invite', email: 'someone@example.com' }]);
});

test('a failed signup rejects, so nothing can claim the address is on the list', async () => {
  const offline = Object.assign(new Error('Could not reach'), { code: 'network' });
  await assert.rejects(() => submitInviteRequest('a@b.co', rejects(offline)), (e) => e.code === 'network');
  await assert.rejects(() => submitInviteRequest('a@b.co', async () => null), (e) => e.code === 'unconfirmed');
});

/* An address already on the list answers exactly like a fresh signup — that is
   deliberate, so the response cannot be used to test whether an address is
   registered — which means the client must treat it as the success it is. */
test('an address already on the list is a success, like the server says', async () => {
  await submitInviteRequest('already@there.com', async () => ({ ok: true }));
});
