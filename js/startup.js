import { currentPlanInstance, planInstanceIsCurrent } from './state.js';

/* Route restoration runs after account setup, which may take long enough for
   someone to start using the app. Never let delayed initialization replace a
   route they already chose.

   "Still on the landing page" is the navigation half of that question. The
   plan half is the plan instance (js/state.js): a visitor can start over, or
   the restore itself can be raced by another plan being opened, without the
   screen changing. Both are checked before anything is applied, and for the
   same reason — a restore is one more asynchronous writer that must not land
   on a plan it does not own. */
export async function initializeRoute({
  setupAccount,
  getSession,
  currentScreen,
  search,
  fetchSpace,
  applyLoadedSpace,
  restoreGuestDraft,
  buildResults,
  applySavedProgress,
  getStepDone,
  go,
  toast,
  loadSharedPlan,
  applySharedPlan,
}){
  const instance=currentPlanInstance();
  const owned=()=>currentScreen()==='landing' && planInstanceIsCurrent(instance);
  await setupAccount();
  if(!owned()) return { status:'skipped-navigation' };

  const params=new URLSearchParams(search);

  // Read-only share links work for anyone — no session required, and the
  // visitor's own guest draft is left untouched (shareView blocks the writer).
  const shareId=params.get('share');
  if(shareId && loadSharedPlan){
    try{
      /* Fetch, THEN check the route, THEN apply — the same order the saved
         space path below uses, and for the same reason. loadSharedPlan used to
         apply the payload itself, and applySharedSpace() begins by wiping every
         wizard answer: someone who opened a share link and started their own
         plan while it was in flight had their answers replaced when it landed.
         The navigation was correctly skipped; the damage was already done.
         loadSharedPlan must not touch state — applySharedPlan does that. */
      const payload=await loadSharedPlan(shareId);
      if(!owned()) return { status:'skipped-navigation' };
      if(applySharedPlan) applySharedPlan(payload);
      buildResults();
      go('results');
      toast('You’re viewing a shared plan — read-only');
      return { status:'shared-view' };
    }catch(e){
      toast((e && (e.code==='http_404'||e.code==='not_found'))
        ? 'That share link is no longer active.'
        : 'Could not open that shared plan.');
    }
  }

  const spaceId=params.get('space');
  if(spaceId && getSession()){
    try{
      const loaded=await fetchSpace(spaceId);
      if(!owned()) return { status:'skipped-navigation' };
      const data=applyLoadedSpace(loaded);
      buildResults();
      applySavedProgress((data.progress&&data.progress.stepsDone)||[]);
      go('results');
      return { status:'restored-space' };
    }catch(e){
      toast(e.message);
    }
  }

  if(!owned()) return { status:'skipped-navigation' };
  if(!getSession()){
    const res=restoreGuestDraft();
    if(res && res.planReady){
      const savedSteps=[...(getStepDone()||[])];
      buildResults();
      applySavedProgress(savedSteps);
      go('results');
      toast('Welcome back — we restored your last plan');
      return { status:'restored-draft' };
    }
    /* A reload part-way through the wizard keeps every answer but lands here on
       the landing page, which reads as having lost the session — so people
       start again from scratch on top of answers that were never gone. Say so. */
    if(res && res.restored){
      toast('Your answers are still here — pick up where you left off');
      return { status:'restored-answers' };
    }
  }
  return { status:'unchanged' };
}
