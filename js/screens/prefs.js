import { PREFS, BUDGETS, EFFORT } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';

export function buildPrefs(){
  const pc=document.getElementById('pref-chips'); pc.innerHTML='';
  PREFS.forEach(p=>{
    const c=document.createElement('button'); c.className='chip'; c.innerHTML=p;
    c.onclick=()=>{
      c.classList.toggle('sel');
      if(c.classList.contains('sel')) state.prefs.add(p); else state.prefs.delete(p);
      if(p==='Open to buying storage') state.upgrades=c.classList.contains('sel');
    };
    pc.appendChild(c);
  });
  const bc=document.getElementById('budget-chips'); bc.innerHTML='';
  BUDGETS.forEach(b=>{
    const c=document.createElement('button'); c.className='chip'; c.textContent=b;
    c.onclick=()=>{
      bc.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel'));
      c.classList.add('sel'); state.budget=b;
      if(b!=='$0'&&b!=='No budget selected') state.upgrades=true;
    };
    bc.appendChild(c);
  });
  const ec=document.getElementById('effort-opts'); ec.innerHTML='';
  EFFORT.forEach(([t,s])=>{
    const b=document.createElement('button'); b.className='opt';
    b.innerHTML=`<span><span class="ttl">${t}</span><span class="sub">${s}</span></span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{ec.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));b.classList.add('sel');state.effort=t;};
    ec.appendChild(b);
  });
}
