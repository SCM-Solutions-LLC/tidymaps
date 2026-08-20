import { preflight, json } from '../_shared/cors.ts';
import { readJsonObject } from '../_shared/body.js';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';
import { buildRenderBrief } from '../_shared/renderBrief.js';

const GEMINI_MODEL = 'gemini-2.5-flash-image';
/* Two limits, because they are two different questions.

   IN is what a caller may send us: the client scales and re-encodes to JPEG
   before upload, so anything near this is a client that has stopped doing
   that, or is not our client at all.

   OUT is a backstop against a pathological upstream response, and it has to
   be sized against what the model actually returns. It was not: both used one
   2.1M constant, and gemini-2.5-flash-image returns ~3.2-3.4M base64 chars for
   a normal 1024px render. Measured on four consecutive production attempts,
   2026-08-19: 3_227_852, 3_370_040, 3_314_168, 3_428_884. Every one was over,
   so every render this feature has ever attempted was rejected by its own
   guard and returned 502 upstream_image_too_large. Nothing caught it, because
   the test pinned that the check exists rather than that it can pass, and CI
   cannot reach the real API.

   8M chars is ~6MB decoded — far above anything observed, still finite. */
const MAX_IN_B64_CHARS = 2_100_000;
const MAX_OUT_B64_CHARS = 8_000_000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* The upstream call had no deadline at all. Supabase kills a function at its
   wall-clock limit with a bare 546 and no body, and js/api.js gives up on this
   one at 90s — so a Gemini call that hung left the client showing its own
   error while the function ran on, still holding the render allowance this
   caller had already spent, and still able to write a storage object nobody
   would ever be shown. The budget sits below the client's so the server's own
   answer is the one the user reads, which is the same arrangement
   analyze-space uses. */
const RENDER_BUDGET_MS = 75_000;

/* What may come back and be treated as a picture. Standard base64: no data:
   URL prefix, no newlines, no whitespace — atob accepts some of that and
   Supabase storage would accept anything, so the check is here rather than
   left to whichever consumer chokes first. */
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

interface Body {
  image: { media_type: string; data: string };
  zones?: unknown;
  spaceId?: string | null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const parsed = await readJsonObject(req);
  if (!parsed) return json(req, 400, { error: 'invalid_body' });
  const body = parsed as unknown as Body;
  const img = body.image;
  if (!img || !ALLOWED_MIME.has(img.media_type) || typeof img.data !== 'string') {
    return json(req, 400, { error: 'bad_image' });
  }
  if (img.data.length > MAX_IN_B64_CHARS) return json(req, 413, { error: 'image_too_large' });
  if (!B64_RE.test(img.data)) return json(req, 400, { error: 'bad_image' });
  /* The brief is composed here from the zone list, never taken as text from
     the caller — see _shared/renderBrief.js. `instructions` from an older
     client is deliberately ignored rather than rejected: that request still
     gets a render, just a generic one, instead of an error on a button that
     worked a minute ago. */
  const instructions = buildRenderBrief(body.zones);

  const admin = adminClient();
  const caller = await getCaller(req);
  try {
    await checkAndLog(admin, 'render-after', caller,
      caller.userId ? { perHour: 3, perDay: 5, globalPerDay: 100 }
                    : { perHour: 1, perDay: 1, globalPerDay: 100 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(req, 429, { error: 'rate_limited', retryAfterSeconds: e.retryAfterSeconds });
    }
    console.error('ratelimit check failed', e);
    return json(req, 500, { error: 'internal' });
  }

  // Ownership check up front so we fail before spending on the render
  let spaceOwned = false;
  let previousRenderPath: string | null = null;
  if (body.spaceId && caller.userId) {
    const { data, error } = await admin.from('spaces')
      .select('id,after_render_path').eq('id', body.spaceId)
      .eq('user_id', caller.userId).is('deleting_at', null).maybeSingle();
    if (error) {
      console.error('ownership check failed', error);
      return json(req, 500, { error: 'internal' });
    }
    if (!data) return json(req, 403, { error: 'not_your_space' });
    spaceOwned = true;
    previousRenderPath = data.after_render_path ?? null;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        // Cancels the upstream request rather than only giving up on it: an
        // abandoned socket to Gemini keeps costing until it is closed.
        signal: AbortSignal.timeout(RENDER_BUDGET_MS),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': Deno.env.get('GOOGLE_AI_API_KEY') ?? '',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: img.media_type, data: img.data } },
              { text: instructions },
            ],
          }],
          /* IMAGE only. With TEXT permitted the model has a legal way to
             answer an edit it finds ambiguous by narrating what it would do
             and handing back something close to the input alongside the
             prose. Google's current guidance for this surface is to ask for
             the modality you actually want. Nothing here consumed the text
             part: the parse below scans for the first inline_data. */
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error('gemini error', res.status, detail.slice(0, 500));
      let reason = '';
      let message = '';
      try {
        const parsed = JSON.parse(detail);
        message = typeof parsed?.error?.message === 'string' ? parsed.error.message : '';
        reason = parsed?.error?.details?.find(
          (item: Record<string, unknown>) => typeof item?.reason === 'string',
        )?.reason ?? '';
      } catch {
        // Keep the public response stable even if Google returns non-JSON.
      }
      if (reason.includes('API_KEY') || /api[-\s]?key/i.test(message)) {
        return json(req, 503, { error: 'preview_misconfigured' });
      }
      if (res.status === 429 || reason === 'RATE_LIMIT_EXCEEDED') {
        return json(req, 503, { error: 'upstream_quota' });
      }
      if (res.status === 400) {
        return json(req, 502, { error: 'upstream_invalid_request' });
      }
      return json(req, 502, { error: 'upstream', status: res.status });
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: Record<string, unknown>) => p.inline_data || p.inlineData);
    if (!imagePart) {
      /* The model's only channel for explaining a refusal — a safety block, a
         truncated candidate — and this branch used to log nothing at all, so a
         silent 502 left no trace of why. */
      console.error('gemini returned no image',
        'finishReason=', data?.candidates?.[0]?.finishReason ?? 'none',
        'promptFeedback=', JSON.stringify(data?.promptFeedback ?? null).slice(0, 300));
      return json(req, 502, { error: 'no_image_returned' });
    }
    const inline = imagePart.inline_data ?? imagePart.inlineData;
    const outMime: string = inline.mime_type ?? inline.mimeType ?? 'image/png';
    const outB64: unknown = inline.data;

    /* Nothing checked what came back. The type was whatever Gemini said it
       was and went straight into storage as the object's content-type; the
       payload went to `atob`, which throws on malformed input and would have
       surfaced as "upstream_unreachable" — the one error message that is
       certainly wrong; and there was no size limit anywhere, so an oversized
       result was uploaded, written to the space's pointer, and then sent to a
       phone. Checked before any of that happens. */
    if (!ALLOWED_MIME.has(outMime)) {
      console.error('gemini returned an unusable type', outMime);
      return json(req, 502, { error: 'bad_upstream_image' });
    }
    if (typeof outB64 !== 'string' || !outB64 || !B64_RE.test(outB64)) {
      console.error('gemini returned a malformed image payload');
      return json(req, 502, { error: 'bad_upstream_image' });
    }
    if (outB64.length > MAX_OUT_B64_CHARS) {
      console.error('gemini returned an oversized image', outB64.length);
      return json(req, 502, { error: 'upstream_image_too_large' });
    }

    let storagePath: string | null = null;
    if (spaceOwned && body.spaceId && caller.userId) {
      const ext = outMime === 'image/jpeg' ? 'jpg' : 'png';
      storagePath = `${caller.userId}/${body.spaceId}/after/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage.from('space-media')
        .upload(storagePath, b64ToBytes(outB64), { contentType: outMime });
      if (upErr) {
        console.error('render upload failed', upErr);
        storagePath = null; // render still returned to the client
      } else {
        const { error:metadataError } = await admin.from('space_media').insert({
          space_id: body.spaceId,
          user_id: caller.userId,
          kind: 'after_render',
          storage_path: storagePath,
          sort: 999,
        });
        if (metadataError) {
          console.error('render metadata insert failed', metadataError);
          await admin.storage.from('space-media').remove([storagePath]);
          storagePath = null;
        } else {
          let pointerUpdate = admin.from('spaces')
            .update({ after_render_path: storagePath })
            .eq('id', body.spaceId)
            .eq('user_id', caller.userId)
            .is('deleting_at', null);
          pointerUpdate = previousRenderPath === null
            ? pointerUpdate.is('after_render_path', null)
            : pointerUpdate.eq('after_render_path', previousRenderPath);
          const { data:pointerRow, error:updateError } = await pointerUpdate
            .select('id').maybeSingle();
          if (updateError || !pointerRow) {
            console.error('render pointer update failed or was superseded', updateError);
            await admin.from('space_media').delete().eq('storage_path', storagePath);
            await admin.storage.from('space-media').remove([storagePath]);
            storagePath = null;
          } else if (previousRenderPath && previousRenderPath !== storagePath) {
            const { error:removeError } = await admin.storage.from('space-media')
              .remove([previousRenderPath]);
            if (removeError) {
              console.error('previous render cleanup failed', removeError);
            } else {
              await admin.from('space_media').delete().eq('storage_path', previousRenderPath);
            }
          }
        }
      }
    }
    return json(req, 200, { image: { media_type: outMime, data: outB64 }, storagePath });
  } catch (e) {
    /* A deadline is not an outage, and the two used to answer identically.
       504 is what js/api.js reads as a timeout, so the user is told the
       preview took too long rather than that the service is unreachable. */
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      console.error('render-after timed out after', RENDER_BUDGET_MS, 'ms');
      return json(req, 504, { error: 'upstream_timeout' });
    }
    console.error('render-after failed', e);
    return json(req, 502, { error: 'upstream_unreachable' });
  }
});
