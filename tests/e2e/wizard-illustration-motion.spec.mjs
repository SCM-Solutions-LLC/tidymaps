import { test, expect } from 'playwright/test';

/* Illustration motion guard.

   Every wizard card explains a storage option with one moving detail. Two
   things have to hold for that to do any work: the detail has to actually
   travel far enough to notice, and it has to be big enough to see at card
   size.

   The original version of this spec only checked the four room cards, so the
   ~34 setup cards — the ones users spend the most time comparing — were never
   covered, and an entire step (Bedroom > Closet) shipped with every card
   effectively static. The sweep below drives all nine areas.

   Travel is sampled across the FULL animation timeline rather than at a fixed
   phase. Cards carry a stagger (animation-delay), so a fixed-phase reading
   measures where a card happens to be rather than how far it moves, which
   makes a lively card look dead purely because of its position in the grid. */

test.use({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'no-preference',
});

const MIN_TRAVEL = 5;   // px of peak-to-trough movement at real card size
const MIN_SIZE = 14;    // px on the moving detail's long edge

// room card text → area card text, for every area the wizard offers
const AREAS = [
  ['Kitchen', 'Pantry'], ['Kitchen', 'Cabinets'], ['Kitchen', 'Drawers'],
  ['Bedroom', 'Closet'], ['Bedroom', 'Dresser'],
  ['Bathroom & hall', 'Vanity & under-sink'], ['Bathroom & hall', 'Linen closet'],
  ['Garage', 'Shelving & storage'], ['Garage', 'Workbench'],
];

/* Measure each card in `selector`: for every animated node inside its motion
   group, scrub the whole timeline and keep the node that moves the most. */
function measure(page, selector) {
  return page.locator(selector).evaluateAll((cards, { steps }) =>
    cards.map((card) => {
      const svg = card.querySelector('.card-art-svg');
      const label = (card.querySelector('h3, .ws-ttl')?.textContent || card.textContent || '').trim();
      const artKey = svg ? [...svg.classList].find((c) => c.startsWith('art-')) : null;
      const motion = card.querySelector('.art-motion');
      const nodes = motion
        ? [motion, ...motion.querySelectorAll('*')].filter((n) => n.getAnimations().length)
        : [];
      if (!nodes.length) return { label, artKey, animated: false, travel: 0, size: 0 };

      let best = { travel: -1, size: 0 };
      for (const node of nodes) {
        const anim = node.getAnimations()[0];
        if (anim.animationName === 'none') continue;
        const duration = Number(anim.effect.getTiming().duration);
        anim.pause();
        const frames = [];
        for (let i = 0; i <= steps; i++) {
          anim.currentTime = (duration * i) / steps;
          const box = node.getBoundingClientRect();
          frames.push({ x: box.x, y: box.y, w: box.width, h: box.height, o: parseFloat(getComputedStyle(node).opacity) });
        }
        anim.play();
        const spread = (k, scale = 1) =>
          (Math.max(...frames.map((f) => f[k])) - Math.min(...frames.map((f) => f[k]))) * scale;
        const travel = Math.max(spread('x'), spread('y'), spread('w'), spread('h'), spread('o', 16));
        if (travel > best.travel) {
          const box = node.getBoundingClientRect();
          best = { travel, size: Math.max(box.width, box.height) };
        }
      }
      return { label, artKey, animated: best.travel >= 0, travel: best.travel, size: best.size };
    }),
    { steps: 24 },
  );
}

function assertReadable(metrics, where) {
  expect(metrics.length, `${where}: no cards rendered`).toBeGreaterThan(0);
  for (const m of metrics) {
    expect(m.animated, `${where} — "${m.label}" has no running illustration animation`).toBe(true);
    expect(
      m.travel,
      `${where} — "${m.label}" (${m.artKey}) moves only ${m.travel.toFixed(1)}px; it reads as static`,
    ).toBeGreaterThanOrEqual(MIN_TRAVEL);
    expect(
      m.size,
      `${where} — "${m.label}" (${m.artKey}) moving detail is ${m.size.toFixed(1)}px, too small to read`,
    ).toBeGreaterThanOrEqual(MIN_SIZE);
  }
}

/* Two cards on one screen must never share an illustration — the user would
   be choosing between identical pictures. Shipped once already: "Wardrobe"
   and "Built-in + drawers" were both artWardrobe. */
function assertDistinct(metrics, where) {
  const byKey = {};
  for (const m of metrics) (byKey[m.artKey] = byKey[m.artKey] || []).push(m.label);
  for (const [key, labels] of Object.entries(byKey)) {
    expect(labels.length, `${where} — ${key} is used by ${labels.length} cards: ${labels.join(' + ')}`).toBe(1);
  }
}

async function openArea(page, room, area) {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await page.locator('#room-cards .room-card', { hasText: room }).first().click();
  await page.locator('#flow-next').click();
  await page.locator('#area-cards .room-card', { hasText: area }).first().click();
  await page.locator('#flow-next').click();
  await expect(page.locator('#setup-cards .wz-setup').first()).toBeVisible();
  await page.waitForTimeout(350);
}

test('room card illustrations move enough to read', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#room-cards .room-card')).toHaveCount(4);
  await page.waitForTimeout(650);

  const metrics = await measure(page, '#room-cards .room-card');
  assertReadable(metrics, 'Room step');
  assertDistinct(metrics, 'Room step');
});

test('area card illustrations move enough to read', async ({ page }) => {
  for (const room of ['Kitchen', 'Bedroom', 'Bathroom & hall', 'Garage']) {
    await page.goto('/index.html');
    await page.locator('#screen-landing .btn-primary').first().click();
    await page.locator('#room-cards .room-card', { hasText: room }).first().click();
    await page.locator('#flow-next').click();
    await expect(page.locator('#area-cards .room-card').first()).toBeVisible();
    await page.waitForTimeout(350);

    const metrics = await measure(page, '#area-cards .room-card');
    assertReadable(metrics, `Area step (${room})`);
    assertDistinct(metrics, `Area step (${room})`);
  }
});

/* The coverage gap that let a fully static step ship. */
for (const [room, area] of AREAS) {
  test(`setup illustrations move enough to read — ${room} / ${area}`, async ({ page }) => {
    await openArea(page, room, area);
    const metrics = await measure(page, '#setup-cards .wz-setup');
    assertReadable(metrics, `${room} / ${area}`);
    assertDistinct(metrics, `${room} / ${area}`);
  });
}

test('motion is suppressed under prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openArea(page, 'Bedroom', 'Closet');
  const running = await page.locator('#setup-cards .wz-setup').evaluateAll((cards) =>
    cards.flatMap((card) => [...card.querySelectorAll('.art-motion, .art-motion *')])
      .flatMap((n) => n.getAnimations())
      .filter((a) => a.animationName && a.animationName !== 'none').length,
  );
  expect(running, 'illustration animations must not run under reduced motion').toBe(0);
});
