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

/* What a 429 names as the thing that ran out. Every function shares one
   limiter, so this used to say "Analysis limit" on the photo preview too. */
const LIMIT_SUBJECT = { 'analyze-space':'Analysis', 'render-after':'Photo preview' };

/* How long a rate-limited caller is told to wait. The limiter answers in
   fixed windows rather than an exact reset (1800 for the hourly cap, 21600
   for the daily, 3600 for the global breaker, see check_and_log_usage), so
   the copy says "about", and a missing or unusable value falls back to the
   old vague reading rather than printing "in about NaN minutes". */
export function waitText(seconds){
  const s = Number(seconds);
  if(!(s > 0)) return 'a little later';
  if(s < 90) return 'in a minute';
  if(s < 3600) return `in about ${Math.round(s/60)} minutes`;
  if(s < 5400) return 'in about an hour';
  if(s < 86400) return `in about ${Math.round(s/3600)} hours`;
  return 'tomorrow';
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
    if(signal && signal.aborted) throw new ApiError('That request was canceled.', { code:'aborted' });
    if(e && (e.name==='TimeoutError' || e.name==='AbortError')){
      throw new ApiError('That took longer than expected. Showing the demo plan instead.', { code:'timeout' });
    }
    throw new ApiError('Could not reach the analysis service. Check your connection.', { code:'network' });
  }
  let data = null;
  try{ data = await res.json(); }catch(_){ /* non-JSON error body */ }
  if(!res.ok){
    if(res.status === 429){
      /* The wait goes into the message, because that is the one thing the
         person can act on and the one thing this used to leave out. */
      const retryAfterSeconds = (data && Number(data.retryAfterSeconds) > 0) ? Number(data.retryAfterSeconds) : null;
      throw new ApiError(`${LIMIT_SUBJECT[name] || 'Request'} limit reached for now. Try again ${waitText(retryAfterSeconds)}.`, {
        code:'rate_limited', retryAfterSeconds,
      });
    }
    if(res.status === 413) throw new ApiError('Those photos are too large. Try fewer or smaller photos.', { code:'too_large' });
    if(res.status === 504){
      throw new ApiError('The AI took longer than expected. Showing the demo plan instead.', {
        code:(data && data.error) || 'timeout',
      });
    }
    throw new ApiError('Analysis failed on our side. Showing the demo plan instead.', { code:(data && data.error) || 'http_'+res.status });
  }
  return data;
}

// images: [{media_type, data(b64)}]; context: see supabase/functions/analyze-space
export function analyzeSpace(images, context, opts={}){
  return callFn('analyze-space', { images, context }, opts);
}

/* image: {media_type, data(b64)}; zones: [{level, zone}] — DATA, not a prompt.
   The function composes the edit brief from it (_shared/renderBrief.js), so
   nothing this client sends is treated as an instruction to the image model.
   Returns {image:{media_type,data}, storagePath}. */
export function renderAfter(image, zones, spaceId = null){
  return callFn('render-after', { image, zones, spaceId });
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

/* What to tell someone whose feedback or signup did not arrive. It has to say
   what to do next, because the alternative — what this used to do — was to
   say nothing and show them a thank-you.

   `what` names the thing that failed ("feedback", "signup"), so one function
   serves both without either reading as though it were written for the other.
   The generic messages from callFn all mention the ANALYSIS backend, which is
   the wrong subject on a form. */
export function submitFormErrorMessage(error, what){
  const code = error && error.code;
  if(code==='rate_limited'){
    return `That is a few ${what}s in a row. Give it a few minutes and try again.`;
  }
  if(code==='network'){
    return `Your ${what} did not send. Check your connection and try again.`;
  }
  if(code==='unconfigured'){
    return `${what[0].toUpperCase()}${what.slice(1)} is not connected yet, so this did not reach us.`;
  }
  if(code==='bad_email') return 'That email address was not accepted. Check it and try again.';
  return `That ${what} did not reach us. Nothing was lost. Try again in a moment.`;
}

/* The report's banner over a plan the analysis did not produce. A rate limit
   is not an outage: nothing broke, the window's analyses are used up, and
   "We couldn't analyze your photos this time" over a Retry link invited an
   immediate retry that would fail the same way. `failure` is the ApiError's
   code and wait, carried through state alongside the message. */
export function analysisFailureCopy(message, failure){
  const basis = 'The plan below is based on your selections, not your photos.';
  if(failure && failure.code==='rate_limited'){
    return {
      heading: 'Analysis limit reached for now.',
      detail: `Your photos were not looked at. Try again ${waitText(failure.retryAfterSeconds)}. ${basis}`,
    };
  }
  return {
    heading: 'We couldn\u2019t analyze your photos this time.',
    detail: `${message || ''} ${basis}`.trim(),
  };
}

export function renderAfterErrorMessage(error){
  if(error && error.code==='rate_limited') return error.message;
  if(error && error.code==='preview_misconfigured'){
    return 'Photo preview is temporarily offline while its AI connection is repaired.';
  }
  if(error && error.code==='upstream_quota'){
    return 'Photo preview has reached its AI limit for now. Try again later.';
  }
  if(error && error.code==='network'){
    return 'Could not reach the photo preview service. Check your connection and try again.';
  }
  if(error && error.code==='no_image_returned'){
    return 'The AI could not produce a preview from this photo. Try a clearer, well-lit photo.';
  }
  if(error && error.code==='upstream_invalid_request'){
    return 'The photo preview could not process this image. Try another clear JPG, PNG, or WebP photo.';
  }
  if(error && (error.code==='upstream_timeout' || error.code==='timeout')){
    return 'The photo preview took too long this time. Try again in a moment.';
  }
  if(error && error.code==='bad_upstream_image'){
    return 'The photo preview came back in a form we could not use. Try again, or try another photo.';
  }
  /* Kept separate from the malformed case. They were one message, and it sent
     the first person to debug this looking for a corrupt payload when the
     image was fine and merely larger than our own cap allowed. */
  if(error && error.code==='upstream_image_too_large'){
    return 'The photo preview came back larger than we can handle. Try again, or try another photo.';
  }
  return 'Photo preview unavailable right now. The illustrated layout below still shows the full plan.';
}
