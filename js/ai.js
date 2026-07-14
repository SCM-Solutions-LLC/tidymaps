import { state } from './state.js';
import { iconFor } from './icons.js';
import { toast } from './ui.js';

/* ============================================================
   AI analysis (bring-your-own-key, client-side)
   ============================================================ */
export const AI = {
  key: localStorage.getItem('tidymap_key') || '',
  model: localStorage.getItem('tidymap_model') || 'claude-sonnet-4-6'
};
export function aiReady(){ return !!AI.key; }
export function refreshAiStatus(){
  const dot=document.getElementById('ai-status-dot');
  if(dot) dot.classList.toggle('on', aiReady());
}
export function openSettings(){
  document.getElementById('ai-key-input').value = AI.key;
  document.getElementById('ai-model-select').value = AI.model;
  document.getElementById('ai-clear-btn').style.display = AI.key ? '' : 'none';
  document.getElementById('settings-modal').classList.remove('hide');
}
export function closeSettings(){ document.getElementById('settings-modal').classList.add('hide'); }
export function saveSettings(){
  AI.key = document.getElementById('ai-key-input').value.trim();
  AI.model = document.getElementById('ai-model-select').value;
  if(AI.key) localStorage.setItem('tidymap_key', AI.key); else localStorage.removeItem('tidymap_key');
  localStorage.setItem('tidymap_model', AI.model);
  refreshAiStatus(); closeSettings();
  toast(AI.key ? 'AI connected — your photos will be analyzed for real' : 'Saved');
}
export function clearKey(){
  AI.key=''; localStorage.removeItem('tidymap_key');
  document.getElementById('ai-key-input').value='';
  refreshAiStatus(); toast('API key removed');
}

// Downscale an image File to a base64 JPEG (max ~1100px long edge) to keep cost/size down
export function fileToScaledB64(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const max=1100, scale=Math.min(1, max/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      const data=c.toDataURL('image/jpeg',0.82).split(',')[1];
      URL.revokeObjectURL(img.src); resolve(data);
    };
    img.onerror=reject;
    img.src=URL.createObjectURL(file);
  });
}

const AI_PROMPT = `You are TidyMap AI, a practical home-organization assistant. The user has photographed a storage space (most often a pantry). Analyze ONLY what is visible. Be honest and practical — this is about reorganizing what they already have, not interior design. Do not invent items or features you cannot see.

Return ONLY a JSON object (no markdown, no prose) with exactly these keys:
{
  "spaceType": string,                         // e.g. "Pantry", "Closet"
  "summary": string,                           // 2-3 sentences: what you see + the main organization problem
  "categories": [string],                      // visible item categories, e.g. "Canned goods","Snacks"
  "features": [{"icon": string, "title": string, "sub": string}],  // existing storage features you can see (shelves, baskets, bins, hooks, open space). icon keyword: shelf|basket|bin|door|vertical|horizontal|down|up|hook|empty
  "problems": [string],                        // 3-6 concrete organization problems
  "opportunities": [string],                   // 3-5 quick wins / underused assets
  "map": [{"level": string, "icon": string, "zone": string, "why": string, "eye": boolean}], // shelf-by-shelf plan, top to bottom. icon keyword: up|eye|middle|down|door. Set eye:true for the eye-level row.
  "existingLede": string,                      // 1-2 sentences on using what they own first
  "existing": [{"icon": string, "title": string, "detail": string}],  // reuse instructions for items they already have
  "dontBuy": string,                           // what NOT to buy yet
  "steps": [{"task": string, "time": string, "why": string}],  // 6-9 ordered move-by-move steps. time like "10 min"
  "time": string,                              // total estimate, e.g. "45-90 min"
  "cost": string                               // e.g. "$0 / $40-80"
}
Keep all text concise and practical. If the image is not a storage space, still return the JSON with spaceType:"Unclear" and explain in summary.`;

export async function analyzeWithAI(){
  const files = state.uploadedFiles || [];
  if(!aiReady() || !files.length) return null;
  const imgs = await Promise.all(files.slice(0,5).map(fileToScaledB64));
  const content = imgs.map(d=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:d}}));
  let ctx = `Space the user selected: ${state.space||'pantry'}.`;
  if(state.goal) ctx += ` Their main goal: ${state.goal}.`;
  if(state.prefs && state.prefs.size) ctx += ` Preferences: ${[...state.prefs].join(', ')}.`;
  content.push({type:'text', text: AI_PROMPT + '\n\nContext: ' + ctx});

  const res = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key':AI.key,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body:JSON.stringify({
      model:AI.model, max_tokens:2000,
      messages:[{role:'user',content}]
    })
  });
  if(!res.ok){
    let msg='Request failed ('+res.status+')';
    try{ const e=await res.json(); if(e.error&&e.error.message) msg=e.error.message; }catch(_){}
    throw new Error(msg);
  }
  const data = await res.json();
  let txt = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if(a<0||b<0) throw new Error('Unexpected response from the model.');
  const j = JSON.parse(txt.slice(a,b+1));
  return normalizeAi(j);
}

// Convert raw AI JSON into the exact shapes the UI render code expects
function normalizeAi(j){
  const s = v => (v==null?'':String(v));
  return {
    spaceType: s(j.spaceType)||'Space',
    summary: s(j.summary),
    cats: (j.categories||[]).map(s).filter(Boolean),
    features: (j.features||[]).map(f=>({ico:iconFor(f.icon), ttl:s(f.title), sub:s(f.sub)})),
    problems: (j.problems||[]).map(s).filter(Boolean),
    opportunities: (j.opportunities||[]).map(s).filter(Boolean),
    map: (j.map||[]).map(m=>({lv:s(m.level), ic:iconFor(m.icon), zone:s(m.zone), why:s(m.why), eye:!!m.eye})),
    existingLede: s(j.existingLede),
    existing: (j.existing||[]).map(e=>({ico:iconFor(e.icon), ft:s(e.title), fd:s(e.detail)})),
    dontBuy: s(j.dontBuy),
    steps: (j.steps||[]).map(st=>({t:s(st.task), m:s(st.time)||'—', w:s(st.why)})),
    time: s(j.time)||'45–90 min',
    cost: s(j.cost)||'$0 / $45–85'
  };
}
