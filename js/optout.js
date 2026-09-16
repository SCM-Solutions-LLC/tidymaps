/* One place that decides what "opted out" means in this browser.

   Two consumers agree by importing from here rather than by typing the
   string twice: js/telemetry.js reads the flag on every track() call, and
   the toggle on cookies.html writes it. The key name and the shape of its
   value are the whole contract.

   Written to be safe to import from any environment: a Node process (unit
   tests, or a stray call from js/db.js) has no localStorage and every read
   and write returns the default rather than throwing, matching the pattern
   the rest of the telemetry code already uses. */

export const OPTOUT_KEY = 'tidymap_optout_v1';
/* Kept alongside so opt-out can drop the anonymous id in the same call.
   telemetry.js imports this constant instead of typing it again. */
export const ANON_KEY = 'tidymap_anon_v1';

function storage() {
  try {
    // Reading `localStorage` in a page that blocks site storage throws on
    // access, so the try wraps the property read, not just its methods.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_) { return null; }
}

export function isOptedOut() {
  const s = storage();
  if (!s) return false;
  try { return s.getItem(OPTOUT_KEY) === 'off'; }
  catch (_) { return false; }
}

/* Turning it OFF also clears the anonymous id: a fresh opt-in later starts a
   new one rather than carrying the old one through the opt-out. Turning it
   ON removes the flag rather than storing 'on', so the default state and a
   "I turned it back on" state read identically the next time. */
export function setOptedOut(off) {
  const s = storage();
  if (!s) return false;
  try {
    if (off) {
      s.setItem(OPTOUT_KEY, 'off');
      s.removeItem(ANON_KEY);
    } else {
      s.removeItem(OPTOUT_KEY);
    }
    return true;
  } catch (_) { return false; }
}
