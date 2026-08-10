import React from 'react';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* STUB — replaced by the real done choreography. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const { xs, y } = itemSpots(motif, glyph);
  return <g>{xs.map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}</g>;
};
