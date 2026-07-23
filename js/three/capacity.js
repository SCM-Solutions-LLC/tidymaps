/* Pure capacity rules for the 3D viewer. The plan names categories, while
   the measured surface decides how many representative units can be shown.
   Physical objects stay near real-world size instead of stretching to fill
   a large room or becoming unreadably tiny in a small component. */

const WIDTHS={
  garment:{s:7,m:9,l:11},shoe:{s:7,m:9,l:11},linen:{s:7,m:9,l:11},
  bottle:{s:3.5,m:4.25,l:5},can:{s:3.5,m:4.25,l:5},dish:{s:5,m:7,l:9},
  tool:{s:4,m:6,l:8},food:{s:5,m:7,l:9},container:{s:8,m:10,l:13},
  'small-item':{s:4,m:6,l:8},
};

const ORGANIZER_WIDTHS={
  'clear-bin':11,basket:12,divider:12,turntable:12,riser:14,'door-rack':16,'hook-rack':16,
};

function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

export function naturalItemWidth(kind,size='m'){
  const values=WIDTHS[kind]||WIDTHS.container;
  return values[size]||values.m;
}

export function naturalOrganizerWidth(type,maxDims){
  const recommended=Number(maxDims&&maxDims.w_in);
  return clamp(recommended||ORGANIZER_WIDTHS[type]||11,7,18);
}

export function visualUnitCount({availableWidth,kind,size='m',surface='shelf',organizerType,maxDims}){
  const available=Math.max(1,Number(availableWidth)||1);
  const natural=organizerType
    ? naturalOrganizerWidth(organizerType,maxDims)
    : naturalItemWidth(kind,size);
  const gap=surface==='rod'?1:1;
  const maximum=surface==='rod'?5:surface==='drawer'?4:3;
  return clamp(Math.floor((available+gap)/(natural+gap)),1,maximum);
}

export function measuredCapacityProfile({width,height,depth}){
  const w=Math.max(1,Number(width)||1);
  const h=Math.max(1,Number(height)||1);
  const d=Math.max(1,Number(depth)||1);
  const score=Math.cbrt(w*h*d);
  return score<30?'compact':score>45?'spacious':'standard';
}
