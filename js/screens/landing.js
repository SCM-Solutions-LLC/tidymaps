import { state } from '../state.js';
import { toast } from '../ui.js';
import { go } from '../router.js';
import { buildResults } from './results.js';

/* ---------- Demo shortcut ---------- */
export function runDemo(){
  state.space='pantry'; state.goal='find'; state.capture='demo';
  state.upgrades=true;
  buildResults();
  go('results');
  toast('Loaded the example pantry plan');
}
