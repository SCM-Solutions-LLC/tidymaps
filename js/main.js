/* ============================================================
   TidyMap — entry point
   ============================================================ */
import { toast, setAppbarHeightVar, setFootHeightVar } from './ui.js';
import { state, restoreGuestDraft, applySharedSpace } from './state.js';
import { fetchSharedSpace } from './api.js';
import { normalizeAi } from './plan.js';
import { track } from './telemetry.js';
import { setRail, go, goNext, goBack, restart, getCurrentScreen } from './router.js';
import { getSession } from './auth.js';
import { fetchSpace, applyLoadedSpace } from './db.js';
import { buildAll } from './screens/index.js';
import { runDemo, requestInvite, initLanding } from './screens/landing.js';
import { handleFiles } from './screens/capture.js';
import { toggleUpgrade, uncheckAllUpgrades, setUpgrades, toggleStep, skipStep, toggleStepTip, setStepsView, focusNav, focusDone, buildResults, applySavedProgress, pickProduct, generateAfter } from './screens/results.js';
import { submitFeedback } from './screens/feedback.js';
import { setupAccount, openAuth, closeAuth, sendAuthCode, verifyAuthCode } from './screens/account.js';
import { dashSignOut } from './screens/dashboard.js';
import { openViewer3d, saveArrangement, resetArrangement } from './screens/viewer3d.js';
import { initializeRoute } from './startup.js';

/* Expose every function referenced by inline on* handlers
   (in index.html and in injected template strings) */
Object.assign(window, {
  go, goBack, goNext, restart,
  toast, uncheckAllUpgrades, setUpgrades,
  runDemo, requestInvite, submitFeedback,
  handleFiles,
  toggleUpgrade, toggleStep, skipStep, toggleStepTip, setStepsView, focusNav, focusDone, pickProduct, generateAfter,
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
// Route restoration is guarded so delayed account setup cannot interrupt a
// person who has already opened the wizard, results, or 3D viewer.
initializeRoute({
  setupAccount,
  getSession,
  currentScreen:getCurrentScreen,
  search:location.search,
  fetchSpace,
  applyLoadedSpace,
  restoreGuestDraft,
  buildResults,
  applySavedProgress,
  getStepDone:()=>state.stepDone,
  go,
  toast,
  // Read-only share links: fetch the sanitized payload, apply it as a
  // share view (blocks draft writes), and normalize the plan for rendering.
  loadSharedPlan: async (shareId)=>{
    const { space } = await fetchSharedSpace(shareId);
    applySharedSpace(space);
    state.ai = normalizeAi(space.plan);
    state.planMeta = space.planMeta || null;
    track('shared_plan_viewed', {});
  },
}).catch((e)=>console.error('startup restore failed', e));
