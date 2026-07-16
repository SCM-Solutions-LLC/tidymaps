import { SPACES, SPACE_GROUPS, GOALS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { updateGate } from '../router.js';

const CHEVRON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

export function buildSpace(){
  const wrap=document.getElementById('space-opts'); wrap.innerHTML='';
  const byId=Object.fromEntries(SPACES.map(s=>[s.id,s]));

  SPACE_GROUPS.forEach((g,gi)=>{
    const sec=document.createElement('div');
    sec.className='space-group'+((gi===0 || (state.space && g.spaces.includes(state.space)))?' open':'');

    const head=document.createElement('button');
    head.type='button'; head.className='sg-head';
    head.setAttribute('aria-expanded', sec.classList.contains('open')?'true':'false');
    head.innerHTML=`<span>${g.label}</span><span class="sg-count">${g.spaces.length}</span>${CHEVRON}`;
    head.onclick=()=>{
      sec.classList.toggle('open');
      head.setAttribute('aria-expanded', sec.classList.contains('open')?'true':'false');
    };

    const body=document.createElement('div');
    body.className='sg-body grid grid-auto';
    g.spaces.forEach(id=>{
      const s=byId[id]; if(!s) return;
      const b=document.createElement('button');
      b.className='opt'+(state.space===s.id?' sel':'');
      b.innerHTML=`<span class="ico">${s.ico}</span><span><span class="ttl">${s.ttl}</span></span>${s.rec?'<span class="rec">Recommended</span>':'<span class="tick">'+ICON.check+'</span>'}`;
      b.onclick=()=>{
        wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
        b.classList.add('sel'); state.space=s.id;
        document.getElementById('goal-block').classList.remove('hide');
        updateGate();
      };
      body.appendChild(b);
    });

    sec.append(head, body);
    wrap.appendChild(sec);
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
