import test from 'node:test';
import assert from 'node:assert/strict';
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
