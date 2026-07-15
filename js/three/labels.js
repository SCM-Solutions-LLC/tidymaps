import * as THREE from 'three';

// Canvas-texture sprite labels — avoids pulling in the CSS2D renderer addon.
export function makeLabelSprite(text, { size=13, color='#4a3f38', bg='rgba(255,255,255,.88)', pad=7 }={}){
  const dpr=2;
  const font=`600 ${size*dpr}px "DM Sans", sans-serif`;
  const c=document.createElement('canvas');
  const g=c.getContext('2d');
  g.font=font;
  const tw=g.measureText(text).width;
  c.width=Math.ceil(tw+pad*2*dpr);
  c.height=Math.ceil((size+pad)*dpr*1.35);
  g.font=font;
  g.fillStyle=bg;
  const r=8*dpr;
  g.beginPath();
  g.roundRect(0,0,c.width,c.height,r);
  g.fill();
  g.fillStyle=color;
  g.textBaseline='middle';
  g.fillText(text, pad*dpr, c.height/2);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false });
  const sprite=new THREE.Sprite(mat);
  // world size proportional to text, tuned for inch-scale scenes
  const worldH=2.6;
  sprite.scale.set(worldH*(c.width/c.height), worldH, 1);
  sprite.userData.isLabel=true;
  return sprite;
}
