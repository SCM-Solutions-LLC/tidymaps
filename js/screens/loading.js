import { LOAD_LABELS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { escapeHtml } from '../ui.js';
import { backendConfigured } from '../config.js';
import { analyzeSpace } from '../api.js';
import { fileToScaledB64, extractVideoFrames, formatTime } from '../media.js';
import { normalizeAi, buildAnalysisContext } from '../plan.js';
import { go } from '../router.js';
import { buildResults } from './results.js';
import { getDemoScenario } from '../demo-scenarios.js';

function showFrames(frames){
  const fw=document.getElementById('frames-wrap');
  const f=document.getElementById('frames');
  fw.classList.remove('hide');
  f.innerHTML='';
  frames.forEach((fr,k)=>{
    const d=document.createElement('div');
    d.className='frame'; d.setAttribute('data-t',formatTime(fr.t));
    const img=document.createElement('img');
    img.src='data:image/jpeg;base64,'+fr.data;
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
    img.alt='Video frame at '+formatTime(fr.t);
    d.appendChild(img);
    f.appendChild(d);
    setTimeout(()=>d.classList.add('in'), k*150);
  });
}

/* ---------- Loading ---------- */
export function runLoading(){
  const wrap=document.getElementById('load-steps'); wrap.innerHTML='';
  const fw=document.getElementById('frames-wrap');
  fw.classList.add('hide');
  LOAD_LABELS.forEach((l,i)=>{
    const row=document.createElement('div'); row.className='load-step'; row.id='ls-'+i;
    row.innerHTML=`<span class="dot">${ICON.check}</span><span>${l}</span>`;
    wrap.appendChild(row);
  });

  state.ai=null; state.aiError=null; state.planMeta=null; state.frames=[];
  state.afterRenderB64=null; state.afterRenderUrl=null;

  // Video: really extract frames client-side (thumbnails show even without a backend)
  let framesPromise=null;
  if(state.capture==='video' && state.uploadedVideo){
    framesPromise = extractVideoFrames(state.uploadedVideo, 6)
      .then(frames=>{ state.frames=frames; showFrames(frames); return frames; })
      .catch(()=>{ return []; });
  }

  // Real analysis through the edge function (photos or video frames)
  const wantsReal = backendConfigured() &&
    ((state.capture==='photos' && (state.uploadedFiles||[]).length) ||
     (state.capture==='video' && state.uploadedVideo));
  let aiPromise=null;
  if(wantsReal){
    document.getElementById('load-sub').innerHTML =
      'Analyzing your space &middot; <span class="spin-ring"></span>';
    aiPromise = (async ()=>{
      let images;
      if(state.capture==='video'){
        const frames = await (framesPromise||Promise.resolve([]));
        if(!frames.length) throw new Error('We could not read frames from that video — try photos instead.');
        images = frames.map(fr=>({ media_type:'image/jpeg', data:fr.data }));
      }else{
        const files=(state.uploadedFiles||[]).slice(0,5);
        images = await Promise.all(files.map(async f=>({ media_type:'image/jpeg', data: await fileToScaledB64(f) })));
      }
      const { plan, model } = await analyzeSpace(images.slice(0,6), buildAnalysisContext());
      state.ai = normalizeAi(plan);
      state.planMeta = { model, source:'ai', analyzedAt: Date.now() };
    })().catch(e=>{ state.aiError = e.message || 'Analysis failed'; state.ai=null; state.planMeta=null; });
  }else{
    // Use space-specific demo data instead of the generic pantry fallback
    const scenario = getDemoScenario(state.space||'pantry', state.goal, state.household);
    state.ai = normalizeAi(scenario);
    state.planMeta = { model: 'demo', source: 'demo', analyzedAt: Date.now() };
    document.getElementById('load-sub').textContent =
      backendConfigured() ? 'Building your personalized plan.'
                          : 'Building your personalized plan.';
  }

  let i=0;
  const tick=()=>{
    if(i>0) document.getElementById('ls-'+(i-1)).classList.replace('doing','done');
    if(i>=LOAD_LABELS.length){ finishLoading(aiPromise); return; }
    const row=document.getElementById('ls-'+i); row.classList.add('doing');
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
      // Fallback to demo scenario on AI failure too
      const scenario = getDemoScenario(state.space||'pantry', state.goal, state.household);
      state.ai = normalizeAi(scenario);
      state.planMeta = { model: 'demo', source: 'demo-fallback', analyzedAt: Date.now() };
      setTimeout(()=>{ buildResults(); go('review'); }, 1400);
    }else{
      buildResults();
      setTimeout(()=>go('review'), 350);
    }
  };
  if(aiPromise){ aiPromise.then(proceed); } else { proceed(); }
}
