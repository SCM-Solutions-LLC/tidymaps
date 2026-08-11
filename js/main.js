/* ============================================================
   TidyMap — entry point
   ============================================================ */
import { toast, setAppbarHeightVar, setFootHeightVar } from './ui.js';
import { state, restoreGuestDraft, applySharedSpace, resetPlanRecord, persistGuestDraft, getUnits } from './state.js';
import { fetchSharedSpace } from './api.js';
import { normalizeAi } from './plan.js';
import { track, telemetryStatus } from './telemetry.js';
import { setRail, go, goNext, goBack, restart, getCurrentScreen, initHistory } from './router.js';
import { getSession } from './auth.js';
import { fetchSpace, applyLoadedSpace } from './db.js';
import { buildAll } from './screens/index.js';
import { runDemo, requestInvite, initLanding, navHome } from './screens/landing.js';
import { openProducts } from './screens/products.js';
import { handleFiles } from './screens/capture.js';
import { toggleUpgrade, uncheckAllUpgrades, setUpgrades, toggleStep, skipStep, toggleStepTip, setStepsView, focusNav, focusDone, buildResults, applySavedProgress, pickProduct, generateAfter, retryAnalysis } from './screens/results.js';
import { useZeroPlan } from './screens/customize.js';
import { submitFeedback, sendRate } from './screens/feedback.js';
import { downloadShoppingList, sendShoppingList } from './planExport.js';
import { setupAccount, openAuth, closeAuth, sendAuthCode, verifyAuthCode } from './screens/account.js';
import { dashSignOut } from './screens/dashboard.js';
import { openViewer3d, saveArrangement, resetArrangement } from './screens/viewer3d.js';
import { initializeRoute } from './startup.js';

/* Expose every function referenced by inline on* handlers
   (in index.html and in injected template strings) */
Object.assign(window, {
  go, goBack, goNext, restart,
  toast, uncheckAllUpgrades, setUpgrades, useZeroPlan,
  runDemo, requestInvite, submitFeedback, sendRate, navHome, openProducts,
  downloadShoppingList, sendShoppingList,
  handleFiles,
  toggleUpgrade, toggleStep, skipStep, toggleStepTip, setStepsView, focusNav, focusDone, pickProduct, generateAfter, retryAnalysis,
  openAuth, closeAuth, sendAuthCode, verifyAuthCode, dashSignOut,
  openViewer3d, saveArrangement, resetArrangement,
  // Answers "is telemetry actually running?" from the console. See
  // telemetryStatus() for why this exists.
  telemetryStatus,
});

/* Before the first render: units are a display choice, and reading them after
   the wizard has drawn itself would show feet for a moment to someone who
   chose centimetres last visit. Its own read is guarded internally, so blocked
   site data falls back to imperial rather than failing the boot. */
state.units = getUnits();

buildAll();
initLanding();
// Before any restore below can navigate, so the session's first history entry
// names the landing page rather than carrying null state.
initHistory();
setRail();
setAppbarHeightVar();
setFootHeightVar();
addEventListener('resize', () => { setAppbarHeightVar(); setFootHeightVar(); });

// TidyMap now runs analysis server-side; scrub any bring-your-own-key
// remnants from the prototype era.
/* Guarded: reading localStorage THROWS, rather than returning null, when site
   data is blocked — third-party-cookie blocking, Safari's Lockdown mode, an
   incognito profile with storage off. An unguarded read here ran before the
   startup routing below and took the whole module down with it, so a share
   link showed the marketing page and never made its request. */
try{
  if(localStorage.getItem('tidymap_key')){
    localStorage.removeItem('tidymap_key');
    localStorage.removeItem('tidymap_model');
    setTimeout(()=>toast('TidyMap now runs its own AI — your saved API key was removed from this browser.'), 800);
  }
}catch(e){ /* no storage available; nothing to clean up */ }

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
}).catch((e)=>{
  /* A stored draft the renderer chokes on used to fail silently here and stay
     on disk, so every later visit repeated it: the visitor landed on the
     marketing page with no explanation, forever. Drop the unreadable PLAN and
     keep the answers, which are what took effort to give. */
  console.error('startup restore failed', e);
  try{
    resetPlanRecord(state);
    persistGuestDraft();
    toast('We could not reopen your last plan, so we cleared it. Your answers are still here.');
  }catch(_){ /* storage unavailable; the message is the most we can do */ }
});
