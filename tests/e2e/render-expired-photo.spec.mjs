import { test, expect } from 'playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expandChapters, fakeSession, REF } from './helpers.mjs';
import { normalizeAi } from '../../js/plan.js';

/* Audit 11-24 (open item 24): a saved plan's photo is a link signed for one
   hour (js/db.js coverUrl). Opened longer ago than that, the photo preview
   fetched the link, got the storage error back as the "image", and sent that
   to render-after. An expired link is now signed again once. Offline: the
   session is faked and every project call is answered here. */

const PHOTO = readFileSync(fileURLToPath(new URL('../../assets/photos/ex-cab-before.webp', import.meta.url)));
const SPACE = 'cccccccc-3333-4333-8333-333333333333';
const PATH = 'user/c/photo.webp';

const plan = normalizeAi({
  spaceType: 'Pantry', summary: 'A saved plan.', categories: ['Canned goods'],
  map: [{ level: 'Top shelf', icon: 'up', zone: 'Backstock', why: 'Rare.', eye: false, shelfIndex: 0,
    safety: { flag: null, why: null }, items: [{ name: 'Canned goods', size: 'm', flags: [] }], surface: 'shelf' }],
  geometry: { unit: 'in', width: 36, height: 72, depth: 16, shelfCount: 1, shelfYFracs: [0.1], estimated: false },
  layout: null, safetyNotes: [], productNeeds: [],
  steps: Array.from({ length: 7 }, (_, i) => ({ task: `Do step ${i + 1}`, time: '5 min', why: 'It helps.' })),
  time: '45 min', cost: '$0',
});
const row = {
  id: SPACE, name: 'The pantry', space_type: 'pantry', goal: 'find', dims: { w_in: 36, h_in: 72, d_in: 16 },
  household: { adults: 2, kidCount: 0, petCount: 0, kids: { present: 'no', ages: [] }, pets: { present: 'no', types: [] }, mobility: [], notes: '' },
  prefs: {}, plan, plan_meta: { model: 'test-model', source: 'ai', analyzedAt: 1 }, shopping: null,
  progress: { stepsDone: [] }, arrangement: null, after_render_path: null, updated_at: '2026-08-01T00:00:00Z',
};

test('a saved photo whose link has expired is signed again before the preview renders', async ({ page }) => {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [`sb-${REF}-auth-token`, fakeSession()]);
  let signs = 0;
  let expiredUpTo = 0;   // every link signed before the click has expired
  let sentImage = null;
  await page.route(`**/${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = req.url().replace(`https://${REF}.supabase.co`, '');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/\/auth\/v1\/token/.test(url)) return json(fakeSession());
    if (/\/auth\/v1\/user/.test(url)) return json(fakeSession().user);
    if (/\/functions\/v1\/render-after/.test(url)) {
      sentImage = JSON.parse(req.postData() || '{}').image;
      return json({ image: { media_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } });
    }
    if (req.method() === 'POST' && url.startsWith(`/storage/v1/object/sign/space-media/${PATH}`)) {
      signs++;
      return json({ signedURL: `/object/sign/space-media/${PATH}?token=t${signs}` });
    }
    if (req.method() === 'GET' && url.startsWith(`/storage/v1/object/sign/space-media/${PATH}`)) {
      const n = Number(/token=t(\d+)/.exec(url)[1]);
      if (n <= expiredUpTo) return json({ statusCode: '400', error: 'InvalidJWT', message: '"exp" claim timestamp check failed' }, 400);
      return route.fulfill({ status: 200, contentType: 'image/webp', body: PHOTO });
    }
    if (/\/rest\/v1\/space_media/.test(url)) return json([{ storage_path: PATH }]);
    if (/\/rest\/v1\/spaces/.test(url) && req.method() === 'GET') {
      if (/not\.is\.null/.test(url)) return json([]);
      return /id=eq\./.test(url) ? json(row) : json([row]);
    }
    if (/\/rest\/v1\//.test(url)) return json([]);
    return json({});
  });

  await page.goto('/index.html');
  await page.locator('#acct-btn:not(.hide)').click();
  await page.locator('.dash-card [data-open]').first().click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 20_000 });
  await expandChapters(page);
  expiredUpTo = signs;
  expect(signs, 'the saved photo was never signed').toBeGreaterThan(0);
  await page.locator('#after-gen-btn').click();
  await expect.poll(() => sentImage, { timeout: 10_000 }).not.toBeNull();
  expect(sentImage.data, 'the storage error was sent as the photo').toBe(PHOTO.toString('base64'));
  expect(sentImage.media_type).toBe('image/webp');
});
