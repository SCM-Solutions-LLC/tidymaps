import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as db from '../js/db.js';

test('space deletion removes owned storage objects before deleting the row', async () => {
  assert.equal(typeof db.deleteSpaceData, 'function');
  const calls = [];
  const client = {
    from(table) {
      if (table === 'space_media') return {
        select: () => ({ eq: async () => ({ data: [
          { storage_path: 'user/space/photo.jpg' },
          { storage_path: 'user/space/after/render.png' },
        ], error: null }) }),
      };
      if (table === 'spaces') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { after_render_path: 'user/space/after/untracked.png' }, error: null,
        }) }) }),
        update: (body) => ({ eq: async () => {
          calls.push(body.deletion_files_removed ? 'ready' : body.deleting_at ? 'mark' : 'rollback');
          return { error: null };
        } }),
        delete: () => ({ eq: async () => { calls.push('row'); return { error: null }; } }),
      };
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        remove: async (paths) => { calls.push(['files', paths]); return { error: null }; },
      }),
    },
  };

  await db.deleteSpaceData(client, 'space');
  assert.deepEqual(calls, [
    'mark',
    ['files', ['user/space/photo.jpg', 'user/space/after/render.png', 'user/space/after/untracked.png']],
    'ready',
    'row',
  ]);
});

test('space deletion stops if storage cleanup fails', async () => {
  let deleted = false;
  const calls = [];
  const client = {
    from(table) {
      if (table === 'space_media') return {
        select: () => ({ eq: async () => ({ data: [{ storage_path: 'user/space/photo.jpg' }], error: null }) }),
      };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { after_render_path: null }, error: null }) }) }),
        update: (body) => ({ eq: async () => {
          calls.push(body.deletion_files_removed ? 'ready' : body.deleting_at ? 'mark' : 'rollback');
          return { error: null };
        } }),
        delete: () => ({ eq: async () => { deleted = true; return { error: null }; } }),
      };
    },
    storage: { from: () => ({ remove: async () => ({ error: new Error('storage failed') }) }) },
  };
  await assert.rejects(() => db.deleteSpaceData(client, 'space'), /delete uploaded files/i);
  assert.equal(deleted, false);
  assert.deepEqual(calls, ['mark', 'rollback']);
});

test('database failure after file removal leaves a retryable deletion tombstone', async () => {
  const calls = [];
  const client = {
    from(table) {
      if (table === 'space_media') return {
        select: () => ({ eq: async () => ({ data: [{ storage_path:'user/space/photo.jpg' }], error:null }) }),
      };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data:{ after_render_path:null }, error:null }) }) }),
        update: (body) => ({ eq: async () => { calls.push(body.deletion_files_removed ? 'ready' : body.deleting_at ? 'mark' : 'rollback'); return { error:null }; } }),
        delete: () => ({ eq: async () => { calls.push('row'); return { error:new Error('db unavailable') }; } }),
      };
    },
    storage:{ from:() => ({ remove:async () => { calls.push('files'); return { error:null }; } }) },
  };
  await assert.rejects(() => db.deleteSpaceData(client, 'space'), /finish removing/i);
  assert.deepEqual(calls, ['mark', 'files', 'ready', 'row']);
});

test('stale deletion tombstones resume the complete idempotent cleanup', async () => {
  const calls = [];
  const client = {
    from(table) {
      if (table === 'space_media') return {
        select: () => ({ eq: async () => ({ data:[{ storage_path:'user/stale/photo.jpg' }], error:null }) }),
      };
      return {
        select: (columns) => columns === 'id'
          ? { not:() => ({ lt:async () => ({ data:[{ id:'stale' }], error:null }) }) }
          : { eq:() => ({ maybeSingle:async () => ({ data:{ after_render_path:null }, error:null }) }) },
        update: (body) => ({ eq:async () => { calls.push(body.deletion_files_removed ? 'ready' : 'mark'); return { error:null }; } }),
        delete: () => ({ eq:async () => { calls.push('row'); return { error:null }; } }),
      };
    },
    storage:{ from:() => ({ remove:async () => { calls.push('files'); return { error:null }; } }) },
  };

  await db.resumeDeletionTombstones(client, new Date('2026-07-22T12:00:00Z'));
  assert.deepEqual(calls, ['mark', 'files', 'ready', 'row']);
});

/* ---------- Resuming a partial media upload ----------

   The guard used to ask whether the space had ANY media row, which answered
   yes as soon as the first photo of six had landed. A save that failed partway
   through therefore skipped the other five on every later attempt — and the
   only retry window is the session that still holds the files, so from the
   user's side those photos were simply never stored. */

function uploadHarness({ existing = [], existingError = null, uploadFails = [], insertFails = [] } = {}) {
  const calls = [];
  const client = {
    from(table) {
      if (table !== 'space_media') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: async () => ({ data: existing, error: existingError }) }),
        insert: async (row) => {
          const key = `${row.kind}:${row.sort}`;
          calls.push(['insert', key]);
          return { error: insertFails.includes(key) ? { message: 'insert failed' } : null };
        },
      };
    },
    storage: {
      from: () => ({
        upload: async (path) => {
          // {user}/{space}/{uuid}.{ext}; uploadsFor puts the item key in ext.
          const key = path.split('/').pop().split('.').slice(1).join('.');
          calls.push(['upload', key]);
          return { error: uploadFails.includes(key) ? { message: 'upload failed' } : null };
        },
        remove: async (paths) => { calls.push(['remove', paths.length]); return { error: null }; },
      }),
    },
  };
  return { client, calls };
}

// crypto.randomUUID makes the storage path unguessable; the test needs it
// predictable so it can say WHICH item was uploaded.
function uploadsFor(keys) {
  return keys.map((k) => {
    const [kind, sort] = k.split(':');
    return { blobPromise: Promise.resolve(`blob-${k}`), kind, sort: Number(sort), ext: k, type: 'image/jpeg' };
  });
}

test('a partial media upload is resumed rather than skipped', async () => {
  const { client, calls } = uploadHarness({ existing: [{ kind: 'photo', sort: 0 }] });
  await db.uploadMissingMedia(client, 'user', 'space',
    uploadsFor(['photo:0', 'photo:1', 'photo:2']));

  assert.deepEqual(calls, [
    ['upload', 'photo:1'], ['insert', 'photo:1'],
    ['upload', 'photo:2'], ['insert', 'photo:2'],
  ], 'the item already stored is skipped; the ones that never landed are retried');
});

test('an unreadable media list does not re-upload the whole batch', async () => {
  // Destructuring only `count` made a failed query read as "nothing here yet",
  // which duplicated every object and row on the next save.
  const { client, calls } = uploadHarness({ existing: null, existingError: { message: 'nope' } });
  await db.uploadMissingMedia(client, 'user', 'space', uploadsFor(['photo:0', 'photo:1']));
  assert.deepEqual(calls, [], 'an unreadable list is not an empty one');
});

test('an uploaded object whose row fails to insert is removed again', async () => {
  /* An object with no metadata row is invisible to deleteSpaceData, which
     builds its delete list from those rows — so it would outlive the space. */
  const { client, calls } = uploadHarness({ insertFails: ['photo:0'] });
  await db.uploadMissingMedia(client, 'user', 'space', uploadsFor(['photo:0', 'photo:1']));

  assert.deepEqual(calls, [
    ['upload', 'photo:0'], ['insert', 'photo:0'], ['remove', 1],
    ['upload', 'photo:1'], ['insert', 'photo:1'],
  ], 'the orphan is compensated and the rest of the batch still goes');
});

test('a failed upload does not sink the rest of the save', async () => {
  const { client, calls } = uploadHarness({ uploadFails: ['photo:0'] });
  await db.uploadMissingMedia(client, 'user', 'space', uploadsFor(['photo:0', 'photo:1']));
  assert.deepEqual(calls, [
    ['upload', 'photo:0'],
    ['upload', 'photo:1'], ['insert', 'photo:1'],
  ], 'no row is written for an object that never landed');
});

/* ---------- Incremental writes ----------

   Progress ticks, shopping edits and the 3D arrangement are written through a
   debounced PATCH. Its error was never read, and the pending patch is emptied
   BEFORE the await — so a single failed request dropped that edit on the floor
   with no retry and nothing on screen to say so. The user ticks a step off, it
   looks saved, and it is gone. */

test('a failed incremental write is queued again rather than dropped', async () => {
  db.takePendingPatch();
  const client = { from: () => ({ update: () => ({ eq: async () => ({ error: { message: 'offline' } }) }) }) };

  await db.writePatch(client, 'space-a', { progress: { stepsDone: [true] } });

  const owed = db.takePendingPatch();
  assert.deepEqual(owed.patch, { progress: { stepsDone: [true] } });
  assert.equal(owed.targetId, 'space-a');
});

test('a successful incremental write queues nothing', async () => {
  db.takePendingPatch();
  const client = { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };

  await db.writePatch(client, 'space-a', { progress: { stepsDone: [true] } });

  assert.deepEqual(db.takePendingPatch().patch, {});
});

const failing = { from: () => ({ update: () => ({ eq: async () => ({ error: { message: 'offline' } }) }) }) };

test('a retry does not undo anything the user did since it failed', async () => {
  /* The failed body goes back UNDERNEATH whatever has accumulated since: the
     user's later edit is newer than the attempt that failed, and must not be
     reverted by it. The first failure below stands in for that later edit —
     it is what is sitting in the queue when the second write fails. */
  db.takePendingPatch();
  await db.writePatch(failing, 'space-a', { shopping: ['what the user picked since'] });
  await db.writePatch(failing, 'space-a', { shopping: ['stale'], progress: { stepsDone: [true] } });

  const owed = db.takePendingPatch();
  assert.deepEqual(owed.patch.shopping, ['what the user picked since'],
    'the newer value must win over the one whose write failed');
  assert.deepEqual(owed.patch.progress, { stepsDone: [true] },
    'keys the newer edit did not touch still come back');
});

test('a failed write for one space is not replayed onto another', async () => {
  /* Re-applying one space's columns to another is worse than losing them. */
  db.takePendingPatch();
  await db.writePatch(failing, 'space-b', { shopping: ['b'] });   // queued, target = space-b
  await db.writePatch(failing, 'space-a', { progress: { stepsDone: [true] } });

  const owed = db.takePendingPatch();
  assert.equal(owed.targetId, 'space-b');
  assert.deepEqual(owed.patch, { shopping: ['b'] }, 'space-a\'s columns must not reach space-b');
});

/* ---------- Answers on every incremental write ----------

   Only a full save wrote the `prefs` column, and the report's products switch
   and the whole Adjust screen change answers long after the last full save. So
   a row's answers could be older than its plan, and `upgrades` in particular
   came back wrong: turn products on from Adjust, reopen the space, and the
   section was hidden with the cost tile reading $0 over a plan full of them.
   Re-deriving it from the shopping list was a patch over this. */

test('the answers a patch carries are snapshotted when it is queued', async () => {
  /* Not read at flush time. `patchTargetId` names the space the write is for,
     and by the time the 800ms timer fires `state` may hold another space's
     answers — reading it then is how one space's columns reach another's row,
     which is the mistake snapshotSave exists to prevent on the save path. */
  const { state } = await import('../js/state.js');
  const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  const queue = src.slice(src.indexOf('export function updateSpacePatch'), src.indexOf('export function persistAnswers'));
  assert.match(queue, /Object\.assign\(pendingPatch, \{ prefs: answersBlob\(\) \}, patch\)/,
    'the answers must be built where the patch is queued, not where it is flushed');

  const flush = src.slice(src.indexOf('async function flushPatch'), src.indexOf('export function takePendingPatch'));
  assert.doesNotMatch(flush, /answersBlob\(/,
    'flushPatch must not read the answers — by then they may belong to another space');

  // And an explicit key still wins over the ride-along.
  db.takePendingPatch();
  state.activeSpaceId = null;   // guests persist via localStorage; nothing queued
  assert.deepEqual(db.takePendingPatch().patch, {});
});

/* ---------- The last write ----------

   A write waits 800ms to be batched and a failed one waits 4000ms to be
   retried, and the whole of that is spent on a page the user may close,
   background, or navigate away from. The queue is in memory, so it goes with
   the page: the step comes back unticked and the only person who knows is the
   user who ticked it. Ticking the last step and closing the tab is not an
   unusual way to finish a plan, it is the normal one. */
test('a pending write is flushed when the page goes away, and survives it', () => {
  const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  const flush = src.slice(src.indexOf('function flushBeforeUnload'), src.indexOf('/* Registered here'));

  /* keepalive is the whole point. A normal fetch is cancelled when the
     document goes away, so flushing without it would only move the moment the
     write is lost rather than prevent it. */
  assert.match(flush, /keepalive:\s*true/,
    'without keepalive the flush is cancelled with the page it is trying to outlive');
  assert.match(flush, /method:\s*'PATCH'/);
  // The queue is drained before the request, so a second hide cannot resend it.
  assert.match(flush, /pendingPatch=\{\}; patchTargetId=null;[\s\S]*?fetch\(/);
  // RLS still applies: the write carries the user's own token, not just the key.
  assert.match(flush, /authorization:`Bearer \$\{token\}`/);

  const install = src.slice(src.indexOf('/* Registered here'), src.indexOf('export function takePendingPatch'));
  /* visibilitychange, not beforeunload: beforeunload does not fire reliably on
     mobile, which is exactly where tabs are killed most aggressively. */
  assert.match(install, /visibilitychange/);
  assert.match(install, /visibilityState==='hidden'/);
  assert.match(install, /pagehide/);
  assert.doesNotMatch(install, /beforeunload/);
  // Guarded, because the Node suite imports this module and has no document.
  assert.match(install, /typeof document!=='undefined'/);
});

test('the unload flush is registered on import, not left to a caller', () => {
  /* A persistence guarantee that depends on somebody remembering to install it
     is the shape of half the bugs this file has already had. */
  const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /export function installPatchFlush/);
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /flushBeforeUnload/,
    'the listener must not need wiring from main.js');
});
