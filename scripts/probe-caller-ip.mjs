#!/usr/bin/env node
/* Answers, against the real deployment, the one question about the anonymous
   rate limiter that reading the repository cannot: can a caller choose the
   address that becomes their rate-limit identity?
 *
 * Requires the temporary debug-headers function to be deployed with a
 * DEBUG_HEADERS_TOKEN secret set. Delete both when you have the answer.
 *
 *   supabase secrets set DEBUG_HEADERS_TOKEN="$(openssl rand -hex 16)"
 *   supabase functions deploy debug-headers --project-ref jwubrtaacveavbkosgtf --use-api
 *   DEBUG_HEADERS_TOKEN=... SUPABASE_ANON_KEY=... node scripts/probe-caller-ip.mjs
 *
 * It sends nothing that costs money: debug-headers calls no model and writes
 * no rows. The forged values are documentation-range addresses (RFC 5737), so
 * nothing here impersonates a real host.
 */

const REF = process.env.SUPABASE_PROJECT_REF || 'jwubrtaacveavbkosgtf';
const URL_BASE = process.env.SUPABASE_URL || `https://${REF}.supabase.co`;
const TOKEN = process.env.DEBUG_HEADERS_TOKEN;
const ANON = process.env.SUPABASE_ANON_KEY;

if (!TOKEN || !ANON) {
  console.error('Set DEBUG_HEADERS_TOKEN and SUPABASE_ANON_KEY.');
  console.error('The anon key is public (it ships in js/config.js); the debug token is not.');
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
    throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`
      + (res.status === 404 ? ' — wrong or unset DEBUG_HEADERS_TOKEN, or function not deployed' : ''));
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
