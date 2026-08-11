import { test, expect } from 'playwright/test';
import { expandChapters, resultsFingerprint, assertResultsCoverage } from './helpers.mjs';

/* The results screen is where the app makes its claims, and the fingerprint in
   helpers.mjs is how a test asks whether an answer changed any of them.

   This file guards the instrument. Twice during a QA sweep of this app a plan
   surface was rendered under one selector and read under another — safety notes
   (div.safety-note, read as li) and the summary, which splits at three sentences
   and leaves everything after the first in #res-summary-points. Both times the
   effect was the same: a change that looked like NO change, so a working
   feature was reported as one the app ignored.

   That direction of error is the dangerous one. A surface nothing reads is
   indistinguishable from a surface nothing changed, and no amount of green
   tests will tell them apart. */

async function openSamplePlan(page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'View a sample plan' }).click();
  await expect(page.locator('#screen-results')).toHaveClass(/active/, { timeout: 40_000 });
}

test('the fingerprint reads every surface the results screen renders', async ({ page }) => {
  await openSamplePlan(page);
  await expandChapters(page);
  /* Folded chapters still render their content, but expanding first means a
     future chapter added collapsed-by-default cannot hide from this check. */
  const count = await assertResultsCoverage(page);
  expect(count, 'the results screen rendered almost nothing, so this run proves nothing')
    .toBeGreaterThan(10);
});

test('the fingerprint sees a plan change that lives only in a later summary sentence', async ({ page }) => {
  /* The exact shape of the second miss. Several style answers cite themselves
     by appending a sentence to the summary, and an appended sentence lands in
     the points list, never in #res-summary. Reading the lede alone called those
     answers invisible while they demonstrably worked. */
  await openSamplePlan(page);
  const fp = await resultsFingerprint(page);

  expect(fp.summaryPoints.length, 'sample summary did not split, so this test is not exercising the split')
    .toBeGreaterThan(0);
  expect(fp.summary).not.toContain(fp.summaryPoints[0]);
  expect(fp.summary.split(/(?<=[.!?])\s+/).filter(Boolean).length,
    '#res-summary held more than the opening sentence, so the split moved').toBe(1);

  // A sentence appended to the plan summary must reach the fingerprint.
  await page.evaluate(() => {
    const el = document.getElementById('res-summary-points');
    el.insertAdjacentHTML('beforeend', '<li>You asked for a minimal look.</li>');
  });
  const after = await resultsFingerprint(page);
  expect(JSON.stringify(after)).not.toEqual(JSON.stringify(fp));
});

test('the coverage guard fails when a surface goes unread', async ({ page }) => {
  /* A guard that has never failed is a guard nobody has tested. Rendering a new
     text-carrying results element must break the check — otherwise this whole
     file is decoration. */
  await openSamplePlan(page);
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'res-invented-surface';
    el.textContent = 'A claim no test reads.';
    document.getElementById('screen-results').appendChild(el);
  });
  await expect(assertResultsCoverage(page)).rejects.toThrow(/res-invented-surface/);
});
