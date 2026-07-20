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
