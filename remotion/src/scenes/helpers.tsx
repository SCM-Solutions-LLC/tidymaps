import React from 'react';
import { color, FLOOR_Y } from '../tokens';
import { geoFor, MotifGeo } from '../motifs';

/* Shared staging rules so all 13 scenes place items identically. */

export const EASE_IN: [number, number, number, number] = [0.42, 0, 1, 1];
export const EASE_OUT_CSS: [number, number, number, number] = [0, 0, 0.58, 1];

/* Where items belong on a motif: hangers hang from the rail (rod or
   pegboard row), everything else stands on the working surface — except on
   the rail motif, where standing items live on the floor (shoes under the
   clothes). Scenes with no rail on the motif draw their own short rod when
   they must hang something (see <PopUpRail/>). */
export const itemSpots = (motif: string, glyph: string) => {
  const geo: MotifGeo = geoFor(motif);
  const hung = glyph === 'hanger';
  const y = hung ? geo.railY
    : motif === 'rail' ? FLOOR_Y
    : geo.surfaces[geo.work].y;
  return { geo, hung, y, xs: geo.anchorXs };
};

/* A short rod for hang stories on motifs that lack one. */
export const PopUpRail: React.FC<{ geo: MotifGeo; opacity?: number }> = ({ geo, opacity = 1 }) => (
  <g opacity={opacity}>
    <path d={`M${geo.railX[0]} ${geo.railY} H${geo.railX[1]}`} />
  </g>
);

/* An open-topped bin, mouth up, in one of the scene accent duos. The purge
   story's keep/donate/toss trio uses all three in order. */
export const BIN_TONES = [
  { fill: color.primaryBg, stroke: color.primary },
  { fill: color.honey, stroke: color.honey2 },
  { fill: color.sageBg, stroke: color.sage },
] as const;

export const Bin: React.FC<{
  cx: number; y?: number; w?: number; h?: number;
  tone?: number; opacity?: number;
}> = ({ cx, y = FLOOR_Y, w = 24, h = 15, tone = 0, opacity = 1 }) => {
  const t = BIN_TONES[tone % BIN_TONES.length];
  return (
    <path
      d={`M${cx - w / 2} ${y - h} V${y - 3} a3 3 0 0 0 3 3 h${w - 6} a3 3 0 0 0 3 -3 V${y - h}`}
      fill={t.fill}
      stroke={t.stroke}
      opacity={opacity}
    />
  );
};

/* A lidless moving box in plain ink, for the unload story. */
export const Crate: React.FC<{ cx: number; y?: number; w?: number; h?: number; opacity?: number }> =
  ({ cx, y = FLOOR_Y, w = 34, h = 18, opacity = 1 }) => (
    <g opacity={opacity}>
      <path d={`M${cx - w / 2} ${y - h} V${y - 3} a3 3 0 0 0 3 3 h${w - 6} a3 3 0 0 0 3 -3 V${y - h}`} />
      <path d={`M${cx - w / 2 - 3} ${y - h} h${w + 6}`} />
    </g>
  );
