import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, renderAfterErrorMessage } from '../js/api.js';

const cases=[
  ['preview_misconfigured','generic upstream failure','Photo preview is temporarily offline while its AI connection is repaired.'],
  ['rate_limited','Try again in 30 minutes.','Try again in 30 minutes.'],
  ['upstream_quota','generic upstream failure','Photo preview has reached its AI limit for now. Try again later.'],
  ['network','generic upstream failure','Could not reach the photo preview service. Check your connection and try again.'],
  ['no_image_returned','generic upstream failure','The AI could not produce a preview from this photo. Try a clearer, well-lit photo.'],
  ['upstream_invalid_request','generic upstream failure','The photo preview could not process this image. Try another clear JPG, PNG, or WebP photo.'],
  ['unknown','generic upstream failure','Photo preview unavailable right now. The illustrated layout below still shows the full plan.'],
];

for(const [code,message,expected] of cases){
  test(`maps ${code} preview errors`, ()=>{
    assert.equal(renderAfterErrorMessage(new ApiError(message,{ code })), expected);
  });
}

/* ---------- the 429 carries its wait ----------
   The limiter answers every 429 with retryAfterSeconds, and the client kept
   the number on the error and never put it in front of anyone: "Try again a
   little later" for a 30-minute window and a 6-hour one alike. */
import { analyzeSpace, renderAfter, waitText, analysisFailureCopy } from '../js/api.js';

test('the wait reads in the unit a person would use', ()=>{
  assert.equal(waitText(1800), 'in about 30 minutes');     // hourly cap
  assert.equal(waitText(3600), 'in about an hour');        // global breaker
  assert.equal(waitText(21600), 'in about 6 hours');       // daily cap
  assert.equal(waitText(45), 'in a minute');
  assert.equal(waitText(90000), 'tomorrow');
  // Nothing usable falls back to the old vague reading rather than "NaN minutes".
  for(const bad of [0, null, undefined, 'soon', -5, NaN]) assert.equal(waitText(bad), 'a little later', String(bad));
});

const limited = (body)=> async ()=> ({ ok:false, status:429, json: async ()=> body });

test('a 429 from analyze-space says how long to wait', async ()=>{
  const realFetch = globalThis.fetch;
  globalThis.fetch = limited({ error:'rate_limited', retryAfterSeconds:1800 });
  try{
    await assert.rejects(()=>analyzeSpace([], {}), (e)=>{
      assert.equal(e.code, 'rate_limited');
      assert.equal(e.retryAfterSeconds, 1800);
      assert.equal(e.message, 'Analysis limit reached for now. Try again in about 30 minutes.');
      return true;
    });
    globalThis.fetch = limited({ error:'rate_limited' });
    await assert.rejects(()=>analyzeSpace([], {}), (e)=>{
      assert.equal(e.retryAfterSeconds, null);
      assert.equal(e.message, 'Analysis limit reached for now. Try again a little later.');
      return true;
    });
    // The photo preview shares the limiter and used to be told its "Analysis limit" was reached.
    globalThis.fetch = limited({ error:'rate_limited', retryAfterSeconds:21600 });
    await assert.rejects(()=>renderAfter({}, []), (e)=>{
      assert.equal(e.message, 'Photo preview limit reached for now. Try again in about 6 hours.');
      assert.equal(renderAfterErrorMessage(e), e.message);
      return true;
    });
  }finally{
    globalThis.fetch = realFetch;
  }
});

test('the report banner tells a rate limit from an outage', ()=>{
  const outage = analysisFailureCopy('Analysis failed on our side. Showing the demo plan instead.', null);
  assert.match(outage.heading, /couldn.t analyze your photos this time/i);
  assert.match(outage.detail, /^Analysis failed on our side\./);
  assert.match(outage.detail, /based on your selections, not your photos/);

  const quota = analysisFailureCopy('Analysis limit reached for now. Try again in about 30 minutes.', { code:'rate_limited', retryAfterSeconds:1800 });
  assert.doesNotMatch(quota.heading, /couldn.t|failed/i, 'a rate limit is not an outage');
  assert.match(quota.heading, /limit/i);
  assert.match(quota.detail, /in about 30 minutes/);
  assert.match(quota.detail, /based on your selections, not your photos/);
  // The heading and the detail must not both say the limit was reached.
  assert.doesNotMatch(quota.detail, /limit reached/i);

  // An unknown code reads as the outage it probably is.
  const other = analysisFailureCopy('That took longer than expected.', { code:'timeout', retryAfterSeconds:null });
  assert.match(other.heading, /couldn.t analyze/i);
  assert.match(other.detail, /^That took longer than expected\./);
});
