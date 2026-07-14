import { buildSpace } from './space.js';
import { buildCapture } from './capture.js';
import { buildDetails } from './details.js';
import { buildPrefs } from './prefs.js';
import { buildCustomize } from './customize.js';
import { buildSave } from './save.js';
import { buildFeedback } from './feedback.js';

/* ============================================================
   Build screens
   ============================================================ */
export function buildAll(){
  buildSpace(); buildCapture(); buildDetails(); buildPrefs();
  buildCustomize(); buildSave(); buildFeedback();
}
