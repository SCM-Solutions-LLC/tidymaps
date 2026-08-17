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

export async function readJsonObject(req) {
  let parsed;
  try {
    parsed = await req.json();
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}
