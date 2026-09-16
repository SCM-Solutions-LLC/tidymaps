import { test } from 'node:test';
import assert from 'node:assert/strict';

/* The opt-out flag on cookies.html and the read in js/telemetry.js meet at
   one key. These tests pin the contract from both sides: setOptedOut writes
   what isOptedOut reads, telemetryStatus names the same reason the flag
   causes, and turning the flag on also clears the anonymous id so a later
   opt-in starts fresh rather than resuming the old visitor.

   Node has no localStorage, so each test provisions a fresh in-memory shim
   on globalThis. Restoring afterwards matters: the telemetry test file that
   imports js/telemetry.js relies on `typeof document === 'undefined'` to
   short-circuit the whole pipeline (see the "opens no socket" test), so a
   stray global left behind would silently arm every subsequent module. */

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

function withStorage(store, fn) {
  const priorStorage = globalThis.localStorage;
  globalThis.localStorage = store;
  try { return fn(); }
  finally {
    if (priorStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = priorStorage;
  }
}

/* `globalThis.navigator` is a getter-only property in modern Node, so an
   assignment throws even before the test runs. defineProperty is what works,
   and the descriptor is saved so the shim can be lifted cleanly rather than
   leaked into every subsequent test's imports. */
function withGlobalProps(props, fn) {
  const priors = [];
  for (const [name, value] of Object.entries(props)) {
    priors.push([name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  try { return fn(); }
  finally {
    for (const [name, prior] of priors) {
      if (prior) Object.defineProperty(globalThis, name, prior);
      else delete globalThis[name];
    }
  }
}

test('isOptedOut reads the flag and defaults to false', async () => {
  const { isOptedOut, OPTOUT_KEY } = await import('../js/optout.js');
  withStorage(fakeStorage(), () => {
    assert.equal(isOptedOut(), false, 'empty storage means opted in');
  });
  withStorage(fakeStorage({ [OPTOUT_KEY]: 'off' }), () => {
    assert.equal(isOptedOut(), true);
  });
  withStorage(fakeStorage({ [OPTOUT_KEY]: 'anything-else' }), () => {
    /* Only the exact value 'off' opts out. A garbled or partial value from a
       stale browser extension is not consent, and must not silently silence
       telemetry the way the value 'off' would. */
    assert.equal(isOptedOut(), false);
  });
});

test('setOptedOut(true) writes the flag AND clears the anonymous id', async () => {
  const { setOptedOut, isOptedOut, OPTOUT_KEY, ANON_KEY } = await import('../js/optout.js');
  const store = fakeStorage({ [ANON_KEY]: 'existing-uuid' });
  withStorage(store, () => {
    assert.equal(setOptedOut(true), true);
    assert.equal(store.getItem(OPTOUT_KEY), 'off');
    assert.equal(store.getItem(ANON_KEY), null, 'opting out abandons the identifier tied to prior events');
    assert.equal(isOptedOut(), true);
  });
});

test('setOptedOut(false) removes the flag rather than writing "on"', async () => {
  /* Absent and explicit-on read the same to every consumer, so writing "on"
     just leaves a second value shape for a future reader to get wrong.
     Removing the key keeps the storage listing on cookies.html honest, too:
     opting back in returns the browser to the exact state a fresh visitor
     would be in. */
  const { setOptedOut, OPTOUT_KEY } = await import('../js/optout.js');
  const store = fakeStorage({ [OPTOUT_KEY]: 'off' });
  withStorage(store, () => {
    assert.equal(setOptedOut(false), true);
    assert.equal(store.getItem(OPTOUT_KEY), null);
  });
});

test('storage that throws does not throw upward', async () => {
  /* Safari's private mode used to throw on setItem, and site-storage-blocked
     Chromium throws on the property access itself. Telemetry's "must never
     break or slow the app" applies double to the module that decides
     whether to fire it at all. */
  const { setOptedOut, isOptedOut } = await import('../js/optout.js');
  const throwing = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  withStorage(throwing, () => {
    assert.equal(isOptedOut(), false, 'a broken read must not falsely opt out');
    assert.equal(setOptedOut(true), false, 'a broken write reports it');
  });
});

test('telemetryStatus names the in-app opt-out when the flag is set', async () => {
  /* The debug string is the whole reason telemetryStatus() exists (see its
     doc-comment on the GPC-by-default outage). A new "off" reason it does
     not name is a new hour of database audit next time. */
  const { telemetryStatus } = await import('../js/telemetry.js');
  const { OPTOUT_KEY } = await import('../js/optout.js');

  /* Precondition: in Node this file reports "no document" and no storage
     reading will happen. Prove the ordering by shimming both. */
  assert.equal(typeof document, 'undefined');
  withGlobalProps({
    document: {},
    navigator: { webdriver: false, doNotTrack: '0' },
    window: { doNotTrack: '0' },
  }, () => {
    withStorage(fakeStorage({ [OPTOUT_KEY]: 'off' }), () => {
      assert.equal(telemetryStatus(), 'off: opted out on this device');
    });
    withStorage(fakeStorage(), () => {
      assert.equal(telemetryStatus(), 'on');
    });
  });
});

test('browser signals win over the in-app flag in the status string', async () => {
  /* DNT/GPC are a stronger consent gesture than a page toggle, and the
     status string is what a debugger reads on window: the deeper reason is
     the useful one to report. Both still turn telemetry off, tested in the
     "opens no socket" test above; this pins the ordering of the string. */
  const { telemetryStatus } = await import('../js/telemetry.js');
  const { OPTOUT_KEY } = await import('../js/optout.js');
  withGlobalProps({
    document: {},
    navigator: { webdriver: false, globalPrivacyControl: true },
    window: {},
  }, () => {
    withStorage(fakeStorage({ [OPTOUT_KEY]: 'off' }), () => {
      assert.equal(telemetryStatus(), 'off: Global Privacy Control');
    });
  });
});
