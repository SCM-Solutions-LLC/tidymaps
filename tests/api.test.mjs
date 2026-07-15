import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, renderAfterErrorMessage } from '../js/api.js';

const cases=[
  ['preview_misconfigured','generic upstream failure','Photo preview is temporarily offline while its AI connection is repaired.'],
  ['rate_limited','Try again in 30 minutes.','Try again in 30 minutes.'],
  ['upstream_quota','generic upstream failure','Photo preview has reached its AI limit for now — try again later.'],
  ['network','generic upstream failure','Could not reach the photo preview service — check your connection and try again.'],
  ['no_image_returned','generic upstream failure','The AI could not produce a preview from this photo. Try a clearer, well-lit photo.'],
  ['upstream_invalid_request','generic upstream failure','The photo preview could not process this image. Try another clear JPG, PNG, or WebP photo.'],
  ['unknown','generic upstream failure','Photo preview unavailable right now — the illustrated layout below still shows the full plan.'],
];

for(const [code,message,expected] of cases){
  test(`maps ${code} preview errors`, ()=>{
    assert.equal(renderAfterErrorMessage(new ApiError(message,{ code })), expected);
  });
}
