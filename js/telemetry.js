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
    if (navigator.webdriver) return true;                    // CI / robots
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    if (navigator.globalPrivacyControl) return true;
  } catch (_) { /* privacy checks must never throw */ }
  return false;
}

export function telemetryEnabled() {
  return backendConfigured() && !optedOut();
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
