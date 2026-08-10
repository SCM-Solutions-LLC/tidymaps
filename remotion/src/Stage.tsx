import React from 'react';
import { AbsoluteFill } from 'remotion';
import { color, STROKE, VIEW_H, VIEW_W } from './tokens';

/* The shared canvas every scene draws on: the .step-art band's own surface
   color (so `object-fit: contain` letterboxing is invisible), and one SVG in
   the site's line-art language — 2.5-unit ink-3 strokes, round caps and
   joins, fill none — matching the inline STEP_ART scenes and js/icons.js. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: color.bg }}>
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height="100%"
      fill="none"
      stroke={color.ink3}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  </AbsoluteFill>
);
