/* First-party anonymous usage telemetry. One purpose: answer the core
   product question — do people who actually work a plan (>= 3 steps checked)
   say they'd pay for a detailed version?

   Privacy posture, matching the privacy page:
   - Events come from a fixed allowlist with flat primitive props only; the
     shared sanitizer (also enforced server-side) makes free text, photos,
     and structured personal data unrepresentable.
   - anon_id is a random UUID in localStorage, linked to nothing.
   - Respects Do Not Track / Global Privacy Control, and disables itself
     under automation (navigator.webdriver) so CI never emits events.
   - Fire-and-forget: telemetry must never break or slow the app. */
import { SUPABASE_URL, SUPABASE_ANON_KEY, backendConfigured } from './config.js';
import { sanitizeEvent } from '../supabase/functions/_shared/telemetryEvents.js';

const ANON_KEY = 'tidymap_anon_v1';
const FLUSH_MS = 4000;
const FLUSH_AT = 12; // keep batches under the server's 25-event cap

function optedOut() {
  try {
    /* No DOM means no user. `node --test` imports this module transitively
       (js/db.js calls track on a successful insert), and a Node process has a
       global `navigator` since v21 but no `webdriver` on it — so the check
       below did not catch it. Every unit-test run that exercised the save
       path POSTed two real `space_saved` events to production; sixty-six
       reached the table before anyone noticed, each with a null anon_id
       because a Node process has no localStorage either. That is the exact
       column the funnel is read by, so the junk was both loud and unjoinable.
       Telemetry is a browser feature: asking for a document is asking whether
       there is a session at all. */
    if (typeof document === 'undefined') return true;        // not a browser
    if (navigator.webdriver) return true;                    // CI / robots
    /* Both are real signals the lib.dom typings do not carry: doNotTrack is
       legacy, globalPrivacyControl is newer than the typings. Read through a
       cast rather than dropped — a privacy opt-out is not the place to defer
       to a type definition. */
    const nav = /** @type {any} */ (navigator);
    const win = /** @type {any} */ (window);
    if (nav.doNotTrack === '1' || win.doNotTrack === '1') return true;
    if (nav.globalPrivacyControl) return true;
  } catch (_) { /* privacy checks must never throw */ }
  return false;
}

export function telemetryEnabled() {
  return backendConfigured() && !optedOut();
}

/* Why telemetry is or isn't running, in one string.

   Events stopped arriving on 2026-07-23 and it took a week and a database
   audit to establish that nothing was broken: the browser was sending Global
   Privacy Control (Brave, DuckDuckGo and Firefox all do by default), optedOut()
   was correctly returning true, and no request was ever made. From the outside
   that is indistinguishable from a dead pipeline. Exposing the reason on
   window means the next person answers it from the console in one line. */
export function telemetryStatus() {
  if (!backendConfigured()) return 'off: backend not configured';
  try {
    if (typeof document === 'undefined') return 'off: no document (not a browser)';
    if (navigator.webdriver) return 'off: automation (navigator.webdriver)';
    // Same two signals as optedOut, and absent from lib.dom for the same reason.
    const nav = /** @type {any} */ (navigator);
    const win = /** @type {any} */ (window);
    if (nav.doNotTrack === '1' || win.doNotTrack === '1') return 'off: Do Not Track';
    if (nav.globalPrivacyControl) return 'off: Global Privacy Control';
  } catch (_) { /* privacy checks must never throw */ }
  return 'on';
}

function anonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch (_) {
    return null; // storage blocked: events go out unlinked
  }
}

let queue = [];
let timer = null;

async function send(events) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/track-events`, {
      method: 'POST',
      keepalive: true, // survives page hides/unloads for the final batch
      headers: {
        'content-type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ anonId: anonId(), events }),
    });
  } catch (_) { /* dropped events are acceptable; retries are not worth it */ }
}

export function flush() {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  const batch = queue; queue = [];
  send(batch);
}

export function track(name, props) {
  if (!telemetryEnabled()) return;
  const ev = sanitizeEvent({ name, props });
  if (!ev) return; // outside the allowlist: refuse to send rather than guess
  queue.push(ev);
  if (queue.length >= FLUSH_AT) { flush(); return; }
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// The last batch of a session matters most (feedback, final checkoffs).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
