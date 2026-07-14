/* Client-side media handling: everything is downscaled before it leaves
   the device to keep payloads and analysis costs small. */

// Pull n evenly-spread frames out of a video File as base64 JPEGs.
// Runs entirely client-side via a hidden <video> + canvas.
export async function extractVideoFrames(file, n=6){
  const url=URL.createObjectURL(file);
  const video=document.createElement('video');
  video.muted=true; video.playsInline=true; video.preload='auto'; video.src=url;
  try{
    await new Promise((res,rej)=>{
      video.onloadedmetadata=res;
      video.onerror=()=>rej(new Error('Could not read that video file.'));
    });
    // iOS/Safari won't honor seeks until playback has started once
    try{ await video.play(); video.pause(); }catch(_){ /* autoplay refusal is fine */ }
    let dur=video.duration;
    if(!Number.isFinite(dur)){
      // MediaRecorder-produced WebM reports Infinity until forced to the end
      await new Promise(res=>{
        const t=setTimeout(res,2500);
        video.ondurationchange=()=>{ if(Number.isFinite(video.duration)){ clearTimeout(t); res(); } };
        video.currentTime=1e9;
      });
      dur=Number.isFinite(video.duration)?video.duration:0;
    }
    const c=document.createElement('canvas');
    const ctx=c.getContext('2d');
    const frames=[];
    for(let i=0;i<n;i++){
      const t=dur ? dur*(0.08+0.84*(n===1?0:i/(n-1))) : 0;
      await new Promise(res=>{
        let done=false;
        const finish=()=>{ if(done) return; done=true; video.removeEventListener('seeked',finish); res(); };
        video.addEventListener('seeked',finish);
        setTimeout(finish,3000);          // some codecs never fire seeked reliably
        video.currentTime=t;
      });
      const max=1100, scale=Math.min(1, max/Math.max(video.videoWidth||1,video.videoHeight||1));
      c.width=Math.round((video.videoWidth||640)*scale);
      c.height=Math.round((video.videoHeight||480)*scale);
      ctx.drawImage(video,0,0,c.width,c.height);
      frames.push({ data:c.toDataURL('image/jpeg',0.82).split(',')[1], t });
    }
    return frames;
  }finally{
    URL.revokeObjectURL(url);
  }
}

export function formatTime(sec){
  const s=Math.max(0,Math.round(sec));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}

// Downscale an image File to a base64 JPEG (max ~1100px long edge)
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
