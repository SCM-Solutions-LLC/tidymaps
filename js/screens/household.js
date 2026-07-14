import { state } from '../state.js';
import { fillRailSummaries } from '../router.js';

const KID_AGES = ['0–4','5–9','10–14'];
const PET_TYPES = ['Dog','Cat','Other'];
const MOBILITY = ['Limited reach','Avoid bending','Wheelchair user','None'];

function segWire(segId, onPick){
  const seg=document.getElementById(segId);
  seg.querySelectorAll('button').forEach(b=>{
    b.onclick=()=>{
      seg.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      onPick(b.dataset.v);
      fillRailSummaries();
    };
  });
}

function chipWire(wrapId, values, isOn, toggle){
  const wrap=document.getElementById(wrapId); wrap.innerHTML='';
  values.forEach(v=>{
    const c=document.createElement('button'); c.className='chip'+(isOn(v)?' sel':''); c.textContent=v;
    c.onclick=()=>{ toggle(v); buildChips(); fillRailSummaries(); };
    wrap.appendChild(c);
  });
  function buildChips(){ chipWire(wrapId, values, isOn, toggle); }
}

export function buildHousehold(){
  const h=state.household;

  segWire('hh-kids-seg', v=>{
    h.kids.present=v;
    if(v!=='yes') h.kids.ages=[];
    document.getElementById('hh-kid-ages').classList.toggle('hide', v!=='yes');
  });
  segWire('hh-pets-seg', v=>{
    h.pets.present=v;
    if(v!=='yes') h.pets.types=[];
    document.getElementById('hh-pet-types').classList.toggle('hide', v!=='yes');
  });

  chipWire('hh-age-chips', KID_AGES,
    v=>h.kids.ages.includes(v),
    v=>{ const i=h.kids.ages.indexOf(v); i<0?h.kids.ages.push(v):h.kids.ages.splice(i,1); });

  chipWire('hh-pet-chips', PET_TYPES,
    v=>h.pets.types.includes(v),
    v=>{ const i=h.pets.types.indexOf(v); i<0?h.pets.types.push(v):h.pets.types.splice(i,1); });

  chipWire('hh-mobility-chips', MOBILITY,
    v=>h.mobility.includes(v),
    v=>{
      if(v==='None'){ h.mobility=h.mobility.includes('None')?[]:['None']; return; }
      const i=h.mobility.indexOf(v);
      i<0?h.mobility.push(v):h.mobility.splice(i,1);
      const n=h.mobility.indexOf('None'); if(n>=0) h.mobility.splice(n,1);
    });

  const notes=document.getElementById('hh-notes');
  notes.value=h.notes;
  notes.oninput=()=>{ h.notes=notes.value; };
}
