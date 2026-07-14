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

export async function initAuth(){
  if(!backendConfigured()) return null;
  const { createClient } = await import('../vendor/supabase/supabase.esm.js');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setAuthTokenGetter(()=> session ? session.access_token : null);
  const { data } = await client.auth.getSession();
  session = data.session;
  client.auth.onAuthStateChange((_evt, s)=>{
    session = s;
    listeners.forEach(fn=>fn(s));
  });
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

export async function sendCode(email){
  const { error } = await client.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } });
  if(error) throw new Error(friendly(error));
}

export async function verifyCode(email, token){
  const { error } = await client.auth.verifyOtp({ email, token, type:'email' });
  if(error) throw new Error(friendly(error));
}

export async function signOut(){
  if(client) await client.auth.signOut();
}

function friendly(error){
  const m=String(error && error.message || '');
  if(/rate/i.test(m)) return 'Too many attempts — wait a minute and try again.';
  if(/expired|invalid/i.test(m)) return 'That code didn’t match — check the newest email and try again.';
  return m || 'Sign-in failed — please try again.';
}
