import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePixels, assessQuality, qualityLabel, QUALITY } from '../js/imageQuality.js';

// Build an RGBA buffer where every pixel is the same gray value.
function solid(width, height, v) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

// High-contrast checkerboard: bright, sharp, and clearly analyzable.
function checkerboard(width, height, a = 0, b = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = (x + y) % 2 === 0 ? a : b;
      const i = (y * width + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

test('a near-black photo is flagged too dark', () => {
  const { data, width, height } = solid(16, 16, 5);
  const a = assessQuality(analyzePixels(data, width, height));
  assert.equal(a.tooDark, true);
  assert.equal(a.ok, false);
});

test('a flat mid-gray photo is flagged blurry but not dark', () => {
  const { data, width, height } = solid(16, 16, 128);
  const a = assessQuality(analyzePixels(data, width, height));
  assert.equal(a.tooDark, false);
  assert.equal(a.tooBlurry, true);
  assert.equal(a.ok, false);
});

test('a bright high-contrast photo passes the pre-check', () => {
  const { data, width, height } = checkerboard(16, 16);
  const a = assessQuality(analyzePixels(data, width, height));
  assert.equal(a.tooDark, false);
  assert.equal(a.tooBlurry, false);
  assert.equal(a.ok, true);
});

test('sharpness for a checkerboard clears the blur threshold with margin', () => {
  const { data, width, height } = checkerboard(16, 16);
  const { sharpness } = analyzePixels(data, width, height);
  assert.ok(sharpness > QUALITY.BLUR_VOL * 10, `expected a large sharpness, got ${sharpness}`);
});

test('tiny images return zeroed metrics instead of throwing', () => {
  const { data, width, height } = solid(2, 2, 128);
  const m = analyzePixels(data, width, height);
  assert.deepEqual(m, { brightness: 0, sharpness: 0 });
});

test('qualityLabel names the worst issue, or null when fine', () => {
  assert.equal(qualityLabel({ ok: false, tooDark: true, tooBlurry: false }), 'Too dark');
  assert.equal(qualityLabel({ ok: false, tooDark: false, tooBlurry: true }), 'Blurry');
  assert.equal(qualityLabel({ ok: true, tooDark: false, tooBlurry: false }), null);
  assert.equal(qualityLabel(null), null);
});
