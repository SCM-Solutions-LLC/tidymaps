import { FB_USEFUL, FB_VS, FB_NEXT } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { go } from '../router.js';
import { submitFeedbackRow } from '../db.js';
import { submitFormErrorMessage } from '../api.js';
import { track, flush } from '../telemetry.js';
import { toast } from '../ui.js';

/* ---------- Feedback ----------

   Two surfaces, one set of answers. The dedicated screen below is the last of
   nineteen and sits two screens past the plan; production telemetry says
   nobody has ever reached it — fifteen views of the report against zero of
   customize, save, and feedback. A question nobody is asked cannot be
   answered, so the one that decides what gets built next is also asked inline
   on the report, where the value is.

   state.fbRated gates the telemetry event and state.fbSent the database row,
   so someone who answers inline and then walks the rest of the flow is
   counted once. */

// One selectable list, shared by both surfaces so they cannot drift apart.
function optionList(el, items, cls, onPick, selected){
  if(!el) return;
  el.innerHTML='';
  items.forEach(t=>{
    const b=document.createElement('button');
    b.type='button';
    b.className=cls+(t===selected?' sel':'');
    b.innerHTML = cls==='chip' ? t : `<span class="ttl">${t}</span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{
      el.querySelectorAll('.'+cls).forEach(o=>o.classList.remove('sel'));
      b.classList.add('sel');
      onPick(t);
    };
    el.appendChild(b);
  });
}

/* The pay-for-it signal, recorded the moment it is tapped rather than when a
   form is completed. A rating with nothing after it is the answer we most need
   and the one most likely to be abandoned halfway; checkedCount rides along so
   the reading can be joined to how much of the plan they actually worked. */
function rate(useful){
  state.fbUseful=useful;
  if(state.fbRated) return;
  state.fbRated=true;
  track('plan_rated', {
    useful,
    checkedCount:(state.stepDone||[]).filter(Boolean).length,
    total:state.stepCount||0,
    source:(state.planMeta&&state.planMeta.source)||'',
  });
}

/* ---------- Inline ask, on the report ---------- */
export function buildRate(){
  const wrap=document.getElementById('res-rate');
  if(!wrap) return;
  // Someone on a share link would be rating another household's plan for
  // another household's space, which is not the question being asked here.
  if(state.shareView){ wrap.classList.add('hide'); return; }
  wrap.classList.remove('hide');

  const done=state.fbSent;
  document.getElementById('rate-ask').classList.toggle('hide', done);
  document.getElementById('rate-more').classList.toggle('hide', done || !state.fbUseful);
  document.getElementById('rate-thanks').classList.toggle('hide', !done);
  if(done) return;

  optionList(document.getElementById('rate-opts'), FB_USEFUL, 'opt', t=>{
    rate(t);
    document.getElementById('rate-more').classList.remove('hide');
  }, state.fbUseful);
  optionList(document.getElementById('rate-vs'), FB_VS, 'opt', t=>{ state.fbVs=t; }, state.fbVs);
  optionList(document.getElementById('rate-next'), FB_NEXT, 'chip', t=>{ state.fbNext=t; }, state.fbNext);
}

// Submitting from the report writes the same row the screen would. The card
// collapses to a thank-you instead of sending the reader two screens away —
// once there is a row behind it.
export async function sendRate(){
  await sendFeedback((document.getElementById('rate-text')||{}).value||null);
  buildRate();
}

/* ---------- The dedicated screen ---------- */
export function buildFeedback(){
  const sent=document.getElementById('fb-sent');
  const form=document.getElementById('fb-form');
  // Already answered on the report: show that back rather than asking twice.
  if(sent && form){
    sent.classList.toggle('hide', !state.fbSent);
    form.classList.toggle('hide', !!state.fbSent);
    if(state.fbSent) return;
  }
  optionList(document.getElementById('fb-useful'), FB_USEFUL, 'opt', rate, state.fbUseful);
  optionList(document.getElementById('fb-vs'), FB_VS, 'opt', t=>{ state.fbVs=t; }, state.fbVs);
  optionList(document.getElementById('fb-next'), FB_NEXT, 'chip', t=>{ state.fbNext=t; }, state.fbNext);
}

// The screen's own submit moves on to 'done' — but only once the answer is
// somewhere other than this tab. A failure leaves the reader on the form with
// everything they typed still in it.
export async function submitFeedback(){
  if(await sendFeedback((document.getElementById('fb-text')||{}).value||null)) go('done');
}

/* `fbSent` means "there is a row for this plan", and it is what both surfaces
   render their thank-you from, so it cannot be set hopefully. `sending` is the
   separate thing it was doing badly: stopping a second submit while the first
   is still in the air. */
let sending=false;

async function sendFeedback(comments){
  if(state.fbSent || sending) return false;
  sending=true;
  /* The write was best-effort and the thank-you was unconditional, so a 500
     produced "Thanks — that's genuinely useful" over a row that was never
     written, and the screen went on saying "you already sent this". The catch
     that was meant to undo that could never run: submitFeedbackRow answered
     `false` on failure rather than rejecting. Someone who took the trouble to
     answer is owed the truth about whether it arrived. */
  try{
    await submitFeedbackRow({
      useful: state.fbUseful||null,
      vs: state.fbVs||null,
      comments: comments||null,
      next_space: state.fbNext||null,
    });
  }catch(e){
    toast(submitFormErrorMessage(e, 'feedback'));
    return false;
  }finally{
    sending=false;
  }
  state.fbSent=true;
  /* The pay-for-it signal: fbUseful is a fixed choice ("I would pay for
     this" among them), joined against step_checked depth per anon_id.
     Free-text comments deliberately stay out of telemetry.

     After the write, not beside it. Counting submissions that never landed
     makes the one number this app steers by — how many people answered —
     larger than the table it is supposed to describe, and the gap grows with
     exactly the failures nobody would otherwise notice. */
  track('feedback_submitted', {
    useful: state.fbUseful||'', vs: state.fbVs||'', nextSpace: state.fbNext||'',
  });
  flush(); // the session often ends right after — don't wait the debounce
  return true;
}
