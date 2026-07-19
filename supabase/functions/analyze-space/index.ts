import { preflight, json } from '../_shared/cors.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { checkAndLog, RateLimitError } from '../_shared/ratelimit.ts';
import { validatePlan } from '../_shared/planSchema.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_ATTEMPTS = 2;
const MAX_IMAGES = 6;
const MAX_B64_CHARS = 2_100_000; // ~1.5 MB binary per image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PROMPT_HEAD = `You are TidyMap AI, a practical home-organization assistant. The user has photographed or filmed a storage space — a pantry, closet (reach-in or walk-in), cabinet, drawer bank, garage shelving, laundry area, fridge, or anything else — in ANY configuration: straight runs, L- or U-shaped, corner units, multiple bays or freestanding units, pull-outs, carousels, or mixed shelves, drawers, rods, and hooks. Analyze ONLY what is visible. Be honest and practical — this is about reorganizing what they already have, not interior design. Do not invent items or features you cannot see.

Return ONLY a JSON object (no markdown, no prose) with exactly these keys:
{
  "spaceType": string,                         // e.g. "Pantry", "Closet"
  "summary": string,                           // 2-3 sentences: what you see + the main organization problem
  "categories": [string],                      // visible item categories, e.g. "Canned goods","Snacks"
  "features": [{"icon": string, "title": string, "sub": string}],  // existing storage features you can see. icon keyword: shelf|basket|bin|drawer|door|vertical|horizontal|down|up|hook|rod|empty|missing
  "problems": [string],                        // 3-6 concrete organization problems
  "opportunities": [string],                   // 3-5 quick wins / underused assets
  "map": [{
    "level": string,                           // e.g. "Top shelf"
    "icon": string,                            // up|eye|middle|down|door|hook|rod|drawer
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

Layout & geometry rules — handle ANY space configuration:
- ALWAYS estimate geometry from the photos when the user gave no dimensions: judge width, height, and depth in inches from visible reference objects (cans ~4.5in tall, cereal boxes ~12in, standard shelving ~11-16in deep) and count the visible storage levels. Set estimated:true. Never omit geometry or return zeros.
- The map is a flat list of levels; project EVERY real-world layout into it: one map row per distinct storage level or section, shelfIndex counting 0,1,2,... from the top down (or in walking order for multi-wall spaces), shelfCount = number of map rows, and geometry = the overall envelope (total run width, tallest height, deepest depth).
- Name every level so the user recognizes the physical spot, using a colon locator for multi-part spaces: "Back wall: eye level", "Left run: top shelf", "Corner carousel", "Pull-out rack 2", "Hanging rod", "Drawer 3 of 4", "Cabinet floor", "Door rack".
- L-shaped, U-shaped, corner, or multi-wall spaces (walk-in closets/pantries, garages): work wall by wall in walking order (left wall, back wall, right wall), prefix each level with its wall, and state the layout in summary.
- Drawer banks: one level per drawer, top to bottom; geometry.height = the drawer-bank height. Corner drawers and angled units are still one level each.
- Rotating or sliding hardware (lazy susans, corner carousels, pull-out racks and baskets, slide-out pantries): each is its own level named for what it is; treat its usable surface like a shelf.
- Closets with rods: a hanging rod is its own level (e.g. "Hanging rod: long items"); shelves above or below it get their own rows.
- Mixed spaces (shelves + drawers + floor + hooks + door racks): include every distinct storage surface as its own level, ordered top to bottom.
- Multiple freestanding units side by side: treat them as one combined run, left to right, and prefix levels with the unit ("Unit 2: middle shelf").
- If a space has more than 10 distinct levels, group the least-used surfaces into a single "Bulk storage" row so the plan stays actionable.

Hard safety rules (apply whenever the household context says kids are present):
- Heavy, chemical, sharp, or fragile items must NEVER be placed below 48 inches when kids ages 0-9 are present, unless that zone is flagged "lock-or-latch".
- Kid-frequent items (snacks, cups, their own things) go on the lowest safe shelf so children can reach them without climbing.
- With "avoid-bending" or "wheelchair" mobility needs, daily-use items belong between 30 and 60 inches.
- Every safety-driven placement must carry a plain-language safety.why (e.g. "Cleaning sprays stay out of reach of your 3-year-old").
Product rules:
- productNeeds.maxDims must fit the available space: depth at most the shelf depth minus 0.5 in clearance. If dimensions are unknown, set maxDims to null.
- Only suggest products that solve a problem you can actually see. Prefer fewer, higher-impact needs.
Writing style for ALL user-facing text (summary, whys, steps, problems, everything): plain, friendly, everyday words. Short sentences. Write like a helpful friend, not a designer. NEVER use an em dash (—) anywhere; use a period, comma, or colon instead.
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

  type ModelResult =
    | { ok: true; rawText: string; plan: unknown }
    | { ok: false; retryable: boolean; status: number; error: string; detail: string };

  async function callModelOnce(messages: unknown[]): Promise<ModelResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 8192, messages }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, retryable: false, status: 502, error: 'upstream', detail: detail.slice(0, 300) };
    }
    const data = await res.json();
    const txt = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text).join('').trim();
    if (data.stop_reason === 'max_tokens') {
      return { ok: false, retryable: true, status: 502, error: 'truncated', detail: 'model output hit the token limit' };
    }
    const a = txt.indexOf('{');
    const b = txt.lastIndexOf('}');
    if (a < 0 || b < 0) {
      return { ok: false, retryable: true, status: 502, error: 'no_json_in_response', detail: txt.slice(0, 200) };
    }
    try {
      return { ok: true, rawText: txt, plan: JSON.parse(txt.slice(a, b + 1)) };
    } catch {
      return { ok: false, retryable: true, status: 502, error: 'unparseable_json', detail: txt.slice(-200) };
    }
  }

  try {
    let messages: unknown[] = [{ role: 'user', content }];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await callModelOnce(messages);
      const isLastAttempt = attempt === MAX_ATTEMPTS - 1;

      if (!result.ok) {
        console.error('analyze-space model call failed', requestId, attempt, result.error, result.detail.slice(0, 200));
        if (!result.retryable || isLastAttempt) {
          return json(req, result.status, { error: result.error, detail: result.detail });
        }
        messages = [
          ...messages,
          { role: 'assistant', content: result.detail || '(empty response)' },
          { role: 'user', content: 'That was not a single valid JSON object. Return ONLY the JSON object described above, with no markdown fences and no other text.' },
        ];
        continue;
      }

      const validation = validatePlan(result.plan, body.context ?? {});
      if (validation.ok) {
        return json(req, 200, { plan: validation.value, model: MODEL, requestId });
      }

      console.error('analyze-space plan validation failed', requestId, attempt, validation.errors);
      if (isLastAttempt) {
        return json(req, 502, { error: 'validation_failed', detail: validation.errors.slice(0, 8) });
      }
      messages = [
        ...messages,
        { role: 'assistant', content: result.rawText },
        {
          role: 'user',
          content: `Your JSON had these problems:\n- ${validation.errors.join('\n- ')}\n\nReturn ONLY the corrected JSON object with the same schema, fixing every listed problem. Do not introduce new ones.`,
        },
      ];
    }
    // Unreachable: the loop above always returns on its last attempt.
    return json(req, 502, { error: 'internal' });
  } catch (e) {
    console.error('analyze-space failed', requestId, e);
    return json(req, 502, { error: 'upstream_unreachable' });
  }
});
