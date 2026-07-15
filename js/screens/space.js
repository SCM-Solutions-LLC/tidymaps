import { SPACES, GOALS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { updateGate } from '../router.js';

export function buildSpace(){
  const wrap=document.getElementById('space-opts'); wrap.innerHTML='';
  SPACES.forEach(s=>{
    const b=document.createElement('button');
    b.className='opt';
    b.innerHTML=`<span class="ico">${s.ico}</span><span><span class="ttl">${s.ttl}</span></span>${s.rec?'<span class="rec">Recommended</span>':'<span class="tick">'+ICON.check+'</span>'}`;
    b.onclick=()=>{
      wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
      b.classList.add('sel'); state.space=s.id;
      document.getElementById('goal-block').classList.remove('hide');
      updateGate();
    };
    wrap.appendChild(b);
  });
  const gwrap=document.getElementById('goal-opts'); gwrap.innerHTML='';
  GOALS.forEach(([id,txt])=>{
    const b=document.createElement('button');
    b.className='opt';
    b.innerHTML=`<span class="ttl">${txt}</span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{
      gwrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
      b.classList.add('sel'); state.goal=id; updateGate();
    };
    gwrap.appendChild(b);
  });
}
