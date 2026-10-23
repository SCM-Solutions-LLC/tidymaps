/* A contact sheet of stills, for reviewing a design change before the full
   re-render (~25 minutes). One row per key, one column per moment of its loop.

   Usage, from remotion/:
     node sheet.mjs --keys purge-fridge-carton,stock-cabinet-plate --at 0.3,0.5,0.8 --out sheet.png
     node sheet.mjs --motif fridge --glyph carton --out fridge.png   (every action)

   Needs ffmpeg on PATH to tile the stills. */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, parseMediaKey } from '../js/stepMedia.js';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const keys = arg('keys')
  ? arg('keys').split(',')
  : ACTIONS.map((a) => `${a}-${arg('motif', 'shelves')}-${arg('glyph', 'can')}`);
for (const k of keys) if (!parseMediaKey(k)) throw new Error(`key outside the vocabulary: ${k}`);
const moments = arg('at', '0.45').split(',').map(Number);
const out = resolve(arg('out', 'sheet.png'));
const browserExecutable = process.env.REMOTION_BROWSER || null;
const chromeMode = process.env.REMOTION_CHROME_MODE || 'chrome-for-testing';

const serveUrl = await bundle({ entryPoint: join(here, 'src', 'index.ts') });
const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
const tiles = [];
for (const key of keys) {
  const inputProps = parseMediaKey(key);
  const composition = await selectComposition({ serveUrl, id: 'StepClip', inputProps, browserExecutable, chromeMode });
  for (const m of moments) {
    const output = join(dir, `${tiles.length}.png`);
    const frame = Math.min(composition.durationInFrames - 1, Math.round(m * composition.durationInFrames));
    await renderStill({ serveUrl, composition, inputProps, frame, output, scale: 0.5, browserExecutable, chromeMode });
    tiles.push(output);
  }
  console.log(`  ${key}`);
}
const inputs = tiles.flatMap((t) => ['-i', t]);
const layout = tiles.map((_, i) => `${(i % moments.length) * 640}_${Math.floor(i / moments.length) * 164}`).join('|');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex',
  `xstack=inputs=${tiles.length}:layout=${layout}:fill=white`, out]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out}`);
