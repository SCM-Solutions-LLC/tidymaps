/* ============================================================
   TidyMap AI — entry point
   ============================================================ */
import { toast, setAppbarHeightVar, setFootHeightVar } from './ui.js';
import { state, restoreGuestDraft } from './state.js';
import { setRail, go, goNext, goBack, restart } from './router.js';
import { getSession } from './auth.js';
import { loadSpace } from './db.js';
import { buildAll } from './screens/index.js';
import { runDemo, requestInvite, initLanding } from './screens/landing.js';
import { handleDrop, handleFiles, handleVideoFile } from './screens/capture.js';
import { segPick } from './screens/details.js';
import { markFeat, removeFeat, addCategory } from './screens/review.js';
import { toggleUpgrade, uncheckAllUpgrades, setUpgrades, toggleStep, skipStep, buildResults, applySavedProgress, pickProduct, generateAfter } from './screens/results.js';
import { submitFeedback } from './screens/feedback.js';
import { setupAccount, openAuth, closeAuth, sendAuthCode, verifyAuthCode } from './screens/account.js';
import { dashSignOut } from './screens/dashboard.js';
import { openViewer3d, saveArrangement, resetArrangement } from './screens/viewer3d.js';

/* Expose every function referenced by inline on* handlers
   (in index.html and in injected template strings) */
Object.assign(window, {
  go, goBack, goNext, restart,
  addCategory, toast, uncheckAllUpgrades, setUpgrades,
  runDemo, requestInvite, submitFeedback,
  handleDrop, handleFiles, handleVideoFile,
  segPick, markFeat, removeFeat,
  toggleUpgrade, toggleStep, skipStep, pickProduct, generateAfter,
  openAuth, closeAuth, sendAuthCode, verifyAuthCode, dashSignOut,
  openViewer3d, saveArrangement, resetArrangement,
});

buildAll();
initLanding();
setRail();
setAppbarHeightVar();
setFootHeightVar();
addEventListener('resize', () => { setAppbarHeightVar(); setFootHeightVar(); });

// TidyMap now runs analysis server-side; scrub any bring-your-own-key
// remnants from the prototype era.
if(localStorage.getItem('tidymap_key')){
  localStorage.removeItem('tidymap_key');
  localStorage.removeItem('tidymap_model');
  setTimeout(()=>toast('TidyMap now runs its own AI — your saved API key was removed from this browser.'), 800);
}

// Session restore + deep links, then guest-draft recovery as the fallback.
(async ()=>{
  await setupAccount();          // no-op when the backend isn't configured
  const params=new URLSearchParams(location.search);
  const spaceId=params.get('space');
  if(spaceId && getSession()){
    try{
      const data=await loadSpace(spaceId);
      buildResults();
      applySavedProgress((data.progress&&data.progress.stepsDone)||[]);
      go('results');
      return;
    }catch(e){ toast(e.message); }
  }
  if(!getSession()){
    const res=restoreGuestDraft();
    if(res && res.planReady){
      const savedSteps=[...(state.stepDone||[])];
      buildResults();
      applySavedProgress(savedSteps);
      go('results');
      toast('Welcome back — we restored your last plan');
    }
  }
})();
