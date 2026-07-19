import { FB_USEFUL, FB_VS, FB_NEXT } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { go } from '../router.js';
import { submitFeedbackRow } from '../db.js';
import { track, flush } from '../telemetry.js';

/* ---------- Feedback ---------- */
export function buildFeedback(){
  const u=document.getElementById('fb-useful'); u.innerHTML='';
  FB_USEFUL.forEach(t=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span class="ttl">${t}</span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{u.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));b.classList.add('sel');state.fbUseful=t;};
    u.appendChild(b);
  });
  const v=document.getElementById('fb-vs'); v.innerHTML='';
  FB_VS.forEach(t=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span class="ttl">${t}</span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{v.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));b.classList.add('sel');state.fbVs=t;};
    v.appendChild(b);
  });
  const n=document.getElementById('fb-next'); n.innerHTML='';
  FB_NEXT.forEach(t=>{
    const c=document.createElement('button'); c.className='chip'; c.innerHTML=t;
    c.onclick=()=>{n.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel'));c.classList.add('sel');state.fbNext=t;};
    n.appendChild(c);
  });
}
export function submitFeedback(){
  // best-effort: feedback lands in the DB when the backend is connected
  submitFeedbackRow({
    useful: state.fbUseful||null,
    vs: state.fbVs||null,
    comments: (document.getElementById('fb-text')||{}).value||null,
    next_space: state.fbNext||null,
  }).catch(()=>{});
  // The pay-for-it signal: fbUseful is a fixed choice ("I would pay for
  // this" among them), joined against step_checked depth per anon_id.
  // Free-text comments deliberately stay out of telemetry.
  track('feedback_submitted', {
    useful: state.fbUseful||'', vs: state.fbVs||'', nextSpace: state.fbNext||'',
  });
  flush(); // the session usually ends right after — don't wait the debounce
  go('done');
}
