export function toast(msg){
  // The pending timer rides on the element so a second toast replaces the
  // first without module-level bookkeeping.
  const t = /** @type {HTMLElement & {_t?: number}} */ (document.getElementById('toast'));
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---------- the site menu ----------
   The hamburger menu is an overlay on the site pages, and on a phone it sits
   over the page the way a dialog does, so while it is open it behaves like
   one: Escape closes it, a tap anywhere outside it closes it, the page behind
   it neither scrolls nor takes the focus (it is inert), and Tab cycles through
   the running head instead of leaving for the page underneath. Opening and
   closing are the only two entry points, so the class on body, the toggle's
   aria-expanded, the scroll lock, the listeners and the inert page are always
   set together. The toggle used to flip the class inline, and every caller
   that closed the menu knew about a different subset of the halves. */
const NAV_OPEN='nav-open';
/** @type {(el: Element|null) => el is HTMLElement} */
const isElement=(el)=>el instanceof HTMLElement;
/** @type {(el: Element) => el is HTMLElement} */
const isVisible=(el)=>isElement(el) && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
// What the menu covers: everything on the page but the running head it hangs from.
const behindNav=()=>[document.querySelector('main'), document.querySelector('.site-footer')].filter(isElement);

function onNavKey(e){
  if(e.key==='Escape'){ closeSiteNav(); return; }
  if(e.key!=='Tab') return;
  const bar=document.querySelector('.appbar');
  if(!bar) return;
  const focusable=[...bar.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(isVisible);
  if(!focusable.length) return;
  const first=focusable[0], last=focusable[focusable.length-1];
  const inside=bar.contains(document.activeElement);
  if(e.shiftKey && (!inside || document.activeElement===first)){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && (!inside || document.activeElement===last)){ e.preventDefault(); first.focus(); }
}
/* Capture phase, so a tap on "Sign in" or the CTA closes the menu and then
   still does its own job; a tap on the menu or its toggle is theirs to handle. */
function onNavPointer(e){
  const target=e.target instanceof Element ? e.target : null;
  if(target && (target.closest('.site-nav') || target.closest('#nav-toggle'))) return;
  closeSiteNav();
}

export function openSiteNav(){
  if(document.body.classList.contains(NAV_OPEN)) return;
  document.body.classList.add(NAV_OPEN);
  const toggle=document.getElementById('nav-toggle');
  if(toggle) toggle.setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
  behindNav().forEach(el=>{ el.inert=true; });
  document.addEventListener('keydown', onNavKey);
  document.addEventListener('click', onNavPointer, true);
  const firstItem=document.querySelector('.site-nav a, .site-nav button');
  if(firstItem instanceof HTMLElement) firstItem.focus();
}

export function closeSiteNav(){
  const wasOpen=document.body.classList.contains(NAV_OPEN);
  document.body.classList.remove(NAV_OPEN);
  const toggle=document.getElementById('nav-toggle');
  if(toggle) toggle.setAttribute('aria-expanded','false');
  if(!wasOpen) return;
  document.body.style.overflow='';
  behindNav().forEach(el=>{ el.inert=false; });
  document.removeEventListener('keydown', onNavKey);
  document.removeEventListener('click', onNavPointer, true);
  // Focus that was in the menu goes back to the button that opened it; focus
  // that was elsewhere (a tap on "Sign in") is that control's business.
  const nav=document.querySelector('.site-nav');
  if(toggle && nav && nav.contains(document.activeElement)) toggle.focus();
}

export function toggleSiteNav(){
  if(document.body.classList.contains(NAV_OPEN)) closeSiteNav();
  else openSiteNav();
}

export function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* The CSS honours prefers-reduced-motion carefully, but scrolling is driven
   from JS and was bypassing it — a smooth scroll is exactly the kind of motion
   the preference exists to stop. These two wrappers are the only way the app
   should scroll. */
export function prefersReducedMotion(){
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function scrollToTop(){
  window.scrollTo({ top:0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
export function scrollIntoViewSafely(el, opts={}){
  if(!el) return;
  el.scrollIntoView({ block:'start', ...opts, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// The sticky progress bar offsets itself by the real appbar height (--appbar-h),
// which varies with font metrics and viewport width.
export function setAppbarHeightVar(){
  const bar = /** @type {HTMLElement} */ (document.querySelector('.appbar'));
  if(bar) document.documentElement.style.setProperty('--appbar-h', bar.offsetHeight+'px');
}

