import { DETAIL_TOGGLES } from '../data.js';
import { state } from '../state.js';
import { fillRailSummaries } from '../router.js';

// Parse the measurement inputs into state.dims — stored in inches regardless
// of the unit the user typed in, since the plan contract works in inches.
function readDims(){
  const unit=document.getElementById('d-unit').value;
  const toIn=v=>{
    const n=parseFloat(v);
    if(!Number.isFinite(n)||n<=0) return null;
    return Math.round((unit==='cm'? n/2.54 : n)*10)/10;
  };
  const w=toIn(document.getElementById('d-w').value);
  const h=toIn(document.getElementById('d-h').value);
  const d=toIn(document.getElementById('d-d').value);
  const shelves=parseInt(document.getElementById('d-shelves').value,10)||null;
  state.dims=(w||h||d||shelves)?{w_in:w,h_in:h,d_in:d,shelves}:null;
  fillRailSummaries();
}

export function buildDetails(){
  ['d-w','d-h','d-d','d-shelves','d-unit'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.oninput=readDims; el.onchange=readDims; }
  });
  const wrap=document.getElementById('detail-toggles'); wrap.innerHTML='';
  DETAIL_TOGGLES.forEach(([id,q])=>{
    const row=document.createElement('div'); row.className='qa';
    row.innerHTML=`<span class="q">${q}</span>
      <span class="seg" data-id="${id}">
        <button onclick="segPick(this,'${id}','yes')">Yes</button>
        <button onclick="segPick(this,'${id}','no')">No</button>
      </span>`;
    wrap.appendChild(row);
  });
}
export function segPick(btn,id,val){
  const seg=btn.parentElement;
  seg.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  state['detail_'+id]=val;
}
