import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';

const MODEL = 'claude-sonnet-4-6';
const MAX_IMAGES = 6;
const MAX_B64_CHARS = 2_100_000; // ~1.5 MB binary per image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PROMPT_HEAD = `You are TidyMap AI, a practical home-organization assistant. The user has photographed or filmed a storage space (most often a pantry). Analyze ONLY what is visible. Be honest and practical — this is about reorganizing what they already have, not interior design. Do not invent items or features you cannot see.

Return ONLY a JSON object (no markdown, no prose) with exactly these keys:
{
  "spaceType": string,                         // e.g. "Pantry", "Closet"
  "summary": string,                           // 2-3 sentences: what you see + the main organization problem
  "categories": [string],                      // visible item categories, e.g. "Canned goods","Snacks"
  "features": [{"icon": string, "title": string, "sub": string}],  // existing storage features you can see. icon keyword: shelf|basket|bin|door|vertical|horizontal|down|up|hook|empty
  "problems": [string],                        // 3-6 concrete organization problems
  "opportunities": [string],                   // 3-5 quick wins / underused assets
  "map": [{
    "level": string,                           // e.g. "Top shelf"
    "icon": string,                            // up|eye|middle|down|door
    "zone": string,                            // e.g. "Daily snacks · Breakfast items"
    "why": string,
    "eye": boolean,                            // true for the eye-level row
    "shelfIndex": number,                      // 0 = top shelf, counting down; must be < geometry.shelfCount
    "safety": {"flag": "kid-safe"|"keep-high"|"lock-or-latch"|null, "why": string|null},
    "items": [{"name": string, "size": "s"|"m"|"l", "flags": [string]}]  // flags from: heavy|chemical|sharp|fragile|kid-frequent (empty array if none)
  }],
  "geometry": {                                // estimate from the photos if the user gave no dimensions
    "unit": "in", "width": number, "height": number, "depth": number,
    "shelfCount": number,
    "shelfYFracs": [number],                   // vertical position of each shelf top, 0=top of unit, 1=floor, ascending
    "estimated": boolean                       // false only when user-provided dimensions were used
  },
  "safetyNotes": [string],                     // household-specific placement notes in plain language
  "productNeeds": [{
    "type": "clear-bin"|"basket"|"turntable"|"can-riser"|"shelf-riser"|"door-rack"|"airtight-container"|"drawer-organizer"|"hook-rack"|"label-set"|"safety-latch",
    "qty": number,
    "purpose": string,                         // e.g. "Corral loose snack packets"
    "targetZone": string,                      // which map level it belongs to
    "maxDims": {"w_in": number, "h_in": number, "d_in": number} | null,
    "priority": "high"|"nice"
  }],
  "existingLede": string,
  "existing": [{"icon": string, "title": string, "detail": string}],
  "dontBuy": string,
  "steps": [{"task": string, "time": string, "why": string}],   // 6-9 ordered steps, time like "10 min"
  "time": string,                              // total estimate, e.g. "45-90 min"
  "cost": string                               // e.g. "$0 / $40-80"
}

Hard safety rules (apply whenever the household context says kids are present):
- Heavy, chemical, sharp, or fragile items must NEVER be placed below 48 inches when kids ages 0-9 are present, unless that zone is flagged "lock-or-latch".
- Kid-frequent items (snacks, cups, their own things) go on the lowest safe shelf so children can reach them without climbing.
- With "avoid-bending" or "wheelchair" mobility needs, daily-use items belong between 30 and 60 inches.
- Every safety-driven placement must carry a plain-language safety.why (e.g. "Cleaning sprays stay out of reach of your 3-year-old").
Product rules:
- productNeeds.maxDims must fit the available space: depth at most the shelf depth minus 0.5 in clearance. If dimensions are unknown, set maxDims to null.
- Only suggest products that solve a problem you can actually see. Prefer fewer, higher-impact needs.
Keep all text concise and practical. If the images do not show a storage space, still return the JSON with spaceType:"Unclear" and explain in summary.`;

interface Body {
  images: { media_type: string; data: string }[];
  context?: Record<string, unknown>;
}

function buildContext(ctx: Record<string, unknown> = {}): string {
  const parts: string[] = [];
  if (ctx.spaceType) parts.push(`Space the user selected: ${ctx.spaceType}.`);
  if (ctx.goal) parts.push(`Their main goal: ${ctx.goal}.`);
  if (Array.isArray(ctx.prefs) && ctx.prefs.length) parts.push(`Preferences: ${(ctx.prefs as string[]).join(', ')}.`);
  if (ctx.budget) parts.push(`Budget: ${ctx.budget}.`);
  if (ctx.effort) parts.push(`Effort level: ${ctx.effort}.`);
  if (ctx.toggles && typeof ctx.toggles === 'object') {
    const t = Object.entries(ctx.toggles as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(', ');
    if (t) parts.push(`Details: ${t}.`);
  }
  if (ctx.dims && typeof ctx.dims === 'object') {
    parts.push(`User-measured dimensions (inches): ${JSON.stringify(ctx.dims)} — use these for geometry (estimated:false) and product maxDims.`);
  }
  if (ctx.household && typeof ctx.household === 'object') {
    parts.push(`Household: ${JSON.stringify(ctx.household)} — apply the hard safety rules above accordingly.`);
  }
  return parts.join(' ');
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
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > MAX_IMAGES) {
    return json(req, 400, { error: 'images_required', detail: `1-${MAX_IMAGES} images` });
  }
  for (const img of images) {
    if (!img || !ALLOWED_MIME.has(img.media_type) || typeof img.data !== 'string') {
      return json(req, 400, { error: 'bad_image' });
    }
    if (img.data.length > MAX_B64_CHARS) return json(req, 413, { error: 'image_too_large' });
  }

  const admin = adminClient();
  const caller = await getCaller(req);
  try {
    await checkAndLog(admin, 'analyze-space', caller,
      caller.userId ? { perHour: 10, perDay: 30, globalPerDay: 300 }
                    : { perHour: 3, perDay: 6, globalPerDay: 300 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json(req, 429, { error: 'rate_limited', retryAfterSeconds: e.retryAfterSeconds });
    }
    console.error('ratelimit check failed', e);
    return json(req, 500, { error: 'internal' });
  }

  const content: unknown[] = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.media_type, data: img.data },
  }));
  content.push({ type: 'text', text: `${PROMPT_HEAD}\n\nContext: ${buildContext(body.context)}` });

  const requestId = crypto.randomUUID();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('anthropic error', res.status, detail.slice(0, 500));
      return json(req, 502, { error: 'upstream', status: res.status });
    }
    const data = await res.json();
    const txt = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text).join('').trim();
    const a = txt.indexOf('{');
    const b = txt.lastIndexOf('}');
    if (a < 0 || b < 0) return json(req, 502, { error: 'no_json_in_response' });
    let plan: unknown;
    try {
      plan = JSON.parse(txt.slice(a, b + 1));
    } catch {
      return json(req, 502, { error: 'unparseable_json' });
    }
    return json(req, 200, { plan, model: MODEL, requestId });
  } catch (e) {
    console.error('analyze-space failed', requestId, e);
    return json(req, 502, { error: 'upstream_unreachable' });
  }
});
