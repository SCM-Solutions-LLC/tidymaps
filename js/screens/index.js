import { buildWizard } from './wizard.js';
import { buildCapture } from './capture.js';
import { buildSave } from './save.js';
import { buildFeedback } from './feedback.js';

/* ============================================================
   Build screens
   ============================================================ */
/* Adjust is not built here: its options depend on the household answer, so
   the router builds it on every entry, and its module loads with the report
   (js/planScreens.js). */
export function buildAll(){
  buildWizard(); buildCapture();
  buildSave(); buildFeedback();
}
