/* Does any rendered clip draw within reach of its frame's edge?

   The band crops nothing (object-fit: contain), so a mark at the edge of the
   clip is a mark at the edge of the band: a utensil standing on the drawer
   bank's counter had its tip at y=0, a hanger moved to the closet floor hung
   past y=80, and the purge bins stood on the bottom edge. Fourteen clips did
   this, and a still frame of each looked fine.

   Decodes every other frame of each clip at stage resolution (320x80, one
   pixel per stage unit) and finds the outermost pixel that differs from the
   background. Fails a clip whose ink comes nearer than MIN_MARGIN to an
   edge: the scenes keep 3 units clear (STAGE_MARGIN in src/tokens.ts), and
   one unit of that is the anti-aliasing a downscale smears outward.

   Usage, from remotion/:  node check-edges.mjs [file.webm ...]
   With no arguments it checks every clip in ../media/steps. Needs ffmpeg. */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 320, H = 80;
export const MIN_MARGIN = 2;

export function inkMargin(file) {
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file,
    '-vf', `select=not(mod(n\\,2)),scale=${W}:${H}:flags=area`, '-fps_mode', 'passthrough',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const frame = W * H * 3;
  const bg = [raw[0], raw[1], raw[2]];
  let top = H, bottom = -1, left = W, right = -1;
  for (let f = 0; f + frame <= raw.length; f += frame) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = f + (y * W + x) * 3;
        const d = Math.abs(raw[i] - bg[0]) + Math.abs(raw[i + 1] - bg[1]) + Math.abs(raw[i + 2] - bg[2]);
        if (d <= 24) continue;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return { margin: Infinity, box: null };
  const margin = Math.min(top, left, H - 1 - bottom, W - 1 - right);
  return { margin, box: { top, bottom, left, right } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, '..', 'media', 'steps');
  const files = process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(dir).filter((f) => f.endsWith('.webm')).sort().map((f) => join(dir, f));
  let bad = 0;
  for (const file of files) {
    const { margin, box } = inkMargin(file);
    if (margin >= MIN_MARGIN) continue;
    bad++;
    console.log(`${margin}  ${file.split('/').pop()}  y ${box.top}..${box.bottom}  x ${box.left}..${box.right}`);
  }
  console.log(`${files.length} clips, ${bad} within ${MIN_MARGIN} units of an edge`);
  process.exitCode = bad ? 1 : 0;
}
