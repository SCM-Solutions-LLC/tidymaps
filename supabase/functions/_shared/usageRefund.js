/* Hand back a rate-limit allowance the caller never got anything for.
 *
 * `check_and_log_usage` writes the usage row on the ALLOW path — before the
 * work is attempted — because that is the only way the check and the insert can
 * share one transaction and one advisory lock, which is what makes concurrent
 * requests unable to pass the same stale count. That ordering is correct and
 * should stay.
 *
 * The cost of it is that a request which is admitted and then fails upstream
 * has spent an allowance for nothing. On render-after that is 1 of 3 per hour
 * and 1 of 5 per day, so a run of Gemini 502s could burn a signed-in caller's
 * whole day without ever showing them an image — and it did: four of the five
 * renders attempted on 2026-08-19 were eaten by a size-cap bug and had to be
 * cleared by hand.
 *
 * So the row is removed after the fact instead. Deliberately best-effort: a
 * refund that fails must never turn a 502 the caller can understand into a 500
 * they cannot, and it must never mask the original error. Every failure here is
 * logged and swallowed.
 *
 * WHICH row is deleted does not matter, only that the count drops by one. Rows
 * are interchangeable for counting — `check_and_log_usage` only ever does
 * `count(*)` over them — so deleting the caller's newest row rather than
 * tracking the specific id we inserted is equivalent, and avoids widening the
 * SQL function's return type to carry an id back. Under concurrency two failing
 * requests can select the same newest row; the second delete then matches
 * nothing and the refund is quietly skipped, which errs toward under-refunding.
 * That is the right direction to err.
 */

/** @typedef {{userId: string|null, ipHash: string}} Caller */

/* Mirrors the caller-identity arm of check_and_log_usage's own WHERE clause: a
   signed-in caller is counted by user_id, an anonymous one by ip_hash among the
   rows with no user_id. The insert stores ip_hash ONLY when user_id is null, so
   an anonymous refund that forgot the `is null` would match nothing. */
function scopeToCaller(query, caller) {
  return caller.userId
    ? query.eq('user_id', caller.userId)
    : query.is('user_id', null).eq('ip_hash', caller.ipHash);
}

/**
 * Remove one usage_events row for this caller and function, if one is there.
 * Never throws.
 *
 * @param {any} admin service-role Supabase client (usage_events is RLS'd with
 *   no policies, so nothing else can reach it)
 * @param {string} fn the function name as written to usage_events.fn
 * @param {Caller} caller
 * @returns {Promise<boolean>} true if a row was removed
 */
export async function refundUsage(admin, fn, caller) {
  try {
    const { data, error } = await scopeToCaller(
      admin.from('usage_events').select('id').eq('fn', fn),
      caller,
    ).order('id', { ascending: false }).limit(1);
    if (error) {
      console.error('usage refund lookup failed', error);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : null;
    // Nothing to give back. Reached when a refund runs twice for one request,
    // or when the caller's row has already aged out of the counting window.
    if (!row || row.id === undefined || row.id === null) return false;

    const { error: delError } = await admin.from('usage_events')
      .delete().eq('id', row.id);
    if (delError) {
      console.error('usage refund delete failed', delError);
      return false;
    }
    return true;
  } catch (e) {
    console.error('usage refund failed', e);
    return false;
  }
}
