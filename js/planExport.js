import { state } from './state.js';
import { activeMapV2, activeSafetyNotes, activeProductNeeds } from './plan.js';
import { areaFor } from './wizard-data.js';
import { toast } from './ui.js';

/* Plain-text renderings of the plan.

   "Download checklist" and "Send shopping list" sat on the save screen next to
   the buttons that work, and both answered "coming soon" — for a plan that was
   already sitting complete in memory. Everything either one needs is on the
   client, so neither ever needed a backend.

   Text rather than PDF on purpose: it prints, it pastes into Notes or a
   message, and it survives being emailed, which is what someone standing in
   the room with their phone actually does with it. */

function spaceName() {
  if (state.ai && state.ai.spaceType) return state.ai.spaceType;
  return state.space ? areaFor(state.space).label : 'My space';
}

function planSteps() {
  const steps = (state.ai && state.ai.steps) || [];
  return steps.filter((s) => s && s.task);
}

export function checklistText() {
  const name = spaceName();
  const lines = [`${name} — organizing checklist`, ''];

  if (state.ai && state.ai.summary) lines.push(state.ai.summary, '');

  const steps = planSteps();
  if (steps.length) {
    lines.push('STEPS', '');
    steps.forEach((step, i) => {
      // The tick is the point of a checklist: mark off what is already done
      // on screen so a printed copy starts where the person left off.
      const done = Array.isArray(state.stepDone) && state.stepDone[i] ? 'x' : ' ';
      lines.push(`[${done}] ${i + 1}. ${step.task}${step.time ? `  (${step.time})` : ''}`);
      if (step.why) lines.push(`      why: ${step.why}`);
    });
    lines.push('');
  }

  const map = activeMapV2();
  if (map.length) {
    lines.push('ZONES', '');
    map.forEach((row) => {
      lines.push(`- ${row.level}: ${row.zone}`);
      if (row.why) lines.push(`    ${row.why}`);
      if (row.safety && row.safety.why) lines.push(`    safety: ${row.safety.why}`);
    });
    lines.push('');
  }

  const notes = activeSafetyNotes();
  if (notes.length) {
    lines.push('SAFETY NOTES', '');
    notes.forEach((n) => lines.push(`- ${n}`));
    lines.push('');
  }

  return lines.join('\n');
}

export function shoppingListText() {
  const name = spaceName();
  const needs = activeProductNeeds();
  const lines = [`${name} — shopping list`, ''];

  // state.shopping carries the chosen product per need and whether it is still
  // ticked; without it, fall back to describing the need itself.
  const chosen = Array.isArray(state.shopping) ? state.shopping : [];
  const rows = needs.map((need, i) => {
    const sel = chosen[i];
    if (sel && sel.checked === false) return null;
    const qty = Math.max(1, Number(sel && sel.qty) || Number(need.qty) || 1);
    return {
      qty,
      label: (sel && sel.name) || need.type,
      price: sel && sel.price_usd,
      retailer: sel && sel.retailer,
      url: sel && sel.url,
      purpose: need.purpose,
      zone: need.targetZone,
      dims: need.maxDims,
    };
  }).filter(Boolean);

  if (!rows.length) {
    lines.push('Nothing to buy — this plan uses what you already own.');
    return lines.join('\n');
  }

  let total = 0;
  rows.forEach((row) => {
    const price = Number(row.price);
    if (Number.isFinite(price)) total += price * row.qty;
    lines.push(`${row.qty} x ${row.label}${Number.isFinite(price) ? `  ($${price.toFixed(2)} each)` : ''}`);
    if (row.zone) lines.push(`    for: ${row.zone}`);
    if (row.purpose) lines.push(`    ${row.purpose}`);
    if (row.dims && row.dims.w_in) {
      lines.push(`    must fit: ${row.dims.w_in}w x ${row.dims.h_in}h x ${row.dims.d_in}d inches`);
    }
    if (row.url) lines.push(`    ${row.retailer ? `${row.retailer}: ` : ''}${row.url}`);
    lines.push('');
  });

  if (total > 0) lines.push(`Estimated total: $${total.toFixed(2)}`);
  return lines.join('\n');
}

// Slugged from the space so two downloads don't collide in the same folder.
export function planFileName(suffix, ext) {
  const slug = spaceName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'space';
  return `tidymap-${slug}-${suffix}.${ext}`;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* The two actions themselves. They live here rather than on the save screen
   because the report's shopping card offers the same two things, and a second
   copy of them is how "Save shopping list" ended up on the report still
   answering with a toast that claimed a save nothing had performed. */

export function downloadChecklist() {
  if (!state.ai) { toast('Build a plan first.'); return; }
  downloadText(planFileName('checklist', 'txt'), checklistText());
  toast('Checklist downloaded.');
}

export function downloadShoppingList() {
  if (!state.ai) { toast('Build a plan first.'); return; }
  downloadText(planFileName('shopping-list', 'txt'), shoppingListText());
  toast('Shopping list downloaded.');
}

/* "Send" without a mail backend means handing it to the mail client the person
   already uses. mailto has a practical length limit and silently truncates
   past it, so anything long goes to the clipboard instead of arriving cut in
   half — and the clipboard is the fallback again if no mail client answers. */
const MAILTO_LIMIT = 1800;

export async function sendShoppingList() {
  if (!state.ai) { toast('Build a plan first.'); return; }
  const body = shoppingListText();
  const href = `mailto:?subject=${encodeURIComponent('TidyMap shopping list')}&body=${encodeURIComponent(body)}`;
  if (href.length <= MAILTO_LIMIT) {
    location.href = href;
    toast('Opening your email with the list.');
    return;
  }
  try {
    await navigator.clipboard.writeText(body);
    toast('Shopping list copied — too long to email directly, so paste it wherever you like.');
  } catch (_) {
    downloadText(planFileName('shopping-list', 'txt'), body);
    toast('Shopping list downloaded.');
  }
}
