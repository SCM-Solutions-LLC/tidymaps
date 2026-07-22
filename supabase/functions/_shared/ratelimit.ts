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

export async function checkAndLog(
  admin: SupabaseClient, fn: string, caller: Caller, limits: Limits,
): Promise<void> {
  const { data, error } = await admin.rpc('check_and_log_usage', {
    p_fn: fn,
    p_user_id: caller.userId,
    p_ip_hash: caller.userId ? null : caller.ipHash,
    p_per_hour: limits.perHour,
    p_per_day: limits.perDay,
    p_global_per_day: limits.globalPerDay ?? null,
  });
  if (error) throw error;
  const retryAfterSeconds = Number(data) || 0;
  if (retryAfterSeconds > 0) throw new RateLimitError(retryAfterSeconds);
}
