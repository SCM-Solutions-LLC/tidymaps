import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The feedback ask moved onto the report.

   Production telemetry is unambiguous about why: fifteen views of the results
   screen, and zero of customize, save, and feedback — the three screens that
   stand between a finished plan and the only question that decides what to
   build next. These tests pin the ask where the value is, and pin the two
   counters that stop one person from reading as several. */

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const feedback = readFileSync(new URL('../js/screens/feedback.js', import.meta.url), 'utf8');
const results = readFileSync(new URL('../js/screens/results.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');

const report = html.slice(html.indexOf('id="screen-results"'), html.indexOf('id="screen-customize"'));

test('the report asks the pay-for-it question itself', () => {
  assert.ok(report.includes('id="res-rate"'), 'no inline feedback card on the report');
  for (const id of ['rate-ask', 'rate-opts', 'rate-more', 'rate-vs', 'rate-next', 'rate-text', 'rate-thanks']) {
    assert.ok(report.includes(`id="${id}"`), `inline ask is missing #${id}`);
  }
  assert.match(report, /onclick="sendRate\(\)"/, 'the inline ask has no way to submit');
  // It has to be built whenever the report is, or it renders as empty markup.
  assert.match(results, /buildRate\(\)/);
  assert.match(results, /import \{ buildRate \} from '\.\/feedback\.js'/);
});

test('the ask and the screen offer the same answers', () => {
  // Both surfaces read the same constants; a second hand-written copy of the
  // options is how the two data sets would quietly stop being comparable.
  assert.match(feedback, /import \{ FB_USEFUL, FB_VS, FB_NEXT \} from '\.\.\/data\.js'/);
  assert.doesNotMatch(report, /I would pay for this/, 'options are hardcoded in the markup');
});

test('the rating is recorded when tapped, not when a form is completed', () => {
  // The most valuable answer is also the one most likely to be abandoned
  // halfway, so the telemetry event cannot wait for a submit button.
  const rate = feedback.slice(feedback.indexOf('function rate('), feedback.indexOf('/* ---------- Inline ask'));
  assert.match(rate, /track\('plan_rated'/);
  assert.match(rate, /checkedCount/, 'the rating is not joinable to how much of the plan they worked');
  assert.match(rate, /if\(state\.fbRated\) return;/, 'a rating can be counted more than once');
});

test('answering on the report and then walking the flow counts once', () => {
  // fbSent gates the database row, fbRated the telemetry event.
  assert.match(feedback, /if\(state\.fbSent \|\| sending\) return false;/);
  assert.match(feedback, /state\.fbSent=true;/);
  // ...and the screen shows the answer back rather than asking a second time.
  assert.ok(html.includes('id="fb-sent"'), 'no already-answered state on the feedback screen');
  assert.match(feedback, /sent\.classList\.toggle\('hide', !state\.fbSent\)/);
});

/* fbSent is what both surfaces draw their thank-you from, so setting it before
   the write returns is the whole bug: the card said "Thanks" over a row that
   was never written, and kept saying "you already sent this" afterwards. The
   ORDER is the contract, so the order is what this reads. */
test('the thank-you and the telemetry both wait for the write to land', () => {
  const send = feedback.slice(feedback.indexOf('async function sendFeedback('));
  const wrote = send.indexOf('await submitFeedbackRow(');
  const marked = send.indexOf('state.fbSent=true;');
  const counted = send.indexOf("track('feedback_submitted'");
  assert.ok(wrote > -1 && marked > -1 && counted > -1);
  assert.ok(marked > wrote, 'fbSent is set before the row is written');
  assert.ok(counted > wrote, 'feedback_submitted counts submissions that never landed');
  // And a failure has to say so rather than passing silently.
  assert.match(send, /toast\(submitFormErrorMessage\(e, 'feedback'\)\)/);
});

test('a new plan gets a fresh ask', () => {
  // Feedback is about one plan of one space; carrying a rating across would
  // show the previous space's answer back to the user and suppress the ask.
  const reset = stateSrc.slice(stateSrc.indexOf('export function resetPlanRecord'), stateSrc.indexOf('// Demo plans must never'));
  for (const field of ['fbUseful', 'fbVs', 'fbNext', 'fbRated', 'fbSent']) {
    assert.match(reset, new RegExp(`target\\.${field}=`), `${field} survives a new plan`);
  }
});

test('a share-link visitor is not asked to rate someone else’s plan', () => {
  assert.match(feedback, /if\(state\.shareView\)\{ wrap\.classList\.add\('hide'\); return; \}/);
});

test('space_saved counts spaces, not saves', () => {
  const db = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  assert.match(db, /track\('space_saved', \{ auto:!!auto/);
  // The event belongs to the insert branch. Firing it on update as well would
  // turn one diligent user re-saving into a growing funnel.
  const update = db.slice(db.indexOf('if(spaceId){'), db.indexOf('}else{'));
  assert.doesNotMatch(update, /space_saved/);
  // autoSaveSpace is the whole reason the event exists — it has to say so.
  assert.match(db, /saveSpace\(defaultSpaceName\(\), \{ media:false, auto:true \}\)/);
});
