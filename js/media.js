/* Client-side media handling: everything is downscaled before it leaves
   the device to keep payloads and analysis costs small. */

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
