// food-logger/remotion/src/FireLoop.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  xOffset: (((i * 73) % 51) - 25),
  swayAmp: 8 + (i * 37) % 13,
  speedMul: 0.7 + (i * 17 % 30) / 100,
  phaseOffset: Math.floor((i / 15) * 60),
  baseRadius: 7 + (i * 11) % 5,
}));

function Particle({ id, xOffset, swayAmp, speedMul, phaseOffset, baseRadius, frame, totalFrames }: {
  id: number; xOffset: number; swayAmp: number; speedMul: number;
  phaseOffset: number; baseRadius: number; frame: number; totalFrames: number;
}) {
  const f = ((frame + phaseOffset) * speedMul) % totalFrames;
  const progress = f / totalFrames;

  const cx = 100 + xOffset + Math.sin(progress * Math.PI * 3 + id) * swayAmp;
  const cy = interpolate(progress, [0, 1], [295, 20]);
  const r = interpolate(progress, [0, 1], [baseRadius, 1.5]);
  const opacity = interpolate(progress, [0, 0.08, 0.65, 1], [0, 1, 0.75, 0]);

  // Colors per spec: #FF2200 → #FF6600 → #FFB300 → near-white (fades via opacity)
  const red   = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [255, 255, 255, 255]));
  const green = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [34,  102, 179, 220]));
  const blue  = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [0,   0,   0,   0]));

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={`rgba(${red},${green},${blue},${opacity})`}
    />
  );
}

export const FireLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <svg width="200" height="320" viewBox="0 0 200 320"
      style={{ background: '#000000' }}>
      {PARTICLES.map(p => (
        <Particle key={p.id} {...p} frame={frame} totalFrames={durationInFrames} />
      ))}
    </svg>
  );
};
