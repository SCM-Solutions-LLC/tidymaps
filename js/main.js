/* ============================================================
   TidyMap AI — entry point
   ============================================================ */
import { toast, setAppbarHeightVar, setFootHeightVar } from './ui.js';
import { refreshAiStatus, openSettings, closeSettings, saveSettings, clearKey } from './ai.js';
import { setRail, go, goNext, goBack, restart } from './router.js';
import { buildAll } from './screens/index.js';
import { runDemo } from './screens/landing.js';
import { handleDrop, handleFiles, handleVideoFile } from './screens/capture.js';
import { segPick } from './screens/details.js';
import { markFeat, removeFeat, addCategory } from './screens/review.js';
import { toggleUpgrade, uncheckAllUpgrades, setUpgrades, toggleStep, skipStep } from './screens/results.js';
import { submitFeedback } from './screens/feedback.js';

/* Expose every function referenced by inline on* handlers
   (in index.html and in injected template strings) */
Object.assign(window, {
  go, goBack, goNext, restart,
  openSettings, closeSettings, saveSettings, clearKey,
  addCategory, toast, uncheckAllUpgrades, setUpgrades,
  runDemo, submitFeedback,
  handleDrop, handleFiles, handleVideoFile,
  segPick, markFeat, removeFeat,
  toggleUpgrade, toggleStep, skipStep
});

buildAll();
setRail();
refreshAiStatus();
setAppbarHeightVar();
setFootHeightVar();
addEventListener('resize', () => { setAppbarHeightVar(); setFootHeightVar(); });
