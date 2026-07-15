import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface Caller {
  userId: string | null;
  ipHash: string;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

// Identify the caller: a signed-in user (valid JWT) or an anonymous IP hash.
// The daily salt keeps stored hashes unlinkable across days without storing raw IPs.
export async function getCaller(req: Request): Promise<Caller> {
  let userId: string | null = null;
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (bearer && bearer !== anonKey) {
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const { data } = await supa.auth.getUser();
    userId = data?.user?.id ?? null;
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const salt = Deno.env.get('IP_HASH_SALT') ?? 'tidymap';
  const bytes = new TextEncoder().encode(`${ip}|${day}|${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { userId, ipHash };
}
