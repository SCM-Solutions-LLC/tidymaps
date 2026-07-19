/* Client-side photo quality pre-check. Catches genuinely unusable photos —
   too dark to see, or too blurry/featureless to analyze — before they're sent
   to the vision model, so we can ask for a retake instead of burning an
   analysis call on junk. Deliberately conservative: it only flags clear
   failures, and the warning is advisory (the user can always continue). */

// Thresholds are tuned against a ~160px downscale (see assessImageFile). Mean
// luma is 0..255; sharpness is the mean squared Laplacian response, which sits
// near 0 for flat/blurry frames and in the hundreds-to-thousands for sharp ones.
export const QUALITY = { DARK_MEAN: 42, BLUR_VOL: 8 };

/* Compute brightness (mean luma) and a variance-of-Laplacian sharpness proxy
   from raw RGBA pixel data. Pure: no DOM, so it unit-tests directly. */
export function analyzePixels(data, width, height) {
  const n = width * height;
  if (!n || width < 3 || height < 3) return { brightness: 0, sharpness: 0 };
  const luma = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i] = l;
    sum += l;
  }
  const brightness = sum / n;

  let lapSum = 0, lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width];
      lapSum += lap * lap;
      lapCount++;
    }
  }
  const sharpness = lapCount ? lapSum / lapCount : 0;
  return { brightness, sharpness };
}

/* Turn raw metrics into a verdict. Pure and testable. */
export function assessQuality(metrics) {
  const tooDark = metrics.brightness < QUALITY.DARK_MEAN;
  const tooBlurry = metrics.sharpness < QUALITY.BLUR_VOL;
  return { ...metrics, tooDark, tooBlurry, ok: !tooDark && !tooBlurry };
}

/* Short label for the worst issue, or null if the photo is fine. */
export function qualityLabel(assessment) {
  if (!assessment || assessment.ok) return null;
  if (assessment.tooDark) return 'Too dark';
  if (assessment.tooBlurry) return 'Blurry';
  return null;
}

/* Browser helper: downscale a File to a small canvas and assess it.
   Resolves to null (treated as "no warning") if the image can't be read, so a
   decode failure never blocks the user. */
export function assessImageFile(file, maxEdge = 160) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);
        const metrics = analyzePixels(cx.getImageData(0, 0, w, h).data, w, h);
        resolve(assessQuality(metrics));
      } catch (_) {
        resolve(null); // e.g. a tainted canvas — fail open
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null); };
    img.src = URL.createObjectURL(file);
  });
}
