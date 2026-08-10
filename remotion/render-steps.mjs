/* Render every producible step clip and declare it in ../data/step-media.json.

   Bundles the composition once, then renders one VP9 WebM per key from
   enumerate-keys.mjs into ../media/steps/{key}.webm. Idempotent: keys whose
   file already exists are skipped (pass --force to re-render, e.g. after a
   palette or scene change). Finishes by rewriting the manifest's clips block
   so tests/step-media.test.mjs can hold production honest.

   Usage, from remotion/:  node render-steps.mjs [--force] [--only key1,key2] */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumerateKeys } from './enumerate-keys.mjs';
import { parseMediaKey } from '../js/stepMedia.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(repo, 'media', 'steps');
const manifestPath = join(repo, 'data', 'step-media.json');

const force = process.argv.includes('--force');
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const only = onlyArg ? new Set((process.argv[process.argv.indexOf(onlyArg) + 1] || onlyArg.split('=')[1] || '').split(',').filter(Boolean)) : null;

// The pre-installed Playwright Chromium; Remotion must not try to download
// its own browser here (the sandbox blocks that fetch).
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium';
const chromeMode = 'chrome-for-testing';

const keys = enumerateKeys()
  .map(({ key }) => key)
  .filter((k) => {
    if (!parseMediaKey(k)) throw new Error(`enumerated key outside vocabulary: ${k}`);
    return !only || only.has(k);
  });

mkdirSync(outDir, { recursive: true });
console.log(`${keys.length} keys; bundling composition…`);
const serveUrl = await bundle({ entryPoint: join(here, 'src', 'index.ts') });

let rendered = 0, skipped = 0;
for (const key of keys) {
  const outPath = join(outDir, `${key}.webm`);
  if (!force && existsSync(outPath)) { skipped++; continue; }
  const inputProps = parseMediaKey(key);
  const composition = await selectComposition({
    serveUrl, id: 'StepClip', inputProps, browserExecutable, chromeMode,
  });
  await renderMedia({
    serveUrl, composition, inputProps, browserExecutable, chromeMode,
    codec: 'vp9', crf: 32, outputLocation: outPath,
    // the clips are silent; muted keeps ffmpeg from writing an audio track
    enforceAudioTrack: false, muted: true,
    logLevel: 'warn',
  });
  rendered++;
  console.log(`  ${String(rendered + skipped).padStart(3)}/${keys.length}  ${key}.webm`);
}

/* Declare everything on disk. The manifest is rebuilt from the enumerated
   list so a renamed or retired key can't leave a stale entry behind. */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.clips = {};
for (const key of enumerateKeys().map(({ key: k }) => k)) {
  const file = `media/steps/${key}.webm`;
  if (!existsSync(join(repo, file))) continue;
  manifest.clips[key] = {
    file,
    status: 'ready',
    license: {
      type: 'first-party',
      owner: 'TidyMap',
      note: 'Rendered from remotion/ — the STEP_ART scenes in js/screens/results.js are the spec',
    },
  };
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`rendered ${rendered}, skipped ${skipped}; manifest now declares ${Object.keys(manifest.clips).length} ready clips`);
