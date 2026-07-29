import { buildWizard } from './wizard.js';
import { buildCapture } from './capture.js';
import { buildCustomize } from './customize.js';
import { buildSave } from './save.js';
import { buildFeedback } from './feedback.js';

/* ============================================================
   Build screens
   ============================================================ */
export function buildAll(){
  buildWizard(); buildCapture();
  buildCustomize(); buildSave(); buildFeedback();
}

/* buildAll() runs once at startup, long before the household step, so the
   Adjust screen's options have to be rebuilt on entry or their household
   filtering would be stuck on the defaults. Re-exported here so the router
   doesn't have to reach into customize.js directly. */
export { buildCustomize };
