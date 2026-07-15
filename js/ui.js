export function toast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200);
}

export function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// The sticky progress bar offsets itself by the real appbar height (--appbar-h),
// which varies with font metrics and viewport width.
export function setAppbarHeightVar(){
  const bar=document.querySelector('.appbar');
  if(bar) document.documentElement.style.setProperty('--appbar-h', bar.offsetHeight+'px');
}

// The toast floats above the flow footer only while the footer is visible.
export function setFootHeightVar(){
  const foot=document.getElementById('flow-foot');
  const h=(foot && !foot.classList.contains('hide')) ? foot.offsetHeight : 0;
  document.documentElement.style.setProperty('--foot-h', h+'px');
}
