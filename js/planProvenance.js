import { state, householdAnswered } from './state.js';
import { SETUP_DIMS } from './wizard-data.js';

/* What a plan was built from, decided once for every surface that makes a
   claim about it.

   The report's byline and the 3D view's status line each said whose plan this
   is and where its shape came from, and they said it from two different
   readings of the same fields. The viewer's was the older one: it read
   `geometry.estimated`, which is true of every demo scenario, as "estimated
   from your photos", so the sample pantry every visitor opens from the landing
   page was drawn under a line saying photos had been looked at. Nobody had
   taken any. The rule lives here so the two surfaces cannot drift apart again.

   `planMeta.source` is the signal, not `uploadedFiles`. A failed analysis
   ('demo-fallback') leaves the photos in memory and builds the plan from the
   scenario, so a photo on file does not mean a photo was read; and a saved
   plan reopened from the dashboard has its photos on the server and none in
   memory, yet it was read from them. Only 'ai' means the model looked. */

/* True when the measurements differ from the setup's own defaults. The measure
   step writes `dims` from those defaults whether or not anyone typed, so the
   presence of dims says nothing; the difference does. */
export function dimsTyped(target=state){
  const def=SETUP_DIMS[target.setup];
  return !!(target.dimsFt && def
    && (target.dimsFt.w!==def.w || target.dimsFt.h!==def.h || target.dimsFt.d!==def.d));
}

/* Any answer at all, not only the three that carry a touched flag. Someone who
   typed their measurements and named their household but left the defaults
   alone has answered, and was once told the plan was "not based on your
   space" under chips quoting the measurements they had just typed. */
export function answeredAnything(target=state){
  return !!(target.spaceTouched || target.setupTouched || target.catsTouched || target.shoppingTouched
    || target.effortTouched || dimsTyped(target) || householdAnswered(target)
    || (target.goals||[]).length>0 || (target.styles||[]).length>0
    || (target.uploadedFiles||[]).length>0);
}

/* The plan came out of a real analysis of the user's photos. */
export function planFromPhotos(target=state){
  return !!(target.ai && target.planMeta && target.planMeta.source==='ai');
}

/* The landing page's sample: a demo scenario opened by someone who has
   answered nothing. A demo plan built at the end of the wizard is not a
   sample; it is theirs, built from their answers without a photo. */
export function planIsSample(target=state){
  return !planFromPhotos(target)
    && !!(target.planMeta && target.planMeta.source==='demo')
    && !answeredAnything(target);
}
