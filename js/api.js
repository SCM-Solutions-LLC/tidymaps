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

async function callFn(name, body){
  if(!backendConfigured()) throw new ApiError('The analysis backend is not connected yet.', { code:'unconfigured' });
  let res;
  try{
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':SUPABASE_ANON_KEY,
        'authorization':`Bearer ${getAuthToken() || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  }catch(_){
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
    throw new ApiError('Analysis failed on our side — showing the demo plan instead.', { code:(data && data.error) || 'http_'+res.status });
  }
  return data;
}

// images: [{media_type, data(b64)}]; context: see supabase/functions/analyze-space
export function analyzeSpace(images, context){
  return callFn('analyze-space', { images, context });
}

// image: {media_type, data(b64)}; returns {image:{media_type,data}, storagePath}
export function renderAfter(image, instructions, spaceId = null){
  return callFn('render-after', { image, instructions, spaceId });
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
