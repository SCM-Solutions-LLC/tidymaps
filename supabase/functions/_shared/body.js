// Reading a request body as an object, which is what every function here
// assumes it has. Shared with the Node test suite (like callerIp.js) so the
// rule is actually verified rather than asserted about.
//
// `await req.json()` was wrapped in a try/catch for malformed JSON and then
// trusted — but JSON.parse succeeds just as readily on `null`, on `4`, on
// `"hi"` and on `[]`. Every one of those reached the property access on the
// next line, and `body.images` on a null body throws a TypeError the runtime
// turns into a 500.
//
// A client sending the wrong shape is a 400. Reporting it as a 500 blames the
// server for the caller's mistake, and buries the real 500s in the logs behind
// noise anyone can generate on demand.
//
// Arrays are rejected with everything else: `typeof [] === 'object'`, but no
// function here takes a top-level array, and `body.kind` on one is silently
// undefined rather than an error — which is worse than a rejection, because it
// falls through to whatever the missing-field branch does.
//
// req.json() used to run before any auth or rate-limit check — every caller
// here does readJsonObject() first and checks who is asking only after. A
// body far larger than anything a real client sends still got fully read and
// JSON-parsed before anyone asked whether the caller was even allowed to be
// here, which is CPU and memory an unauthenticated request can spend on
// demand. analyze-space's own legitimate worst case is 6 images at 2.1M
// base64 chars each (MAX_B64_CHARS there) plus JSON overhead, so the cap
// below sits comfortably above that and still rejects anything wildly
// larger, cheaply, before req.json() ever runs. A request without a
// Content-Length (chunked transfer-encoding) cannot be checked this way and
// falls through to the parse below, same as before.
const MAX_BODY_BYTES = 16_000_000;

export async function readJsonObject(req) {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;
  let parsed;
  try {
    parsed = await req.json();
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}
