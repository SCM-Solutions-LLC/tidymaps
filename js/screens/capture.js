import { CAPTURE } from '../data.js';
import { SVG, ICON } from '../icons.js';
import { state } from '../state.js';
import { toast } from '../ui.js';
import { updateGate } from '../router.js';

export function buildCapture(){
  const wrap=document.getElementById('capture-opts'); wrap.innerHTML='';
  CAPTURE.forEach(c=>{
    const b=document.createElement('button');
    b.className='opt';
    b.innerHTML=`<span class="ico">${c.ico}</span><span><span class="ttl">${c.ttl}</span><span class="sub">${c.sub}</span></span><span class="tick">${ICON.check}</span>`;
    b.onclick=()=>{
      wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
      b.classList.add('sel'); state.capture=c.id;
      renderCaptureDetail(c.id); updateGate();
    };
    wrap.appendChild(b);
  });
}
export function renderCaptureDetail(id){
  const d=document.getElementById('capture-detail');
  d.classList.remove('hide');
  if(id==='photos'){
    d.innerHTML=`
    <div class="card pad">
      <div id="photo-drop" style="border:2px dashed var(--line-2);border-radius:12px;padding:26px;text-align:center;background:var(--surface-2);transition:.2s;cursor:pointer" onclick="document.getElementById('photo-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--primary)';this.style.background='var(--primary-bg)'" ondragleave="this.style.borderColor='var(--line-2)';this.style.background='var(--surface-2)'" ondrop="handleDrop(event)">
        <div style="color:var(--primary)">${SVG.cameraBig}</div>
        <div style="font-weight:600;margin-top:6px">Drop 3&ndash;5 photos here</div>
        <div class="small muted">or tap to choose from your library</div>
        <input type="file" id="photo-input" accept="image/*" multiple style="display:none" onchange="handleFiles(this.files)">
        <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="event.stopPropagation();document.getElementById('photo-input').click()">Choose photos</button>
      </div>
      <div id="photo-previews" style="display:none;margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="small" style="font-weight:600"><span id="photo-count">0</span> photos selected</span>
          <button class="btn btn-ghost btn-sm" style="padding:6px 12px;font-size:12px" onclick="document.getElementById('photo-input').click()">Add more</button>
        </div>
        <div id="photo-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px"></div>
      </div>
      <div class="small" style="margin-top:16px;font-weight:600">For best results</div>
      <ul class="problems" style="margin-top:8px">
        <li>Take one straight-on photo</li>
        <li>Take one photo from the left side</li>
        <li>Take one photo from the right side</li>
        <li>Capture the full shelf, cabinet, or storage area</li>
        <li>Open doors or drawers if relevant</li>
      </ul>
    </div>`;
  }else if(id==='video'){
    d.innerHTML=`
    <div class="card pad">
      <div style="border:2px dashed var(--line-2);border-radius:12px;padding:26px;text-align:center;background:var(--surface-2);cursor:pointer" onclick="document.getElementById('video-input').click()">
        <div style="color:var(--primary)">${SVG.videoBig}</div>
        <div style="font-weight:600;margin-top:6px">Record or upload a short video</div>
        <div class="small muted">We&rsquo;ll extract key frames to understand the space</div>
        <input type="file" id="video-input" accept="video/*" style="display:none" onchange="handleVideoFile(this.files)">
        <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="event.stopPropagation();document.getElementById('video-input').click()">Choose video</button>
      </div>
      <div id="video-preview" style="display:none;margin-top:14px"></div>
      <div class="helper" style="margin-top:16px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Slowly scan the space left to right, then top to bottom. Show shelves, corners, doors, hooks, bins, baskets, drawers, and hard-to-reach areas. Open cabinets or drawers if relevant.</span>
      </div>
    </div>`;
  }else{
    d.innerHTML=`
    <div class="card pad" style="background:var(--primary-bg);border-color:var(--primary-line)">
      <div style="font-weight:600">Using the demo pantry</div>
      <p class="small" style="margin:6px 0 0;color:var(--ink-2)">We&rsquo;ll load a sample messy pantry with realistic detected items and features so you can see the full plan. Tap Continue.</p>
    </div>`;
  }
}

export function handleDrop(e){
  e.preventDefault();
  const drop=document.getElementById('photo-drop');
  drop.style.borderColor='var(--line-2)';drop.style.background='var(--surface-2)';
  const files=e.dataTransfer.files;
  if(files.length) handleFiles(files);
}

export function handleFiles(fileList){
  const newFiles=[...fileList].filter(f=>f.type.startsWith('image/'));
  if(!newFiles.length) return;
  const room=5-state.uploadedFiles.length;
  if(room<=0){ toast('5 photos is plenty. Remove one to add another.'); return; }
  if(newFiles.length>room) toast('Using the first '+room+'. 5 photos is plenty.');
  state.uploadedFiles=state.uploadedFiles.concat(newFiles.slice(0,room));
  renderPhotoPreviews();
}

export function renderPhotoPreviews(){
  const wrap=document.getElementById('photo-previews');
  const grid=document.getElementById('photo-grid');
  const count=document.getElementById('photo-count');
  if(!state.uploadedFiles.length){wrap.style.display='none';return;}
  wrap.style.display='block';
  count.textContent=state.uploadedFiles.length;
  grid.innerHTML='';
  state.uploadedFiles.forEach((file,i)=>{
    const div=document.createElement('div');
    div.style.cssText='position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:var(--surface-2)';
    const img=document.createElement('img');
    img.style.cssText='width:100%;height:100%;object-fit:cover';
    img.src=URL.createObjectURL(file);
    img.onload=()=>URL.revokeObjectURL(img.src);
    const rm=document.createElement('button');
    rm.style.cssText='position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:14px;cursor:pointer;display:grid;place-items:center;line-height:1';
    rm.innerHTML='&times;';
    rm.onclick=(e)=>{e.stopPropagation();state.uploadedFiles.splice(i,1);renderPhotoPreviews();};
    const name=document.createElement('div');
    name.style.cssText='position:absolute;bottom:0;left:0;right:0;padding:3px 6px;background:linear-gradient(transparent,rgba(0,0,0,.5));color:#fff;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    name.textContent=file.name;
    div.appendChild(img);div.appendChild(rm);div.appendChild(name);
    grid.appendChild(div);
  });
}

export function handleVideoFile(fileList){
  const file=[...fileList].find(f=>f.type.startsWith('video/'));
  if(!file)return;
  state.uploadedVideo=file;
  const wrap=document.getElementById('video-preview');
  wrap.style.display='block';
  wrap.innerHTML='';
  const vid=document.createElement('video');
  vid.src=URL.createObjectURL(file);
  vid.controls=true;
  vid.style.cssText='width:100%;border-radius:10px;border:1px solid var(--line);max-height:300px;background:#000';
  const info=document.createElement('div');
  info.className='small';
  info.style.cssText='margin-top:8px;display:flex;justify-content:space-between;align-items:center';
  info.innerHTML=`<span style="font-weight:600;color:var(--ink)">${file.name}</span><button class="btn btn-ghost btn-sm" style="padding:6px 12px;font-size:12px" onclick="document.getElementById('video-input').click()">Replace</button>`;
  wrap.appendChild(vid);wrap.appendChild(info);
}
