import { DETAIL_TOGGLES } from '../data.js';
import { state } from '../state.js';

export function buildDetails(){
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
