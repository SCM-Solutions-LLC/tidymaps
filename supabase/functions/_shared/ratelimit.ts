import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Caller } from './auth.ts';

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('rate_limited');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface Limits {
  perHour: number;
  perDay: number;
  globalPerDay?: number; // circuit breaker across all callers
}

async function countSince(
  admin: SupabaseClient, fn: string, caller: Caller | null, since: Date,
): Promise<number> {
  let q = admin.from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('fn', fn)
    .gte('created_at', since.toISOString());
  if (caller) {
    q = caller.userId ? q.eq('user_id', caller.userId) : q.eq('ip_hash', caller.ipHash);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function checkAndLog(
  admin: SupabaseClient, fn: string, caller: Caller, limits: Limits,
): Promise<void> {
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000);
  const dayAgo = new Date(now - 86400_000);

  if (limits.globalPerDay) {
    const globalDay = await countSince(admin, fn, null, dayAgo);
    if (globalDay >= limits.globalPerDay) throw new RateLimitError(3600);
  }
  const [hourCount, dayCount] = await Promise.all([
    countSince(admin, fn, caller, hourAgo),
    countSince(admin, fn, caller, dayAgo),
  ]);
  if (dayCount >= limits.perDay) throw new RateLimitError(6 * 3600);
  if (hourCount >= limits.perHour) throw new RateLimitError(1800);

  const { error } = await admin.from('usage_events').insert({
    user_id: caller.userId, ip_hash: caller.userId ? null : caller.ipHash, fn,
  });
  if (error) throw error;
}
