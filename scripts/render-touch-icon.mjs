/* Renders assets/apple-touch-icon.png from assets/favicon.svg.

   iOS asks for a PNG when someone adds the site to a home screen; without one
   it uses a screenshot of the page. The icon is the favicon drawn full bleed:
   iOS rounds the corners itself, and it fills a transparent pixel with black,
   so the favicon's own rounded corners come off before rendering and the PNG
   has no alpha channel (tests/site-hygiene.test.mjs checks both, and that the
   background still matches the favicon's fill).

   Run it again whenever the favicon changes:
     node scripts/render-touch-icon.mjs
   (CHROMIUM_PATH=/opt/pw-browsers/chromium in the web sandbox.) */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const SIZE = 180; // Apple's size for a 3x iPhone; iOS scales it for the rest
const root = new URL('../', import.meta.url);

const favicon = readFileSync(new URL('assets/favicon.svg', root), 'utf8');
const square = favicon.replace(/(<rect width="24" height="24") rx="[\d.]+"/, '$1');
if (square === favicon) throw new Error('favicon.svg has no rounded background rect to square off');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>${square}`);
  writeFileSync(new URL('assets/apple-touch-icon.png', root), await page.screenshot({ type: 'png' }));
} finally {
  await browser.close();
}
