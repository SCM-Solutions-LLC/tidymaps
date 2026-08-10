/* CSS-keyframe-shaped animation helper. The inline STEP_ART scenes are
   written as @keyframes with percentage stops; scenes here port that
   choreography, so the natural authoring unit is the same: percentage stops
   over the loop, one easing between them. kf() turns
     kf(frame, dur, [[0,0],[15,0],[55,16],[70,16]], EASE)
   into the equivalent interpolate() call, holding the last value to 100%.
   A stop list that starts and ends on the same value loops seamlessly. */
import { Easing, interpolate } from 'remotion';

export type Stops = Array<[pct: number, value: number]>;

export const kf = (
  frame: number,
  durationInFrames: number,
  stops: Stops,
  ease: [number, number, number, number],
): number => {
  const input = stops.map(([p]) => (p / 100) * durationInFrames);
  const output = stops.map(([, v]) => v);
  return interpolate(frame, input, output, {
    easing: Easing.bezier(...ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

/* Linear variant for opacity fades, which the CSS scenes do without easing
   drama (easing on opacity reads as flicker at this size). */
export const kfLinear = (frame: number, durationInFrames: number, stops: Stops): number => {
  const input = stops.map(([p]) => (p / 100) * durationInFrames);
  const output = stops.map(([, v]) => v);
  return interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};
