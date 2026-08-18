import { SUPABASE_URL, SUPABASE_ANON_KEY, backendConfigured } from './config.js';

export class ApiError extends Error {
  constructor(message, opts = {}){
    super(message);
    this.code = opts.code || 'unknown';
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
  }
}

/* The auth token getter is injected once accounts exist, so this module
   never hard-depends on supabase-js. Anonymous calls use the anon key. */
let getAuthToken = () => null;
export function setAuthTokenGetter(fn){ getAuthToken = fn; }

/* Every call gets a deadline. A request that never returns leaves the loading
   screen spinning with no way out, which is worse than a plan we can fall back
   to. Each budget sits just above what the function allows itself, so the
   server's own timeout is what the user normally sees. */
const TIMEOUT_MS = {
  'analyze-space': 125000,     // the function budgets itself to 100s
  'render-after': 90000,
  'get-shared-space': 20000,
};
const DEFAULT_TIMEOUT_MS = 30000;

/* The caller's own signal is combined with the deadline rather than replacing
   it, so abandoning a request (the user changed an answer and started a new
   analysis) stops the old one without giving up the timeout on the new. */
function requestSignal(name, signal){
  const deadline = AbortSignal.timeout(TIMEOUT_MS[name] || DEFAULT_TIMEOUT_MS);
  if(!signal) return deadline;
  return (typeof AbortSignal.any === 'function') ? AbortSignal.any([deadline, signal]) : deadline;
}

/**
 * @param {string} name
 * @param {unknown} body
 * @param {{signal?: AbortSignal}} [opts]
 */
async function callFn(name, body, { signal }={}){
  if(!backendConfigured()) throw new ApiError('The analysis backend is not connected yet.', { code:'unconfigured' });
  let res;
  try{
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method:'POST',
      signal: requestSignal(name, signal),
      headers:{
        'content-type':'application/json',
        'apikey':SUPABASE_ANON_KEY,
        'authorization':`Bearer ${getAuthToken() || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  }catch(e){
    /* A request the caller abandoned is not a failure anyone should read
       about: the code says so, and the loading screen drops it rather than
       putting "that took longer than expected" over a newer analysis. */
    if(signal && signal.aborted) throw new ApiError('That request was cancelled.', { code:'aborted' });
    if(e && (e.name==='TimeoutError' || e.name==='AbortError')){
      throw new ApiError('That took longer than expected — showing the demo plan instead.', { code:'timeout' });
    }
    throw new ApiError('Could not reach the analysis service — check your connection.', { code:'network' });
  }
  let data = null;
  try{ data = await res.json(); }catch(_){ /* non-JSON error body */ }
  if(!res.ok){
    if(res.status === 429){
      throw new ApiError('Analysis limit reached for now — try again a little later.', {
        code:'rate_limited', retryAfterSeconds: data && data.retryAfterSeconds,
      });
    }
    if(res.status === 413) throw new ApiError('Those photos are too large — try fewer or smaller photos.', { code:'too_large' });
    if(res.status === 504){
      throw new ApiError('The AI took longer than expected — showing the demo plan instead.', {
        code:(data && data.error) || 'timeout',
      });
    }
    throw new ApiError('Analysis failed on our side — showing the demo plan instead.', { code:(data && data.error) || 'http_'+res.status });
  }
  return data;
}

// images: [{media_type, data(b64)}]; context: see supabase/functions/analyze-space
export function analyzeSpace(images, context, opts={}){
  return callFn('analyze-space', { images, context }, opts);
}

// image: {media_type, data(b64)}; returns {image:{media_type,data}, storagePath}
export function renderAfter(image, instructions, spaceId = null){
  return callFn('render-after', { image, instructions, spaceId });
}

// shareId: uuid from a read-only share link; returns { space } (sanitized —
// see supabase/functions/_shared/sharePayload.js for exactly what's included)
export function fetchSharedSpace(shareId){
  return callFn('get-shared-space', { shareId });
}

/* Feedback and invite requests go through a function rather than straight to
   the table: the rate limiter lives in the functions, so a direct PostgREST
   insert had no ceiling at all, and user_id is now taken from the verified
   caller instead of the request body. */
export function submitForm(payload){
  return callFn('submit-form', payload);
}

export function renderAfterErrorMessage(error){
  if(error && error.code==='rate_limited') return error.message;
  if(error && error.code==='preview_misconfigured'){
    return 'Photo preview is temporarily offline while its AI connection is repaired.';
  }
  if(error && error.code==='upstream_quota'){
    return 'Photo preview has reached its AI limit for now — try again later.';
  }
  if(error && error.code==='network'){
    return 'Could not reach the photo preview service — check your connection and try again.';
  }
  if(error && error.code==='no_image_returned'){
    return 'The AI could not produce a preview from this photo. Try a clearer, well-lit photo.';
  }
  if(error && error.code==='upstream_invalid_request'){
    return 'The photo preview could not process this image. Try another clear JPG, PNG, or WebP photo.';
  }
  return 'Photo preview unavailable right now — the illustrated layout below still shows the full plan.';
}
