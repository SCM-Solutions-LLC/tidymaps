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

// Single-value headers the edge sets itself. These carry one address rather
// than a chain, so there is nothing for a caller to prepend, and they are
// preferred where present. A caller CAN send these names too, which is why
// they are only trusted when they hold exactly one well-formed address —
// a forged chain smuggled through one of them is ignored.
const SINGLE_VALUE_HEADERS = ['cf-connecting-ip', 'x-real-ip'];
const ADDRESS_RE = /^[0-9a-fA-F:.]+$/;

export function callerIp(headers) {
  const get = (name) => (headers && typeof headers.get === 'function' ? headers.get(name) : null) ?? '';

  for (const name of SINGLE_VALUE_HEADERS) {
    const value = String(get(name)).trim();
    if (value && !value.includes(',') && ADDRESS_RE.test(value)) return value;
  }

  const hops = String(get('x-forwarded-for')).split(',').map((s) => s.trim()).filter(Boolean);
  // Last hop = appended by our own edge, naming the peer it received from.
  // Anything to the left of it is whatever the caller chose to send.
  return hops.length ? hops[hops.length - 1] : '';
}
