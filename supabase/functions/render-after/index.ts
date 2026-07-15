import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const MAX_B64_CHARS = 2_100_000;
const MAX_INSTRUCTIONS = 4000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface Body {
  image: { media_type: string; data: string };
  instructions: string;
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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'invalid_json' });
  }
  const img = body.image;
  if (!img || !ALLOWED_MIME.has(img.media_type) || typeof img.data !== 'string') {
    return json(req, 400, { error: 'bad_image' });
  }
  if (img.data.length > MAX_B64_CHARS) return json(req, 413, { error: 'image_too_large' });
  if (typeof body.instructions !== 'string' || !body.instructions.trim()) {
    return json(req, 400, { error: 'instructions_required' });
  }
  const instructions = body.instructions.slice(0, MAX_INSTRUCTIONS);

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
  if (body.spaceId && caller.userId) {
    const { data, error } = await admin.from('spaces')
      .select('id').eq('id', body.spaceId).eq('user_id', caller.userId).maybeSingle();
    if (error) {
      console.error('ownership check failed', error);
      return json(req, 500, { error: 'internal' });
    }
    if (!data) return json(req, 403, { error: 'not_your_space' });
    spaceOwned = true;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
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
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error('gemini error', res.status, detail.slice(0, 500));
      return json(req, 502, { error: 'upstream', status: res.status });
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: Record<string, unknown>) => p.inline_data || p.inlineData);
    if (!imagePart) return json(req, 502, { error: 'no_image_returned' });
    const inline = imagePart.inline_data ?? imagePart.inlineData;
    const outMime: string = inline.mime_type ?? inline.mimeType ?? 'image/png';
    const outB64: string = inline.data;

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
        await admin.from('spaces').update({ after_render_path: storagePath }).eq('id', body.spaceId);
        await admin.from('space_media').insert({
          space_id: body.spaceId, user_id: caller.userId,
          kind: 'after_render', storage_path: storagePath, sort: 999,
        });
      }
    }
    return json(req, 200, { image: { media_type: outMime, data: outB64 }, storagePath });
  } catch (e) {
    console.error('render-after failed', e);
    return json(req, 502, { error: 'upstream_unreachable' });
  }
});
