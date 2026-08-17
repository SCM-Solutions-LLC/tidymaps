import { LOAD_LABELS_MEDIA, LOAD_LABELS_COMMON, LOAD_LABELS_NO_MEDIA } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { escapeHtml } from '../ui.js';
import { backendConfigured } from '../config.js';
import { analyzeSpace } from '../api.js';
import { fileToScaledB64, extractVideoFrames, formatTime } from '../media.js';
import { normalizeAi, buildAnalysisContext } from '../plan.js';
import { go, getCurrentScreen } from '../router.js';
import { autoSaveSpace } from '../db.js';
import { syncCategoriesToResults } from './results.js';
import { track } from '../telemetry.js';
import { getDemoScenario } from '../demo-scenarios.js';
import { scenarioKeyFor, areaFor } from '../wizard-data.js';
import { resolveLayout } from '../layout.js';
import { enforceArchetypeHonesty } from '../setupStructure.js';

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

/* Anything thrown between here and the network can end up in the banner the
   user reads, and a JS runtime message there is worse than no message: it
   reads as the app breaking rather than one analysis not working out. Our own
   thrown text is written for that banner and passes through; a runtime
   exception is replaced with the plain version. */
const RUNTIME_ERROR=/cannot (?:read|destructure|access)|undefined is not|is not a function|null \(reading|JSON|unexpected token|\bNaN\b/i;
export function readableError(e){
  const message=(e && e.message) ? String(e.message) : '';
  if(!message || RUNTIME_ERROR.test(message)) return 'We could not read the plan that came back.';
  return message;
}

/* ---------- Loading ----------

   An analysis takes 70-90 seconds and Back is reachable the whole time, so a
   second run can start while the first is still in the air. Nothing tied a
   response to the run that asked for it: whichever finished LAST wrote
   state.ai and pushed the user to the report, so the plan on screen could be
   the one built from the answers they had just changed away from.

   Checking `getCurrentScreen()!=='loading'` was not enough on its own, because
   a second run puts the loading screen back up — run A would find the screen
   it expected and overwrite run B. Every run now carries a token, and a run
   that is no longer the current one writes nothing and navigates nowhere. The
   token is checked again inside the delayed navigation, which is its own race:
   the user has 550ms (or 1400ms on the fallback path) to leave. */
let analysisRun=0;
let activeAnalysis=null;   // AbortController for the run in flight

/* Comfortably above the request's own 125s budget (TIMEOUT_MS in js/api.js),
   so a slow request still fails in its own words and this only catches a
   promise that has stopped settling at all. */
const ANALYSIS_WATCHDOG_MS = 150000;

/* Leaving the loading screen abandons the build, and abandoning it has to
   retire the run — not just the navigation it would have caused.

   Starting a NEW analysis is not the only way to walk away from one. "Start
   over" and "My spaces" both sit in the appbar, which the loading screen keeps
   (it has no step counter, so nothing hides them), and Back is always there.
   A run abandoned that way was still the current run 60 seconds later, so it
   wrote its plan into state on top of whatever the user had moved on to: over
   the answers Start over had just cleared — which the guest-draft writer then
   put back on disk, so the next visit "restored" the plan they deleted — or
   over the saved space they had opened in the meantime.

   Called by the router on every departure from the loading screen. */
export function cancelAnalysis(){
  analysisRun++;
  if(activeAnalysis){ activeAnalysis.abort(); activeAnalysis=null; }
}

export function runLoading(){
  /* Retire the previous run before claiming a token, so the old run's
     isCurrent() is already false by the time its aborted request rejects. */
  cancelAnalysis();
  const runId=analysisRun;
  const controller=(typeof AbortController==='function') ? new AbortController() : null;
  activeAnalysis=controller;
  const isCurrent=()=>analysisRun===runId;

  const wrap=document.getElementById('load-steps'); wrap.innerHTML='';
  const fw=document.getElementById('frames-wrap');
  fw.classList.add('hide');
  const title=document.getElementById('load-title');
  if(title) title.textContent=`Building your ${areaFor(state.space).short} plan…`;
  // Only claim the photo work when photos (or a video) were actually given.
  const hasMedia = state.uploadedFiles.length > 0 || !!state.uploadedVideo;
  const labels = hasMedia
    ? [...LOAD_LABELS_MEDIA, ...LOAD_LABELS_COMMON]
    : [...LOAD_LABELS_NO_MEDIA, ...LOAD_LABELS_COMMON];
  labels.forEach((l,i)=>{
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
      .then(frames=>{
        // Frames belong to the run that extracted them; a superseded run must
        // not paint its thumbnails over the current one's.
        if(isCurrent()){ state.frames=frames; showFrames(frames); }
        return frames;
      })
      .catch(()=>{ return []; });
  }

  // Real analysis through the edge function (photos or video frames)
  const wantsReal = backendConfigured() &&
    ((state.capture==='photos' && (state.uploadedFiles||[]).length) ||
     (state.capture==='video' && state.uploadedVideo));

  // Final checklist row: keeps spinning until the analysis actually finishes,
  // so progress reads top-to-bottom instead of a detached spinner up top.
  const fin=document.createElement('div');
  fin.className='load-step'; fin.id='ls-final';
  fin.innerHTML=`<span class="dot">${ICON.check}</span><span>${
    wantsReal ? 'Waiting for the AI analysis to finish' : 'Finalizing your personalized plan'
  }</span>`;
  wrap.appendChild(fin);

  let aiPromise=null;
  if(wantsReal){
    document.getElementById('load-sub').textContent='Analyzing your space.';
    aiPromise = (async ()=>{
      let images;
      if(state.capture==='video'){
        const frames = await (framesPromise||Promise.resolve([]));
        if(!frames.length) throw new Error('We could not read frames from that video. Try photos instead.');
        images = frames.map(fr=>({ media_type:'image/jpeg', data:fr.data }));
      }else{
        // Encode each photo on its own. Promise.all used to mean one file the
        // browser couldn't decode rejected the whole batch — before a single
        // request left the browser — so the user got the deterministic plan
        // and a bare "Analysis failed" with five perfectly good photos in hand.
        const files=(state.uploadedFiles||[]).slice(0,5);
        const encoded = await Promise.all(files.map(f=>
          fileToScaledB64(f)
            .then(data=>({ media_type:'image/jpeg', data }))
            .catch(e=>{ console.warn('skipping a photo we could not read:', e.message); return null; })
        ));
        images = encoded.filter(Boolean);
        if(!images.length){
          throw new Error('We could not read those photos. JPG or PNG versions usually work.');
        }
      }
      const answer = await analyzeSpace(images.slice(0,6), buildAnalysisContext(),
        controller ? { signal:controller.signal } : {});
      /* Checked before it is destructured, and checked for CONTENT rather than
         truthiness. A null body used to throw "Cannot destructure property
         'plan' of '(intermediate value)' as it is null" — straight into the
         banner the user reads — and `{plan:{}}` passed as a successful analysis,
         so an empty report shipped under the byline "Analyzed by Claude". A
         plan is a map and a list of steps; anything else is a failed analysis,
         whatever status code carried it. */
      const plan = answer && answer.plan;
      const model = answer && answer.model;
      if(!plan || typeof plan!=='object'
        || !Array.isArray(plan.map) || !plan.map.length
        || !Array.isArray(plan.steps) || !plan.steps.length){
        throw new Error('The analysis came back incomplete.');
      }
      /* Bring the model's words into line with the shape the viewer will draw,
         BEFORE normalizing: the honesty pass reads the plan contract's own field
         names (task/why, title/detail), which normalizeAi renames to the render
         shape (t/w, ft/fd), so running it afterwards silently skips the steps
         and the existing-kit cards — the two places the leak was loudest. */
      const drawn = resolveLayout({
        ai: plan, setup: state.setup, setupTouched: state.setupTouched,
        aiFromPhotos: true, scenarioKey: scenarioKeyFor(state.space, state.setup),
        map: plan && plan.map,
      });
      enforceArchetypeHonesty(plan, drawn.type);
      if(!isCurrent()) return;   // superseded mid-flight: this plan is for answers that changed
      state.ai = normalizeAi(plan);
      state.planMeta = { model, source:'ai', analyzedAt: Date.now() };
    })().catch(e=>{
      if(!isCurrent()) return;
      state.aiError = readableError(e); state.ai=null; state.planMeta=null;
    });
    /* A last resort, because finishLoading hands the whole screen to this one
       promise: if it never settles, the spinner runs forever with no banner and
       no way out but a reload, which is a worse failure than any plan we could
       have shown instead. The request itself already has a deadline in
       js/api.js — this covers everything AROUND it, which is where the hang
       actually was. It sits above the request's own budget so a real timeout
       still reports itself in the request's own words. */
    aiPromise = Promise.race([
      aiPromise,
      new Promise(res=>setTimeout(()=>{
        if(isCurrent() && !state.ai && !state.aiError){
          state.aiError = 'That took longer than expected.';
        }
        res();
      }, ANALYSIS_WATCHDOG_MS)),
    ]);
  }else{
    // Space-specific demo data, personalized by the full wizard answer set
    // (prefs, budget, effort, toggles, dims) — never a bare template. The
    // chosen setup can refine the scenario (a walk-in closet gets the
    // walk-in plan, not the reach-in one).
    const scenario = getDemoScenario(scenarioKeyFor(state.space, state.setup), state.goal, state.household, buildAnalysisContext(), state.setup);
    state.ai = normalizeAi(scenario);
    state.planMeta = { model: 'demo', source: 'demo', analyzedAt: Date.now() };
    document.getElementById('load-sub').textContent =
      backendConfigured() ? 'Building your personalized plan.'
                          : 'Generating a sample plan from your selections.';
  }

  let i=0;
  const tick=()=>{
    // A superseded run's ticker is driving rows that belong to the new run.
    if(!isCurrent()) return;
    if(i>0){
      const prev=document.getElementById('ls-'+(i-1));
      if(prev) prev.classList.replace('doing','done');
    }
    /* Count the numbered rows actually rendered — the media rows are
       conditional now. #ls-final is appended separately and is not part of the
       ticker's sequence, so it must not be counted. */
    if(i>=document.querySelectorAll('#load-steps .load-step:not(#ls-final)').length){ finishLoading(aiPromise, isCurrent); return; }
    const row=document.getElementById('ls-'+i);
    if(row) row.classList.add('doing');
    i++;
    setTimeout(tick, i===2?780:430);
  };
  setTimeout(tick,400);
}
export function finishLoading(aiPromise, isCurrent=()=>true){
  const fin=document.getElementById('ls-final');
  if(fin) fin.classList.add('doing');
  const proceed=()=>{
    /* Leaving the loading screen cancels the build. Back is reachable during an
       analysis — they run long enough to press it — and the request cannot be
       recalled, so the finished plan used to arrive later and throw the user
       onto the report from wherever they had navigated to, mid-edit. Someone
       who pressed Back wanted to change an answer; the plan they get should be
       the one built from the answer they changed.

       The screen check alone cannot tell two runs apart — a newer run puts the
       loading screen back up, and the older one would find exactly what it
       expected — so the run token is checked with it. */
    if(!isCurrent() || getCurrentScreen()!=='loading') return;
    track('plan_created', {
      space: state.space || 'unknown',
      source: (state.planMeta && state.planMeta.source) || (state.aiError ? 'demo-fallback' : 'demo'),
      steps: (state.ai && state.ai.steps) ? state.ai.steps.length : 0,
    });
    if(state.aiError){
      document.getElementById('load-sub').innerHTML =
        '<span style="color:var(--danger-ink)">'+escapeHtml(state.aiError)+' &mdash; showing the demo plan instead.</span>';
      if(fin){ fin.classList.remove('doing'); fin.classList.add('err'); }
      // Fallback to demo scenario on AI failure too — same personalization
      const scenario = getDemoScenario(scenarioKeyFor(state.space, state.setup), state.goal, state.household, buildAnalysisContext(), state.setup);
      state.ai = normalizeAi(scenario);
      state.planMeta = { model: 'demo', source: 'demo-fallback', analyzedAt: Date.now() };
      /* Re-checked inside the delay, not only before it. The user has the full
         1400ms to press Back, and the timer used to fire regardless — landing
         them on the report they had just left, or saving a plan they had
         walked away from. */
      setTimeout(()=>{
        if(!isCurrent() || getCurrentScreen()!=='loading') return;
        syncCategoriesToResults(); autoSaveSpace(); go('results');
      }, 1400);
    }else{
      if(fin) fin.classList.replace('doing','done');
      syncCategoriesToResults();
      autoSaveSpace();
      setTimeout(()=>{
        if(!isCurrent() || getCurrentScreen()!=='loading') return;
        go('results');
      }, 550);
    }
  };
  if(aiPromise){ aiPromise.then(proceed); }
  else { setTimeout(proceed, 450); }   // let the final check land visually
}
