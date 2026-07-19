/* Route restoration runs after account setup, which may take long enough for
   someone to start using the app. Never let delayed initialization replace a
   route they already chose. */
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
}){
  await setupAccount();
  if(currentScreen()!=='landing') return { status:'skipped-navigation' };

  const params=new URLSearchParams(search);

  // Read-only share links work for anyone — no session required, and the
  // visitor's own guest draft is left untouched (shareView blocks the writer).
  const shareId=params.get('share');
  if(shareId && loadSharedPlan){
    try{
      await loadSharedPlan(shareId);
      if(currentScreen()!=='landing') return { status:'skipped-navigation' };
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
      if(currentScreen()!=='landing') return { status:'skipped-navigation' };
      const data=applyLoadedSpace(loaded);
      buildResults();
      applySavedProgress((data.progress&&data.progress.stepsDone)||[]);
      go('results');
      return { status:'restored-space' };
    }catch(e){
      toast(e.message);
    }
  }

  if(currentScreen()!=='landing') return { status:'skipped-navigation' };
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
  }
  return { status:'unchanged' };
}
