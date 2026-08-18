// Deriving the caller's address from proxy headers, shared by the edge
// functions and the Node test suite so the rule is actually verified.
//
// This address becomes the anonymous rate-limit identity in
// check_and_log_usage. On analyze-space the anonymous ceiling is 3/hour and
// 6/day, guarding a key billed for 70-90 seconds of model time per call, so a
// caller who can choose their own address can choose their own ceiling.
//
// ---------------------------------------------------------------------------
// MEASURED AGAINST THE DEPLOYMENT, 2026-08-18 — not assumed.
//
// Which of these headers a client can actually control is a fact about the
// gateway, not about this file, and it had been reasoned about rather than
// tested. A temporary diagnostic function was deployed and sent deliberately
// forged headers. Cloudflare fronts the Supabase functions, and:
//
//   cf-connecting-ip   the REQUEST IS REJECTED, 403, before the function runs.
//                      A client cannot send this header at all. Cloudflare
//                      sets it itself: it arrived as a single IPv4 address on
//                      every request that was allowed through.
//   x-real-ip          STRIPPED. Absent at the function on every request,
//                      including ones that sent it. Never present in baseline
//                      either, so it was a preference that never fired.
//   x-forwarded-for    OVERWRITTEN. Present, but a forged value never appears
//                      in it: the chain arrived with the same hop count as a
//                      request that sent none, so the client's entry is not
//                      carried through. The last hop is the trusted one
//                      regardless, which is what is read below.
//
// The identity did not move for any forged header. The anonymous ceiling is
// NOT bypassable this way on this deployment.
//
// WHAT WOULD INVALIDATE THIS: moving off Cloudflare or Supabase Edge
// Functions, or putting a different proxy in front. Re-run the probe (it is
// in the history of this file's PR) before trusting any header again.
// ---------------------------------------------------------------------------
//
// x-real-ip is deliberately NOT trusted, despite being stripped today. Its
// being stripped is the gateway's doing, not ours, and the day the gateway
// changes it becomes a header any client can set to anything — at which point
// this file would hand an attacker the identity of their choice, silently and
// with nothing failing. Trusting only what has been shown to be
// gateway-controlled costs nothing here, because the header never arrives.
const TRUSTED_SINGLE_VALUE_HEADER = 'cf-connecting-ip';

// X-Forwarded-For grows left to right: each proxy APPENDS the address of the
// peer it received the request from, so entry [0] is whatever the client sent
// and the LAST entry is the one our own edge wrote. This is the fallback for a
// deployment with no cf-connecting-ip, where it is the only honest signal.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/* A real address rather than the old /^[0-9a-fA-F:.]+$/, which accepted
   `deadbeef`. Worth correcting, but worth being clear about what it is: a
   sanity check on a value the gateway sets, not the thing that makes that
   value trustworthy. Tightening this alone would never have fixed a forgeable
   header — a caller rotating 198.51.100.7, .8, .9 mints a fresh identity every
   request with perfectly well-formed values. */
function isAddress(value) {
  if (IPV4.test(value)) return true;
  // IPv6, loosely: hex groups separated by colons, with an optional
  // IPv4-mapped tail. Not a full RFC 4291 parser, and does not need to be.
  return value.includes(':') && /^[0-9a-fA-F:.]+$/.test(value) && value.split(':').length <= 9;
}

export function callerIp(headers) {
  const get = (name) => (headers && typeof headers.get === 'function' ? headers.get(name) : null) ?? '';

  const single = String(get(TRUSTED_SINGLE_VALUE_HEADER)).trim();
  // One address, not a chain: a comma means someone smuggled a list through a
  // header that is supposed to carry a single value, and it is ignored rather
  // than parsed.
  if (single && !single.includes(',') && isAddress(single)) return single;

  const hops = String(get('x-forwarded-for')).split(',').map((s) => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : '';
}
