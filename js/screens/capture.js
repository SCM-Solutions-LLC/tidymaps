/* ============================================================
   Photos step — "Add a few honest photos".

   A grid of square photo tiles plus an add tile, exactly per the design
   prototype. The existing client-side quality pre-check stays: dark or
   blurry photos get an advisory badge, never a block.

   Detection: with no backend configured, adding photos runs the design's
   client-side "Here's what we spotted" affordance and pre-fills the
   contents step from the space's detection list. With a real backend the
   photos are analyzed for real when the plan is built — inventing
   detections here would be a lie.
   ============================================================ */
import { SPACE_CFG } from '../wizard-data.js';
import { state } from '../state.js';
import { toast, escapeHtml } from '../ui.js';
import { backendConfigured } from '../config.js';
import { assessImageFile, qualityLabel } from '../imageQuality.js';

const MAX_PHOTOS = 6;

/* Per-file quality verdicts, keyed by the File object so they survive reorder
   and removal. Advisory only: a flagged photo still uploads if the user keeps it. */
const photoQuality = new WeakMap();
/* Object URLs per File, revoked on removal. */
const previewUrls = new WeakMap();

export function buildCapture(){
  renderPhotoTiles();
  const input = document.getElementById('photo-input');
  if(input) input.onchange = () => { handleFiles(input.files); input.value = ''; };
}

export function renderPhotoTiles(){
  const grid = document.getElementById('photo-tiles');
  if(!grid) return;
  grid.innerHTML = '';
  let flagged = 0;
  state.uploadedFiles.forEach((file, i) => {
    const tile = document.createElement('div');
    tile.className = 'wz-photo';
    let url = previewUrls.get(file);
    if(!url){ url = URL.createObjectURL(file); previewUrls.set(file, url); }
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Uploaded space photo';
    tile.appendChild(img);
    const warn = qualityLabel(photoQuality.get(file));
    if(warn){
      flagged++;
      const flag = document.createElement('span');
      flag.className = 'wp-flag';
      flag.textContent = warn;
      tile.appendChild(flag);
    }
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'wp-x';
    rm.setAttribute('aria-label', 'Remove photo');
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    rm.onclick = () => {
      const u = previewUrls.get(file);
      if(u){ try{ URL.revokeObjectURL(u); }catch(_){} previewUrls.delete(file); }
      state.uploadedFiles.splice(i, 1);
      renderPhotoTiles();
    };
    tile.appendChild(rm);
    grid.appendChild(tile);
  });
  if(state.uploadedFiles.length < MAX_PHOTOS){
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'wz-photo-add';
    add.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
      <span>Add photos</span>`;
    add.onclick = () => document.getElementById('photo-input').click();
    grid.appendChild(add);
  }
  // Advisory line: a retake usually gives a better plan, but nothing is blocked.
  const note = document.getElementById('photo-quality-note');
  if(note){
    note.classList.toggle('hide', !flagged);
    if(flagged) note.textContent = flagged === 1
      ? 'One photo looks dark or blurry. Retaking it in better light usually gives a sharper plan, but you can continue.'
      : flagged + ' photos look dark or blurry. Retaking them in better light usually gives a sharper plan, but you can continue.';
  }
}

export function handleFiles(fileList){
  const newFiles = [...fileList].filter(f => f.type.startsWith('image/'));
  if(!newFiles.length) return;
  const room = MAX_PHOTOS - state.uploadedFiles.length;
  if(room <= 0){ toast(MAX_PHOTOS + ' photos is plenty. Remove one to add another.'); return; }
  if(newFiles.length > room) toast('Using the first ' + room + '. ' + MAX_PHOTOS + ' photos is plenty.');
  const added = newFiles.slice(0, room);
  state.uploadedFiles = state.uploadedFiles.concat(added);
  state.capture = 'photos';
  renderPhotoTiles();
  // Assess each new photo off the main thread; re-render as verdicts land so a
  // "Too dark"/"Blurry" badge appears without holding up the preview.
  added.forEach(file => {
    assessImageFile(file).then(a => {
      if(a){ photoQuality.set(file, a); if(state.uploadedFiles.includes(file)) renderPhotoTiles(); }
    });
  });
  if(!backendConfigured()) runLocalDetection();
}

/* Design-spec detection affordance for the no-backend path: a short look,
   then "Here's what we spotted" chips that pre-fill the contents step.
   User edits stay authoritative — a touched category list is never refilled. */
let detectTimer = null;
function runLocalDetection(){
  const spin = document.getElementById('photo-analyzing');
  const found = document.getElementById('photo-detected');
  if(spin) spin.classList.remove('hide');
  if(found) found.classList.add('hide');
  clearTimeout(detectTimer);
  detectTimer = setTimeout(() => {
    const cfg = SPACE_CFG[state.space] || SPACE_CFG.pantry;
    state.detected = cfg.detect.slice();
    if(!state.catsTouched){
      cfg.detectCats.forEach(c => { if(!state.cats.includes(c)) state.cats.push(c); });
    }
    if(spin) spin.classList.add('hide');
    if(found){
      found.classList.remove('hide');
      document.getElementById('photo-detected-chips').innerHTML =
        state.detected.map(d => `<span class="wz-detected-chip">${escapeHtml(d)}</span>`).join('');
    }
  }, 1600);
}
