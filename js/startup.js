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
}){
  await setupAccount();
  if(currentScreen()!=='landing') return { status:'skipped-navigation' };

  const params=new URLSearchParams(search);
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
