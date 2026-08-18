import { preflight, json } from '../_shared/cors.ts';
import { callerIp } from '../_shared/callerIp.js';

/* TEMPORARY DIAGNOSTIC. Deploy, run scripts/probe-caller-ip.mjs against it,
   read the verdict, then delete the function and this file.

   It exists because one question about this project cannot be answered by
   reading it. callerIp() picks the address that becomes the anonymous
   rate-limit identity, and it prefers cf-connecting-ip / x-real-ip when either
   holds a single well-formed-looking value. A caller can send headers with
   those names. Whether that matters depends entirely on what the Supabase
   gateway does with them before the function runs — whether it strips them,
   overwrites them, or passes them through untouched — and that is a fact about
   the deployment, not about this repository. Every judgement about the
   anonymous ceilings rests on it, and it has been assumed rather than checked.

   The real defect, if the gateway passes them through, is NOT that the regex
   is loose. Tightening it to a strict IPv4/IPv6 validator changes nothing: a
   caller sending 198.51.100.7, then .8, then .9 mints a fresh identity every
   request with perfectly well-formed values. The defect is that no header here
   is known to be gateway-controlled. This tells us which one is.

   SAFETY PROPERTIES, because a diagnostic that leaks is worse than the
   uncertainty it resolves:
   - Refuses to answer without the DEBUG_HEADERS_TOKEN secret, compared in
     constant time. No secret set means the endpoint is inert, so leaving it
     deployed by accident does nothing.
   - Reports only the SHAPE of each value — length, and whether it parses as an
     address — never the value itself. A caller's real IP is personal data and
     is not echoed back, to them or to the logs.
   - Calls no model, touches no table, writes no storage. Nothing here is
     billable and nothing here can be used to exhaust a ceiling. */

const FORWARDING_HEADERS = [
  'cf-connecting-ip',
  'x-real-ip',
  'x-forwarded-for',
  'x-envoy-external-address',
  'true-client-ip',
  'fly-client-ip',
  'forwarded',
];

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

// Constant-time compare, so the token cannot be recovered a byte at a time.
function tokenMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// The shape of a value, never the value. `deadbeef` and a real address must be
// distinguishable in the output without either being printed.
function describe(raw: string) {
  const hops = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    present: true,
    hopCount: hops.length,
    length: raw.length,
    hops: hops.map((h) => ({
      length: h.length,
      looksIpv4: IPV4.test(h),
      looksIpv6: IPV6.test(h) && h.includes(':'),
      // The current guard: what callerIp() would accept. A value that passes
      // this but neither of the above is exactly the 'deadbeef' case.
      passesCurrentGuard: /^[0-9a-fA-F:.]+$/.test(h),
    })),
  };
}

Deno.serve((req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const expected = Deno.env.get('DEBUG_HEADERS_TOKEN') ?? '';
  const given = req.headers.get('x-debug-token') ?? '';
  if (!expected || !tokenMatches(given, expected)) {
    return json(req, 404, { error: 'not_found' });
  }

  const seen: Record<string, unknown> = {};
  for (const name of FORWARDING_HEADERS) {
    const raw = req.headers.get(name);
    seen[name] = raw === null ? { present: false } : describe(raw);
  }

  const chosen = callerIp(req.headers);
  return json(req, 200, {
    headers: seen,
    // Which header callerIp() actually read, and the shape of what it took.
    chosen: {
      length: chosen.length,
      looksIpv4: IPV4.test(chosen),
      looksIpv6: IPV6.test(chosen) && chosen.includes(':'),
      empty: chosen === '',
    },
  });
});
