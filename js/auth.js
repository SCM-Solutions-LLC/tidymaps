import { SUPABASE_URL, SUPABASE_ANON_KEY, backendConfigured } from './config.js';
import { setAuthTokenGetter } from './api.js';

/* Email-code (OTP) auth via supabase-js. No redirect URLs anywhere, which
   keeps GitHub Pages hosting and a future domain move config-free. */

let client = null;
let session = null;
const listeners = new Set();

export function supa(){
  return client;
}

/* supabase-js is 216KB, and every visitor used to download and initialise it
   at startup so that getSession() could report there was no session. The
   library only has work to do for someone who is signed in or about to be, so
   the client is created when a stored session says there is one to restore,
   or on the first sign-in action, and not otherwise. The library keeps its
   session under `sb-<project>-auth-token`; the scan is by shape rather than by
   computing the project ref, so a storage-key change upstream degrades to
   "sign in again" instead of to a wrong key. */
function hasStoredSession(){
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  }catch(_){ /* storage blocked: nothing to restore */ }
  return false;
}

function watchSession(){
  client.auth.onAuthStateChange((_evt, s)=>{
    session = s;
    listeners.forEach(fn=>fn(s));
  });
}

/* Creates the client on first need. `watch` is false only from initAuth,
   which reads the stored session before subscribing, the order the original
   startup used. */
export async function ensureClient({ watch=true }={}){
  if(client) return client;
  /* The vendored bundle ships no type declarations, so everything it returns
     is `{}`. Cast once, here, rather than at each of its call sites. */
  const { createClient } = /** @type {any} */ (await import('../vendor/supabase/supabase.esm.js'));
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setAuthTokenGetter(()=> session ? session.access_token : null);
  if(watch) watchSession();
  return client;
}

export async function initAuth(){
  if(!backendConfigured()) return null;
  if(!hasStoredSession()){
    // Signed out, and nothing to load for it: the buttons still need telling.
    listeners.forEach(fn=>fn(null));
    return null;
  }
  await ensureClient({ watch:false });
  const { data } = await client.auth.getSession();
  session = data.session;
  watchSession();
  listeners.forEach(fn=>fn(session));
  return session;
}

export function getSession(){ return session; }
export function getUser(){ return session ? session.user : null; }

export function onSession(fn){
  listeners.add(fn);
  fn(session);
  return ()=>listeners.delete(fn);
}

/* Both sign-in calls run the library load and the request under one catch.
   The load is a dynamic import of the vendored bundle, and on a first visit
   with no connection it fails before supabase-js exists to report anything;
   that failure used to leave the modal reading the loader's own text. */
export async function sendCode(email){
  let error;
  try{
    const c = await ensureClient();
    ({ error } = await c.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } }));
  }catch(e){ error = e; }
  if(error){
    console.error('sign-in code send failed', error);
    throw new Error(authErrorMessage(error, 'send'));
  }
}

export async function verifyCode(email, token){
  let error;
  try{
    const c = await ensureClient();
    ({ error } = await c.auth.verifyOtp({ email, token, type:'email' }));
  }catch(e){ error = e; }
  if(error){
    console.error('sign-in verify failed', error);
    throw new Error(authErrorMessage(error, 'verify'));
  }
}

export async function signOut(){
  if(client) await client.auth.signOut();
}

/* What the modal prints when a sign-in call fails. `stage` is 'send' or
   'verify', because the same server text means different things on the two
   steps: "invalid" is a code that did not match on verify and an address
   that was refused on send, and the old one-size reading told someone whose
   address was rejected to check the newest email for a code that never went.

   supabase-js reports a request that got no answer as an
   AuthRetryableFetchError carrying the browser's own fetch text ("Failed to
   fetch" in Chrome, "Load failed" in Safari, "NetworkError when attempting to
   fetch resource." in Firefox) with status 0, and a 5xx the same way with the
   status. The library load failing is the same failure one step earlier, as
   a TypeError from import(). None of that text is for a reader, and nothing
   unrecognised is passed through any more either: the fallback is a sentence
   about the step that failed, and the callers log the raw error instead. */
const NETWORK_TEXT = /failed to fetch|load failed|networkerror|network request failed|dynamically imported module|importing a module script failed/i;

export function authErrorMessage(error, stage='send'){
  const m = String(error && error.message || '');
  const status = Number(error && error.status) || 0;
  const code = String(error && error.code || '');
  const retryable = !!(error && error.name==='AuthRetryableFetchError');
  if(status>=500) return 'Sign-in is temporarily unavailable. Try again in a minute.';
  if(retryable || NETWORK_TEXT.test(m)) return 'Could not reach the sign-in service. Check your connection and try again.';
  if(status===429 || /rate.?limit|too many|only request this after/i.test(m)){
    return 'Too many attempts. Wait a minute and try again.';
  }
  if(stage==='verify'){
    if(code==='otp_expired' || /expired|invalid|not found/i.test(m)){
      return 'That code didn’t match. Check the newest email and try again.';
    }
    return 'Sign-in failed. Please try again.';
  }
  if(code==='email_address_invalid' || code==='validation_failed' || /invalid|validate|email address/i.test(m)){
    return 'That email address was not accepted. Check it and try again.';
  }
  return 'The code did not send. Please try again.';
}
