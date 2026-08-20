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

/* A photo that never resolves and never rejects is the worst outcome here, and
   it was reachable two ways. The encode ran inside `img.onload` with nothing
   around it, so anything the canvas threw — an allocation refused on a huge
   image, a tainted-canvas SecurityError out of toDataURL — escaped into the
   event handler and settled neither side of the promise. And a browser that
   fires neither load nor error on a file leaves both handlers waiting forever.

   Either one strands the caller, and the caller is the loading screen: it
   awaits the encodes before any request is made, so the deadline in js/api.js
   never comes into it. The user gets a spinner with no banner, no fallback and
   no way out but a reload. Every path out of here now settles. */
const ENCODE_TIMEOUT_MS = 20000;

/* How big a photo leaves the browser.

   ANALYSIS is the long-standing 1100px. Up to five photos go to analyze-space
   in one request, under a 100s budget, and the model is reading the space
   rather than redrawing it.

   RENDER is one photo, and the job is different: gemini-2.5-flash-image has to
   pick up individual jars and boxes and put them back somewhere else. At
   1100px across a wide corner pantry a jar is roughly forty pixels, which is
   near the floor of what can be re-staged as a recognisable object — the first
   renders came back globally brightened and straightened rather than
   rearranged. 1568 is the tile size Gemini works in, and the upload has room:
   1100px at q0.82 runs 0.2-0.4MB against the function's 2.1M-character
   inbound cap.

   Raised for the render path only, so the analysis keeps its current cost and
   latency and the experiment moves one variable. */
export const ANALYSIS_MAX_EDGE = 1100;
export const RENDER_MAX_EDGE = 1568;

/**
 * @param {File|Blob} file
 * @param {{maxEdge?: number}} [opts]
 * @returns {Promise<string>} base64 JPEG, no data: prefix
 */
export function fileToScaledB64(file, { maxEdge = ANALYSIS_MAX_EDGE } = {}){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    let url=null, timer=null, done=false;
    const unreadable = ()=>new Error(`Could not read ${file.name || 'that photo'}. It may be in a format this browser cannot open, like HEIC.`);
    const settle=(fn,value)=>{
      if(done) return;
      done=true;
      clearTimeout(timer);
      if(url) URL.revokeObjectURL(url);
      fn(value);
    };
    img.onload=()=>{
      try{
        const max=maxEdge, scale=Math.min(1, max/Math.max(img.width,img.height));
        const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        const data=c.toDataURL('image/jpeg',0.82).split(',')[1];
        settle(resolve,data);
      }catch(_){
        // The photo decoded but we could not re-encode it. Same outcome for
        // the user as one we could not read, and the caller skips it either way.
        settle(reject,unreadable());
      }
    };
    // onerror hands back an Event, not an Error, so a caller reading
    // `e.message` got undefined and reported "Analysis failed" for what is
    // really "this browser cannot decode this file" (HEIC is the usual one).
    img.onerror=()=>settle(reject,unreadable());
    timer=setTimeout(()=>settle(reject,unreadable()), ENCODE_TIMEOUT_MS);
    try{
      url=URL.createObjectURL(file);
      img.src=url;
    }catch(_){
      settle(reject,unreadable());
    }
  });
}
