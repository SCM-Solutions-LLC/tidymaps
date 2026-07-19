/* Imagery manifest resolver. The manifest (data/images.json) is the single
   source of truth for every keyed photo/screenshot the app shows: its file,
   alt text, license, and whether it's ready to ship. tests/images.test.mjs
   validates the manifest and the pages that reference it at build time, so a
   missing or broken key fails CI instead of 404ing in a user's browser. */

let manifest = null;

// Loads and caches the manifest. Returns null on failure so callers can leave
// the page's declarative <img src> + onerror fallback in charge (progressive
// enhancement: the site still works with JS off or the manifest unreachable).
export async function loadImages() {
  if (manifest) return manifest;
  try {
    const res = await fetch('data/images.json');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.images !== 'object') return null;
    manifest = data;
    return manifest;
  } catch (_) {
    return null;
  }
}

export function imageFor(key) {
  return (manifest && manifest.images[key]) || null;
}

/* Drive every [data-img] element in `root` from the manifest, keeping it the
   single source of truth for ready images' src and alt. Pending or unknown
   keys are left alone so the page's own declarative <img src> + onerror
   fallback (the design-owned graceful collapse for not-yet-shot art) stays in
   charge. No-ops entirely if the manifest can't be loaded. */
export async function hydrateImages(root = document) {
  const els = [...root.querySelectorAll('[data-img]')];
  if (!els.length) return;
  const man = await loadImages();
  if (!man) return; // fall back to the page's own src/onerror
  els.forEach((el) => {
    const entry = man.images[el.dataset.img];
    if (!entry || entry.status !== 'ready') return; // pending: leave onerror in charge
    if (el.tagName === 'IMG') {
      if (entry.file) el.setAttribute('src', entry.file);
      if (entry.alt) el.setAttribute('alt', entry.alt);
    }
  });
}
