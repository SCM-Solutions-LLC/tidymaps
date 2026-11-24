import { test, expect, devices } from 'playwright/test';
import { openViewer } from './helpers.mjs';

/* The 3D view told everyone to "scroll to zoom" and "Hover a zone to
   spotlight it". The watched sessions run on the tester's own phone, where
   there is no wheel and no hover, so the first instruction on the screen named
   two gestures they could not make (11-24 walk). A tap fires the same
   mouseenter on a phone, so the spotlight itself already works there; only
   the words were wrong. */

test.describe('on a phone', () => {
  // Not the whole device: it carries defaultBrowserType, which a describe cannot set.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('the 3D view names the phone gestures, and a tap spotlights a zone', async ({ page }) => {
    await openViewer(page);
    await expect(page.locator('#v3d-intro')).toContainText('pinch to zoom');
    await expect(page.locator('#v3d-intro')).not.toContainText('scroll');
    await expect(page.locator('#v3d-zones-sub')).toContainText('Tap a zone to spotlight it.');
    await expect(page.locator('#v3d-zones-sub')).not.toContainText('Hover');
    // The words promise a tap does something: it lights the items on that shelf.
    const row = page.locator('.v3d-zone-item').first();
    await row.tap();
    const lit = await page.evaluate(() => window.__v3dView.items.filter((it) => it.material.emissive.getHex() !== 0).length);
    expect(lit).toBeGreaterThan(0);
  });
});

test('with a mouse the 3D view keeps scroll and hover', async ({ page }) => {
  await openViewer(page);
  await expect(page.locator('#v3d-intro')).toContainText('scroll to zoom');
  await expect(page.locator('#v3d-zones-sub')).toContainText('Hover a zone to spotlight it.');
});
