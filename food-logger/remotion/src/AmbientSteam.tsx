// food-logger/remotion/src/AmbientSteam.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const WISPS = [
  { x: 80,  phase: 0,   swayAmp: 8,  speed: 1.0 },
  { x: 160, phase: 40,  swayAmp: 6,  speed: 0.85 },
  { x: 240, phase: 80,  swayAmp: 10, speed: 1.15 },
] as const;

function Wisp({ x, phase, swayAmp, speed, frame, totalFrames }: {
  x: number; phase: number; swayAmp: number; speed: number;
  frame: number; totalFrames: number;
}) {
  const f = ((frame + phase) * speed) % totalFrames;
  const progress = f / totalFrames; // 0..1 looping

  // Rise: y goes from 280 → 20 over one loop
  const y = interpolate(progress, [0, 1], [280, 20]);

  // Sway: sinusoidal horizontal movement
  const sway = Math.sin(progress * Math.PI * 4) * swayAmp;

  // Fade: appears at bottom, fades near top
  const opacity = interpolate(progress, [0, 0.15, 0.75, 1], [0, 0.6, 0.4, 0]);

  // Scale: wisp widens as it rises
  const scaleX = interpolate(progress, [0, 1], [0.6, 1.4]);

  return (
    <path
      d={`M${x + sway},${y} C${x + sway - 8},${y - 20} ${x + sway + 8},${y - 40} ${x + sway},${y - 60}`}
      stroke={`rgba(240, 232, 220, ${opacity})`}
      strokeWidth={3 * scaleX}
      fill="none"
      strokeLinecap="round"
    />
  );
}

export const AmbientSteam: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <svg
      width="400"
      height="300"
      viewBox="0 0 400 300"
      overflow="visible"
      style={{ background: 'transparent' }}
    >
      {WISPS.map((w, i) => (
        <Wisp key={i} {...w} frame={frame} totalFrames={durationInFrames} />
      ))}
    </svg>
  );
};
