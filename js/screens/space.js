import { SPACES, SPACE_GROUPS, GOALS } from '../data.js';
import { ICON } from '../icons.js';
import { state } from '../state.js';
import { updateGate } from '../router.js';

const CHEVRON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

const ROOMS = [
  {id:'kitchen', label:'Kitchen', sub:'Pantry, cabinets &amp; drawers', groups:['kitchen'],
   photo:'assets/photos/ex-cab-after.png'},
  {id:'bedroom', label:'Bedroom', sub:'Closet &amp; dresser', groups:['closets'],
   photo:''},
  {id:'bath',    label:'Bathroom &amp; hall', sub:'Vanity &amp; linen closet', groups:['bath','storage','more'],
   photo:''},
];

export function buildSpace(){
  const cardWrap=document.getElementById('room-cards');
  const spaceWrap=document.getElementById('space-opts');
  if(cardWrap) cardWrap.innerHTML='';
  spaceWrap.innerHTML='';
  const byId=Object.fromEntries(SPACES.map(s=>[s.id,s]));

  ROOMS.forEach(room=>{
    const card=document.createElement('button');
    card.type='button';
    card.className='room-card';
    const hasPhoto=!!room.photo;
    card.innerHTML=`
      ${hasPhoto?`<img src="${room.photo}" alt="${room.label}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`:''}
      <div class="rc-fallback" style="${hasPhoto?'display:none':''}"></div>
      <div class="rc-gradient"></div>
      <div class="rc-label"><h3>${room.label}</h3><p>${room.sub}</p></div>
      <span class="rc-check">${CHECK}</span>
    `;
    card.onclick=()=>{
      cardWrap.querySelectorAll('.room-card').forEach(c=>c.classList.remove('sel'));
      card.classList.add('sel');
      showSpacesForRoom(room, spaceWrap, byId);
    };
    cardWrap.appendChild(card);
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

function showSpacesForRoom(room, wrap, byId){
  wrap.innerHTML='';
  wrap.classList.remove('hide');

  const groupIds=room.groups;
  const matchingGroups=SPACE_GROUPS.filter(g=>groupIds.includes(g.id));
  const allSpaces=matchingGroups.flatMap(g=>g.spaces);

  if(allSpaces.length===1){
    state.space=allSpaces[0];
    document.getElementById('goal-block').classList.remove('hide');
    updateGate();
    wrap.classList.add('hide');
    return;
  }

  allSpaces.forEach(id=>{
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
    wrap.appendChild(b);
  });
}
