import test from 'node:test';
import assert from 'node:assert/strict';

// The landing page and privacy policy promise: without an account, photos
// are not stored after the analysis. These tests pin the two client-side
// halves of that promise — the guest draft never serializes media, and
// clearGuestMedia actually drops every in-memory copy.

// state.js touches localStorage at module scope helpers; provide a shim.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { state, persistGuestDraft, clearGuestMedia } = await import('../js/state.js');

function seedStateWithMedia() {
  state.space = 'pantry';
  state.ai = { spaceType: 'Pantry', steps: [] };
  state.stepDone = [false];
  state.uploadedFiles = [{ name: 'kitchen.jpg', fakeFile: true }];
  state.uploadedVideo = { name: 'scan.mp4', fakeFile: true };
  state.frames = [{ data: 'BASE64PHOTOBYTES', t: 1.2 }];
  state.afterRenderB64 = 'BASE64RENDERBYTES';
  state.beforePhotoUrl = 'blob:https://example/abc';
}

test('guest draft never serializes photos, frames, video, or render bytes', () => {
  seedStateWithMedia();
  persistGuestDraft();
  const raw = store.get('tidymap_draft_v2');
  assert.ok(raw, 'draft should have been written');
  for (const leak of ['BASE64PHOTOBYTES', 'BASE64RENDERBYTES', 'kitchen.jpg', 'scan.mp4', 'uploadedFiles', 'frames']) {
    assert.ok(!raw.includes(leak), `guest draft contains media data: ${leak}`);
  }
});

test('clearGuestMedia drops every in-memory media copy', () => {
  seedStateWithMedia();
  clearGuestMedia();
  assert.deepEqual(state.uploadedFiles, []);
  assert.equal(state.uploadedVideo, null);
  assert.deepEqual(state.frames, []);
  assert.equal(state.afterRenderB64, null);
  assert.equal(state.beforePhotoUrl, null);
});

test('share view never writes a guest draft (the visitor keeps their own)', () => {
  seedStateWithMedia();
  persistGuestDraft();
  const before = store.get('tidymap_draft_v2');
  state.shareView = true;
  state.space = 'closet'; // someone else's shared plan applied
  persistGuestDraft();
  assert.equal(store.get('tidymap_draft_v2'), before, 'draft changed while viewing a shared plan');
  state.shareView = false;
});
