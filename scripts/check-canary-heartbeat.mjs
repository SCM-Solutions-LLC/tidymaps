/* Is the canary itself actually running when scheduled?

   The failure this exists for is the canary's own blind spot. A run that fires
   and fails emails the repo owner; a run that never fires is silent, and looks
   exactly like a healthy day. GitHub also disables `schedule` workflows after
   60 days of repo quiet, so a slow period silently ends the alert. The canary
   was the primary check against a broken model path; without a heartbeat over
   it, the alert monitors itself no better than the outage it was written to
   catch.

   This step reads the workflow's own recent run history through the GitHub
   Actions API — using GITHUB_TOKEN with `actions: read`, no new secret — and
   fails if the last completed run is old enough that a scheduled fire must
   have been skipped.

   "Completed", not "successful": the question is whether the schedule fired,
   not whether the model path worked. A failed canary run proves the schedule
   is alive, and it already emails the owner on its own. Counting only
   successes made a model-path outage longer than 36h also report HEARTBEAT
   LOST and tell the owner a fire was skipped when every day had run (runs
   #31 to #40, 2026-09-19 to 09-28, all fired on schedule and all failed on
   an invalid API key).

   The list is fetched unfiltered and filtered here, never with the API's
   `status=` parameter. On 2026-10-02 run #44 asked for `status=completed`
   and got a list whose newest entry was #41, missing #42 and #43, which had
   both completed on schedule. The same query answered correctly before and
   after, so the filtered listing can lag. The plain listing is the one the
   Actions tab shows; pickLastCompleted already skips runs still in flight.

   Threshold: firings have landed between 44 minutes and 11 hours 21 minutes
   after their 06:20 UTC schedule (Production health #10, HANDOFF item 9).
   The gap between two consecutive completions on a 24h schedule is
   `24h + (jitter_new − jitter_old)`, so with observed jitter of 0 to 11.35h
   the worst-case normal gap is 24 + 11.35 ≈ 35.5h without any run being
   missed. 36h clears that with a small margin and still catches a missed day
   (≥48h). HANDOFF's 30h floor was measured against the 08-27 pattern only,
   not the widest normal jitter, so a stricter number would false-alarm on a
   run that ran late but did run.

   Three exit modes, following the canary's own precedent that a check which
   could not run must never report success:
     - fresh (last completed run ≤ 36h ago): OK, exit 0.
     - stale (last completed run > 36h ago): HEARTBEAT LOST, exit 1. A previous
       scheduled fire was skipped; look at the schedule and at whether the
       workflow was auto-disabled by GitHub for repo quiet.
     - could-not-check (API error, malformed data, missing env): exit 1 under
       its own header so nobody rotates the API key over a schedule issue.

   Bootstrap (no prior completed run at all — first deploy of this alert, a
   just-rebased branch, or the runs history rolled off): exit 0 with a note.
   The current run is running now; it cannot be its own predecessor.

   Run by hand (needs a personal access token with `actions:read`):
     GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/check-canary-heartbeat.mjs

   Run daily by: .github/workflows/model-path-canary.yml */

export const STALE_THRESHOLD_HOURS = 36;
const WORKFLOW_FILE = 'model-path-canary.yml';
const RUNS_PAGE_SIZE = 20;

/* Pick the most recent completed run of any conclusion, excluding the current
   one. The runs API returns newest first, so the first match wins. */
export function pickLastCompleted(runs, currentRunId) {
  if (!Array.isArray(runs)) return null;
  const currentId = currentRunId == null ? null : String(currentRunId);
  for (const r of runs) {
    if (!r || typeof r !== 'object') continue;
    if (currentId && String(r.id) === currentId) continue;
    if (r.status !== 'completed') continue;
    if (typeof r.updated_at !== 'string') continue;
    return r;
  }
  return null;
}

/* Pure classifier so the age boundary is testable without an API. */
export function classifyHeartbeat(lastUpdatedAt, now = Date.now()) {
  if (lastUpdatedAt == null) return { kind: 'bootstrap' };
  const then = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(then)) return { kind: 'malformed', raw: lastUpdatedAt };
  const ageHours = (now - then) / 3_600_000;
  if (ageHours > STALE_THRESHOLD_HOURS) return { kind: 'stale', ageHours, at: lastUpdatedAt };
  return { kind: 'fresh', ageHours, at: lastUpdatedAt };
}

async function fetchRecentCompletedRuns({ token, repo, fetchImpl = fetch }) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs`
    + `?per_page=${RUNS_PAGE_SIZE}`;
  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'model-path-canary-heartbeat',
    },
  });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* body unreadable is not extra info */ }
    throw new Error(`GitHub runs API returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const parsed = await res.json();
  return parsed?.workflow_runs;
}

function failHeartbeat(summary, detail) {
  console.error(`\nCANARY HEARTBEAT LOST: ${summary}`);
  if (detail) console.error(detail);
  console.error(`
This does NOT mean the model path is down — today's run reached this step, so
the canary itself works. It means a previous scheduled fire was skipped and
nobody was told, which is the blind spot this check exists to close.

What to check:
  1. The Actions tab: does model-path-canary have runs on every recent day?
    A gap larger than the 36h threshold triggered this.
  2. GitHub disables scheduled workflows after 60 days of repo quiet. If the
     repo went silent, re-enable the workflow from the Actions tab.
  3. The cron in .github/workflows/model-path-canary.yml (currently 06:20 UTC
     daily). If it has been changed, the gap may be expected.

While the schedule was skipped, no email fired; investigate the model path
by hand from plan_meta->>'source' on the newest \`spaces\` rows and from the
edge logs for analyze-space.`);
  process.exit(1);
}

function failCheck(summary, detail) {
  console.error(`\nHEARTBEAT CHECK COULD NOT RUN: ${summary}`);
  if (detail) console.error(detail);
  console.error(`
This does NOT mean the model path is down and does NOT mean the schedule was
skipped — it means this heartbeat step could not verify either way. Do not
rotate the API key on the strength of it.

Likely causes:
  - GITHUB_TOKEN scope changed (needs \`actions: read\` on this workflow)
  - GitHub API blip (transient; the next scheduled run will re-check)
  - the workflow filename was renamed (the API asks by file name)
  - GITHUB_REPOSITORY not set in the runner environment`);
  process.exit(1);
}

export async function main({ env = process.env, now = Date.now(), fetchImpl = fetch, log = console.log } = {}) {
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  const currentRunId = env.GITHUB_RUN_ID || null;
  if (!token) failCheck('no GITHUB_TOKEN or GH_TOKEN in env');
  if (!repo || !repo.includes('/')) failCheck('GITHUB_REPOSITORY not set to owner/repo');

  let runs;
  try {
    runs = await fetchRecentCompletedRuns({ token, repo, fetchImpl });
  } catch (e) {
    return failCheck('the GitHub API request never completed', `${e.name}: ${e.message}`);
  }
  if (!Array.isArray(runs)) {
    return failCheck('the GitHub API response had no workflow_runs array', `Payload keys: ${runs && typeof runs === 'object' ? Object.keys(runs).join(', ') : typeof runs}`);
  }

  const last = pickLastCompleted(runs, currentRunId);
  const verdict = classifyHeartbeat(last?.updated_at, now);

  if (verdict.kind === 'malformed') {
    return failCheck('the previous run has a malformed updated_at', `updated_at: ${JSON.stringify(verdict.raw)}`);
  }
  if (verdict.kind === 'bootstrap') {
    log('OK — no prior completed run to compare against (bootstrap or history rolled off). Not failing.');
    return;
  }
  if (verdict.kind === 'stale') {
    const ageH = verdict.ageHours.toFixed(1);
    return failHeartbeat(
      `the last run completed ${ageH}h ago (threshold ${STALE_THRESHOLD_HOURS}h)`,
      `Last completed run at ${verdict.at} (run #${last?.run_number ?? '?'}, id ${last?.id ?? '?'}).`,
    );
  }
  log(`OK — last completed run ${verdict.ageHours.toFixed(1)}h ago at ${verdict.at}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
