// Deriving the caller's address from proxy headers, shared by the edge
// functions and the Node test suite so the rule is actually verified.
//
// X-Forwarded-For grows left to right: each proxy APPENDS the address of the
// peer it received the request from. So for a request that crossed one trusted
// edge, the header reads "<whatever the client sent>, <address the edge saw>".
//
// Reading entry [0] therefore reads a value the caller chose. A caller who
// varies that header per request mints a fresh rate-limit identity every time
// and walks straight past the anonymous ceilings in check_and_log_usage — on
// analyze-space that is 3/hour and 6/day guarding an Anthropic key that is
// billed for 70-90 seconds of work per call. The last entry is the one the
// trusted hop appended and the caller cannot forge.

export function callerIp(headers) {
  const raw = (headers && typeof headers.get === 'function'
    ? headers.get('x-forwarded-for')
    : null) ?? '';
  const hops = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  // Last hop = added by our own edge. Anything earlier is caller-supplied.
  return hops.length ? hops[hops.length - 1] : '';
}
