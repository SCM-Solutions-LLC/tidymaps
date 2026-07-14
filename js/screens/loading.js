import { LOAD_LABELS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { escapeHtml } from '../ui.js';
import { backendConfigured } from '../config.js';
import { analyzeSpace } from '../api.js';
import { fileToScaledB64 } from '../media.js';
import { normalizeAi, buildAnalysisContext } from '../plan.js';
import { go } from '../router.js';
import { buildResults } from './results.js';

/* ---------- Loading ---------- */
export function runLoading(){
  const wrap=document.getElementById('load-steps'); wrap.innerHTML='';
  const fw=document.getElementById('frames-wrap');
  LOAD_LABELS.forEach((l,i)=>{
    const row=document.createElement('div'); row.className='load-step'; row.id='ls-'+i;
    row.innerHTML=`<span class="dot">${ICON.check}</span><span>${l}</span>`;
    wrap.appendChild(row);
  });
  // video -> show frames after the "extracting" step (real extraction lands with video analysis)
  if(state.capture==='video'){
    fw.classList.remove('hide');
    const f=document.getElementById('frames'); f.innerHTML='';
    ['0:00','0:04','0:09','0:13'].forEach(t=>{
      const d=document.createElement('div'); d.className='frame'; d.setAttribute('data-t',t);
      d.innerHTML='<div class="pantry-mini"><i></i><i></i><i></i><i></i></div>';
      f.appendChild(d);
    });
  }else{ fw.classList.add('hide'); }

  // Kick off real analysis in parallel (server-held keys via edge function)
  state.ai=null; state.aiError=null; state.planMeta=null;
  const doReal = backendConfigured() && (state.uploadedFiles||[]).length && state.capture==='photos';
  let aiPromise = null;
  if(doReal){
    document.getElementById('load-sub').innerHTML =
      'Analyzing your photos &middot; <span class="spin-ring"></span>';
    aiPromise = (async ()=>{
      const files = (state.uploadedFiles||[]).slice(0,5);
      const images = await Promise.all(files.map(async f=>({ media_type:'image/jpeg', data: await fileToScaledB64(f) })));
      const { plan, model } = await analyzeSpace(images, buildAnalysisContext());
      state.ai = normalizeAi(plan);
      state.planMeta = { model, source:'ai', analyzedAt: Date.now() };
    })().catch(e=>{ state.aiError = e.message || 'Analysis failed'; state.ai=null; state.planMeta=null; });
  }else{
    document.getElementById('load-sub').textContent =
      backendConfigured() ? 'Using the demo plan (real analysis runs on the Upload-photos path).'
                          : 'Showing the demo plan — the analysis backend is not connected yet.';
  }

  let i=0;
  const tick=()=>{
    if(i>0) document.getElementById('ls-'+(i-1)).classList.replace('doing','done');
    if(i>=LOAD_LABELS.length){ finishLoading(aiPromise); return; }
    const row=document.getElementById('ls-'+i); row.classList.add('doing');
    if(state.capture==='video'&&i===1){
      document.querySelectorAll('.frame').forEach((fr,k)=>setTimeout(()=>fr.classList.add('in'),k*150));
    }
    i++;
    setTimeout(tick, i===2?780:430);
  };
  setTimeout(tick,400);
}
export function finishLoading(aiPromise){
  const last=document.getElementById('ls-'+(LOAD_LABELS.length-1));
  const proceed=()=>{
    if(state.aiError){
      document.getElementById('load-sub').innerHTML =
        '<span style="color:var(--clay)">'+escapeHtml(state.aiError)+' &mdash; showing the demo plan instead.</span>';
      if(last) last.classList.add('err');
      setTimeout(()=>{ buildResults(); go('review'); }, 1400);
    }else{
      buildResults();
      setTimeout(()=>go('review'), 350);
    }
  };
  if(aiPromise){ aiPromise.then(proceed); } else { proceed(); }
}
