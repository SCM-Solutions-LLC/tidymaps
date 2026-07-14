/* Backend wiring. Filled in when the Supabase project is provisioned —
   URL + publishable anon key are safe to commit. Empty values keep the
   whole app working in demo mode (no analysis backend). */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export function backendConfigured(){
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
