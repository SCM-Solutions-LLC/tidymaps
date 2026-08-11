import { ROOMS, AREAS, SETUP_TYPES } from '../wizard-data.js';
import { loadCatalog, priceAsOf, TYPE_LABEL } from '../catalog.js';
import { withAffiliate, affiliateRel, affiliatesConfigured, AFFILIATE_DISCLOSURE } from '../affiliates.js';
import { getDemoScenario } from '../demo-scenarios.js';
import { productArt } from '../product-art.js';
import { go } from '../router.js';
import { setArea } from './wizard.js';

/* ============================================================
   Product library — every item TidyMap can suggest, grouped by the
   space it belongs in.

   Which categories a space calls for is not restated here: it is read
   back out of that space's own plan (demo-scenarios.js), which is the
   same source the planner and the sample plan use. So a category can
   only appear on this page if a real plan actually asks for it, and the
   reason shown under each heading is the plan's own wording.
   ============================================================ */

let catalog = null;
let built = false;
const filters = { room: 'all', type: 'all' };

/* ---------- What each space asks for ----------
   Derived twice: once for a household with no kids, once with kids and
   pets present. The difference is exactly the child-safety hardware,
   which is then labeled as conditional rather than shown as standard. */
const KID_HOUSEHOLD = { kids: { present: 'yes', ages: ['Toddler'] }, pets: { present: 'yes' } };

function needsFor(spaceId){
  const base = getDemoScenario(spaceId).productNeeds || [];
  const withKids = getDemoScenario(spaceId, null, KID_HOUSEHOLD).productNeeds || [];
  const baseTypes = new Set(base.map(n => n.type));
  const seen = new Set();
  return withKids.filter(n => {
    if(seen.has(n.type)) return false;
    seen.add(n.type);
    return true;
  }).map(n => ({ type: n.type, purpose: n.purpose, kidOnly: !baseTypes.has(n.type) }));
}

/* ---------- Formatting ---------- */
const num = n => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
function dimStr(d){
  if(!d) return '';
  return `${num(d.w)}″ W × ${num(d.h)}″ H × ${num(d.d)}″ D`;
}
function priceStr(p){
  return p == null ? 'Price varies' : '$' + (Number.isInteger(p) ? p : p.toFixed(2));
}
function esc(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- Rendering ---------- */

/* A real retailer photo when the catalog has one, the category drawing when it
   doesn't — and the drawing again if the photo 404s, since a hotlinked
   retailer URL can rotate at any time. */
function productVisual(p, tone){
  const art = productArt(p.type);
  if(!p.img) return `<span class="pc-art card-visual tone-${tone}">${art}</span>`;
  return `<span class="pc-art card-visual tone-${tone} has-photo">${art}` +
    `<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async" ` +
    `onerror="this.parentElement.classList.remove('has-photo');this.remove()"></span>`;
}

function productCard(p, index){
  return `
    <article class="pcard">
      ${productVisual(p, index % 4)}
      <div class="pc-body">
        <div class="pc-head">
          <span class="pc-brand">${esc(p.brand)}</span>
          <span class="pc-price">${priceStr(p.price_usd)}</span>
        </div>
        <a class="pc-name" href="${esc(withAffiliate(p.url, p.retailer))}" target="_blank" rel="${affiliateRel(p.retailer)}">${esc(p.name)}</a>
        <div class="pc-meta">
          <span class="pc-dims">${dimStr(p.dims_in)}</span>
          <span class="pc-retailer">at ${esc(p.retailer)}</span>
        </div>
      </div>
    </article>`;
}

function typeBlock(need, products){
  if(!products.length) return '';
  return `
    <section class="ptype">
      <h4>${esc(TYPE_LABEL[need.type] || need.type)}${need.kidOnly ? '<span class="ptype-tag">with kids or pets</span>' : ''}</h4>
      <p class="ptype-why">${esc(need.purpose)}</p>
      <div class="pcards">${products.map((p, i) => productCard(p, i)).join('')}</div>
    </section>`;
}

/* Areas collapse. Showing every room at once is a long page by design — it is
   the whole library — so only the first space is expanded until someone
   narrows to a room, at which point that room's spaces all open. */
function areaBlock(room, area, open){
  const needs = needsFor(area.id).filter(n => filters.type === 'all' || n.type === filters.type);
  const groups = needs.map(n => ({ need: n, items: catalog.products.filter(p => p.type === n.type) }))
    .filter(g => g.items.length);
  if(!groups.length) return '';
  const count = groups.reduce((sum, g) => sum + g.items.length, 0);
  const setups = (SETUP_TYPES[area.id] || []).map(s => s.label).join(' · ');
  return `
    <details class="parea"${open ? ' open' : ''}>
      <summary class="parea-head">
        <div class="parea-titles">
          <h3>${esc(area.label)}</h3>
          <p class="parea-setups">${esc(room.label)} &middot; ${esc(setups)}</p>
          <p class="parea-count">${groups.length} ${groups.length === 1 ? 'category' : 'categories'} &middot; ${count} products</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-plan-room="${room.id}" data-plan-area="${area.id}">Plan this space</button>
      </summary>
      ${groups.map(g => typeBlock(g.need, g.items)).join('')}
    </details>`;
}

function renderFilters(){
  const roomWrap = document.getElementById('prod-room-filter');
  const typeWrap = document.getElementById('prod-type-filter');
  if(!roomWrap || !typeWrap) return;
  const chip = (val, label, active) =>
    `<button class="chip${active ? ' sel' : ''}" aria-pressed="${active}" data-val="${val}">${esc(label)}</button>`;
  roomWrap.innerHTML = chip('all', 'All rooms', filters.room === 'all')
    + ROOMS.map(r => chip(r.id, r.label, filters.room === r.id)).join('');
  // Only categories that some space actually asks for, in catalog order.
  const used = [...new Set(catalog.products.map(p => p.type))];
  typeWrap.innerHTML = chip('all', 'Everything', filters.type === 'all')
    + used.map(t => chip(t, TYPE_LABEL[t] || t, filters.type === t)).join('');
}

function renderList(){
  const wrap = document.getElementById('prod-groups');
  if(!wrap || !catalog) return;
  const rooms = ROOMS.filter(r => filters.room === 'all' || r.id === filters.room);
  const oneRoom = filters.room !== 'all';
  let shown = 0;
  const html = rooms.map(r => (AREAS[r.id] || []).map(a => {
    const block = areaBlock(r, a, oneRoom || shown === 0);
    if(block) shown++;
    return block;
  }).join('')).join('');
  wrap.innerHTML = html || '<p class="muted">No products in that combination yet.</p>';
  const asOf = priceAsOf();
  const note = document.getElementById('prod-asof');
  // This page carries every affiliate link on the site, so the FTC disclosure
  // that already accompanies the report's shopping card belongs here too.
  if(note) note.textContent = (asOf ? `Prices approximate, checked ${asOf}. Links open the retailer's own page.` : '')
    + (affiliatesConfigured() ? ' ' + AFFILIATE_DISCLOSURE : '');
}

/* ---------- Entry ---------- */
export async function buildProducts(){
  if(built) return;
  // openProducts() navigates here first and then builds, so the screen is blank
  // for the length of the catalog fetch. Fill it with the shape of what's coming.
  const groupsEl = document.getElementById('prod-groups');
  if(groupsEl){
    groupsEl.setAttribute('aria-busy','true');
    groupsEl.innerHTML = `<div class="parea" aria-hidden="true" style="padding:16px">
        <span class="skeleton skeleton-text short" style="height:16px"></span>
        <ul class="sk-list" style="margin-top:14px">
          <li class="sk-prod"><span class="skeleton sk-thumb"></span>
            <span class="sk-lines"><span class="skeleton skeleton-text long"></span>
            <span class="skeleton skeleton-text short"></span></span></li>
        </ul>
      </div>`.repeat(2);
  }
  try{
    catalog = await loadCatalog();
  }catch(e){
    if(groupsEl){
      groupsEl.removeAttribute('aria-busy');
      groupsEl.innerHTML = '<p class="load-failed">We could not load the product library just now. '
        + 'Please try again in a moment.</p>';
    }
    return;
  }
  if(groupsEl) groupsEl.removeAttribute('aria-busy');
  built = true;
  renderFilters();
  renderList();

  const rooms = document.getElementById('prod-room-filter');
  const types = document.getElementById('prod-type-filter');
  const groups = document.getElementById('prod-groups');
  rooms.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if(!b) return;
    filters.room = b.dataset.val; renderFilters(); renderList();
  });
  types.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if(!b) return;
    filters.type = b.dataset.val; renderFilters(); renderList();
  });
  groups.addEventListener('click', e => {
    const b = e.target.closest('[data-plan-area]'); if(!b) return;
    e.preventDefault();   // the button sits inside <summary>: don't also toggle
    setArea(b.dataset.planRoom, b.dataset.planArea);
    go('setup');
  });
}

export function openProducts(roomId){
  if(roomId) filters.room = roomId;
  go('products');   // the router emits screen_viewed for the funnel
  buildProducts().then(() => { if(roomId){ renderFilters(); renderList(); } });
  scrollTo(0, 0);
}
