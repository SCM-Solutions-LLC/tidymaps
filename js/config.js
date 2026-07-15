/* Backend wiring. Filled in when the Supabase project is provisioned —
   URL + publishable anon key are safe to commit. Empty values keep the
   whole app working in demo mode (no analysis backend). */
export const SUPABASE_URL = 'https://jwubrtaacveavbkosgtf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dWJydGFhY3ZlYXZia29zZ3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjkyNTQsImV4cCI6MjA5OTY0NTI1NH0.asgKDt1pbZRPC7jAwhdzEyFaK2PwUG17SxTr2O25198';

export function backendConfigured(){
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
