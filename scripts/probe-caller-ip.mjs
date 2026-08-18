#!/usr/bin/env node
/* Answers, against the real deployment, the one question about the anonymous
   rate limiter that reading the repository cannot: can a caller choose the
   address that becomes their rate-limit identity?
 *
 * Run it from the repository root, with the debug-headers function deployed
 * and its DEBUG_HEADERS_TOKEN secret set:
 *
 *   export DEBUG_HEADERS_TOKEN=$(openssl rand -hex 16)
 *   echo "$DEBUG_HEADERS_TOKEN"                      # keep it; you cannot read it back
 *   supabase secrets set DEBUG_HEADERS_TOKEN="$DEBUG_HEADERS_TOKEN"
 *   node scripts/probe-caller-ip.mjs
 *
 * The project URL and anon key come from js/config.js rather than the
 * environment: they are already committed there (the anon key is public and
 * ships in the browser), so asking for them again is one more thing to get
 * wrong. Only the token is a secret, and only the token has to be passed in.
 *
 * It sends nothing that costs money: debug-headers calls no model and writes
 * no rows. The forged values are documentation-range addresses (RFC 5737), so
 * nothing here impersonates a real host.
 */
import { readFileSync } from 'node:fs';

const TOKEN = process.env.DEBUG_HEADERS_TOKEN;
if (!TOKEN) {
  console.error('DEBUG_HEADERS_TOKEN is not set.\n');
  console.error('It is the value you passed to `supabase secrets set`, and Supabase cannot');
  console.error('read it back — if you generated it inline and did not keep it, set a new one:\n');
  console.error('  export DEBUG_HEADERS_TOKEN=$(openssl rand -hex 16)');
  console.error('  echo "$DEBUG_HEADERS_TOKEN"');
  console.error('  supabase secrets set DEBUG_HEADERS_TOKEN="$DEBUG_HEADERS_TOKEN"');
  process.exit(2);
}

/* Read from the committed config rather than imported, so running this from
   the wrong directory says so instead of failing on a module resolution error
   three frames deep. */
let URL_BASE, ANON;
try {
  const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
  URL_BASE = process.env.SUPABASE_URL || config.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
  ANON = process.env.SUPABASE_ANON_KEY || config.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
} catch {
  console.error('Could not read js/config.js — run this from the repository root:');
  console.error('  node scripts/probe-caller-ip.mjs');
  process.exit(2);
}
if (!URL_BASE || !ANON) {
  console.error('js/config.js has no SUPABASE_URL / SUPABASE_ANON_KEY to read.');
  process.exit(2);
}

async function probe(label, forged) {
  const res = await fetch(`${URL_BASE}/functions/v1/debug-headers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      authorization: `Bearer ${ANON}`,
      'x-debug-token': TOKEN,
      ...forged,
    },
    body: '{}',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 404) {
      /* The function answers 404 to a bad token deliberately — a wrong token
         and no such endpoint are meant to look identical to a stranger. That
         makes this the one error worth spelling out for the person running it,
         because both causes are ordinary and the response cannot tell them
         apart. */
      throw new Error(`${label}: 404.\n\n`
        + 'Either the function is not deployed yet, or DEBUG_HEADERS_TOKEN does not match\n'
        + 'the secret set on the project. They are indistinguishable by design.\n\n'
        + '  deployed?  npx supabase functions list --project-ref jwubrtaacveavbkosgtf\n'
        + '  secret?    supabase secrets list        (shows the name and a digest, never the value)\n\n'
        + 'If you generated the token inline and did not keep it, set a new one and re-run.');
    }
    throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return { label, forged, ...(await res.json()) };
}

/* Documentation-range addresses (RFC 5737 / RFC 3849), and one value that is
   not an address at all but passes the guard callerIp() uses today. */
const CASES = [
  ['baseline — nothing forged', {}],
  ['forged cf-connecting-ip', { 'cf-connecting-ip': '198.51.100.7' }],
  ['forged x-real-ip', { 'x-real-ip': '198.51.100.8' }],
  ['forged x-forwarded-for', { 'x-forwarded-for': '198.51.100.9' }],
  ['forged XFF chain', { 'x-forwarded-for': '198.51.100.10, 203.0.113.5' }],
  ['non-address that passes the guard', { 'x-real-ip': 'deadbeef' }],
  ['forged all three', {
    'cf-connecting-ip': '198.51.100.11',
    'x-real-ip': '198.51.100.12',
    'x-forwarded-for': '198.51.100.13',
  }],
];

const shape = (h) => (h.present === false ? 'absent'
  : `${h.hopCount} hop(s), ${h.hops.map((x) => (x.looksIpv4 ? 'ipv4' : x.looksIpv6 ? 'ipv6' : x.passesCurrentGuard ? 'NOT-AN-ADDRESS' : 'other')).join(' + ')}`);

const results = [];
for (const [label, forged] of CASES) {
  try {
    results.push(await probe(label, forged));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

for (const r of results) {
  console.log(`\n── ${r.label}`);
  for (const [name, h] of Object.entries(r.headers)) {
    if (h.present === false && !(name in r.forged)) continue;
    const sent = name in r.forged ? '  (we sent this)' : '';
    console.log(`   ${name.padEnd(26)} ${shape(h)}${sent}`);
  }
}

/* The verdict. A forged header changes the identity if, and only if, the
   header we sent survived to the function AND the value callerIp() chose has
   the shape we planted. Comparing shapes rather than values keeps real
   addresses out of the output. */
console.log('\n──────── verdict ────────');
const baseline = results[0];
let anyForgeable = false;

for (const r of results.slice(1)) {
  const sentName = Object.keys(r.forged)[0];
  const arrived = r.headers[sentName];
  const survived = arrived && arrived.present !== false;
  // Our planted values are all single-hop; the baseline's may not be.
  const changed = r.chosen.length !== baseline.chosen.length
    || r.chosen.looksIpv4 !== baseline.chosen.looksIpv4
    || r.chosen.empty !== baseline.chosen.empty;
  if (survived && changed) anyForgeable = true;
  console.log(`${survived ? 'PASSED THROUGH' : 'stripped/overwritten'}  ${sentName.padEnd(26)}`
    + `  identity ${changed ? 'CHANGED' : 'unchanged'}`);
}

console.log('');
if (anyForgeable) {
  console.log('BYPASSABLE: a caller can choose their own anonymous rate-limit identity.');
  console.log('Trust only the header the gateway is documented to control, and reject the rest.');
  console.log('Note the per-caller ceilings are what this defeats; the globalPerDay ceilings');
  console.log('in check_and_log_usage still bound total spend.');
} else {
  console.log('NOT BYPASSABLE by these headers: the gateway strips or overwrites them,');
  console.log('or callerIp() ignored them. Record WHICH header proved authoritative in');
  console.log('supabase/functions/_shared/callerIp.js, so the next reader does not re-derive it.');
}
console.log('\nDelete the debug-headers function and unset DEBUG_HEADERS_TOKEN when done.');
