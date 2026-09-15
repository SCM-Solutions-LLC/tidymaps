import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage } from '../js/auth.js';

/* The sign-in modal prints whatever sendCode/verifyCode throw, and until this
   test the message for a request that never got an answer was the browser's
   own fetch text: supabase-js wraps it in an AuthRetryableFetchError with the
   text kept verbatim, and the modal's reading passed anything it did not
   recognise straight through. Someone on a train saw "Failed to fetch".

   The shapes below are what the vendored bundle actually builds (name and
   status; `code` is the server's, present on API errors and absent on fetch
   failures), so the classifier is exercised on the objects it will meet
   rather than on a tidy stand-in. */

const fetchFailure = (message) => Object.assign(new Error(message), { name: 'AuthRetryableFetchError', status: 0 });
const apiError = (message, status, code) => Object.assign(new Error(message), { name: 'AuthApiError', status, code });

const CONNECTION = 'Could not reach the sign-in service. Check your connection and try again.';
const UNAVAILABLE = 'Sign-in is temporarily unavailable. Try again in a minute.';

test('a request that got no answer says so, in every browser’s words', () => {
  for (const raw of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed']) {
    for (const stage of ['send', 'verify']) {
      const msg = authErrorMessage(fetchFailure(raw), stage);
      assert.equal(msg, CONNECTION, `${stage}: ${raw}`);
      assert.doesNotMatch(msg, new RegExp(raw.split(' ')[0], 'i'), 'the browser’s text reached the modal');
    }
  }
});

test('the library failing to load reads the same as the request failing', () => {
  // import() rejects with a TypeError and no status, name or code: only the text says what it was.
  for (const raw of [
    'Failed to fetch dynamically imported module: https://example.test/vendor/supabase/supabase.esm.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
  ]) {
    assert.equal(authErrorMessage(new TypeError(raw), 'send'), CONNECTION, raw);
  }
});

test('a 5xx from the auth service is the service, not the connection', () => {
  for (const status of [500, 502, 503, 504]) {
    const err = Object.assign(new Error('<html>Bad Gateway</html>'), { name: 'AuthRetryableFetchError', status });
    const msg = authErrorMessage(err, 'send');
    assert.equal(msg, UNAVAILABLE, String(status));
    assert.doesNotMatch(msg, /html|gateway/i);
  }
});

test('rate limiting is read from the status, not from a word the server may not use', () => {
  // GoTrue's send-again text does not contain "rate"; the old reading missed it.
  assert.equal(authErrorMessage(apiError('For security purposes, you can only request this after 59 seconds.', 429, 'over_email_send_rate_limit'), 'send'),
    'Too many attempts. Wait a minute and try again.');
  assert.equal(authErrorMessage(apiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'), 'send'),
    'Too many attempts. Wait a minute and try again.');
  assert.equal(authErrorMessage(apiError('Request rate limit reached', 429, 'over_request_rate_limit'), 'verify'),
    'Too many attempts. Wait a minute and try again.');
});

test('a wrong code on verify still says the code did not match', () => {
  assert.equal(authErrorMessage(apiError('Token has expired or is invalid', 403, 'otp_expired'), 'verify'),
    'That code didn’t match. Check the newest email and try again.');
});

test('a refused address on send is about the address, not about a code that never went', () => {
  // The same "invalid" used to route here to "check the newest email".
  const msg = authErrorMessage(apiError('Unable to validate email address: invalid format', 400, 'validation_failed'), 'send');
  assert.equal(msg, 'That email address was not accepted. Check it and try again.');
  assert.doesNotMatch(msg, /code|newest email/i);
  assert.equal(authErrorMessage(apiError('Email address "a@b" is invalid', 400, 'email_address_invalid'), 'send'),
    'That email address was not accepted. Check it and try again.');
});

test('nothing unrecognised is passed through to the modal', () => {
  const raw = 'Signups not allowed for otp';
  const send = authErrorMessage(apiError(raw, 422, 'otp_disabled'), 'send');
  const verify = authErrorMessage(apiError('unexpected_failure', 500 - 1, 'unexpected_failure'), 'verify');
  assert.equal(send, 'The code did not send. Please try again.');
  assert.equal(verify, 'Sign-in failed. Please try again.');
  assert.doesNotMatch(send, /otp/i);
  assert.doesNotMatch(verify, /unexpected_failure/);
  // And an error with no message at all still produces a sentence.
  assert.equal(authErrorMessage({}, 'send'), 'The code did not send. Please try again.');
  assert.equal(authErrorMessage(null, 'verify'), 'Sign-in failed. Please try again.');
});
