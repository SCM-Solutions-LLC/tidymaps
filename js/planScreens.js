/* ============================================================
   The plan's screens, loaded on first use
   ============================================================

   The report (screens/results.js), the analysis (screens/loading.js), Adjust
   (screens/customize.js) and the export (planExport.js) were imported at
   boot, and with them the modules only they reach: personalize.js,
   setupStructure.js, catalog.js and the room-board rules it reads, the step
   media. That was 15 of the 46 modules and 134KB of the 265KB gzipped that
   every visitor's landing page fetched before a button worked. None of the
   four can show anything until there is a plan, so they wait for one.
   Measured 10-25 on a local HTTP/2 server at 390px, slow 4G and a 4x CPU,
   median of 8: ready 3.4s to 2.5s, the headline's paint no later.

   Each loader imports its module once and keeps the promise; a failed
   import is forgotten so the next attempt can try again. When a module
   lands, the functions inline on* handlers call replace the stand-ins
   main.js put on window, so from then on a handler (or a test driving one)
   runs synchronously, as it did when everything loaded at boot. */

const RESULTS_GLOBALS = ['toggleUpgrade', 'uncheckAllUpgrades', 'setUpgrades', 'toggleStep', 'skipStep',
  'toggleStepTip', 'setStepsView', 'focusNav', 'focusDone', 'pickProduct', 'generateAfter', 'retryAnalysis'];
const CUSTOMIZE_GLOBALS = ['useZeroPlan'];
const EXPORT_GLOBALS = ['downloadShoppingList', 'sendShoppingList'];

/** @type {Promise<any>|null} */ let results = null;
/** @type {Promise<any>|null} */ let loading = null;
/** @type {Promise<any>|null} */ let customize = null;
/** @type {Promise<any>|null} */ let planExport = null;
/** @type {any} */ let loadingModule = null;

/** @param {any} m @param {string[]} names */
function expose(m, names) {
  const win = /** @type {any} */ (window);
  for (const name of names) win[name] = m[name];
  return m;
}

export function loadResults() {
  if (!results) {
    results = import('./screens/results.js')
      .then((m) => expose(m, RESULTS_GLOBALS))
      .catch((e) => { results = null; throw e; });
    /* The report imports the analysis itself (Retry runs it), and the export
       is the next thing a reader can ask for: both are fetched now, so the
       router can cancel a run without waiting and a click on "Send list"
       does not wait on the network. */
    results.then(() => { loadLoading().catch(() => {}); loadPlanExport().catch(() => {}); }, () => {});
  }
  return results;
}

export function loadLoading() {
  if (!loading) {
    loading = loadResults()
      .then(() => import('./screens/loading.js'))
      .then((m) => { loadingModule = m; return m; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export function loadCustomize() {
  if (!customize) {
    customize = loadResults()
      .then(() => import('./screens/customize.js'))
      .then((m) => expose(m, CUSTOMIZE_GLOBALS))
      .catch((e) => { customize = null; throw e; });
  }
  return customize;
}

export function loadPlanExport() {
  if (!planExport) {
    planExport = import('./planExport.js')
      .then((m) => expose(m, EXPORT_GLOBALS))
      .catch((e) => { planExport = null; throw e; });
  }
  return planExport;
}

/* Synchronous on purpose. The router retires a run the moment the loading
   screen is left, before anything else can land (screens/loading.js,
   cancelAnalysis); waiting on even a resolved import would let a finished
   analysis's answer in first. A run only starts once the module is here
   (loadResults fetches it, and the router's own start awaits it), so a
   module not loaded yet means there is no run to cancel. */
export function cancelAnalysis() {
  if (loadingModule) loadingModule.cancelAnalysis();
}

/* main.js's stand-ins: each loads its module, then calls the real function,
   which by then has replaced the stand-in. */
export function planScreenGlobals() {
  /** @param {() => Promise<any>} load @param {string[]} names */
  const standIns = (load, names) => Object.fromEntries(
    names.map((name) => [name, async (/** @type {any[]} */ ...args) => (await load())[name](...args)]));
  return {
    ...standIns(loadResults, RESULTS_GLOBALS),
    ...standIns(loadCustomize, CUSTOMIZE_GLOBALS),
    ...standIns(loadPlanExport, EXPORT_GLOBALS),
  };
}
