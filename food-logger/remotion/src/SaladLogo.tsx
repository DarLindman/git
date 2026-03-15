import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

const SIZE = 360;
const CX = SIZE / 2; // 180
const CY = SIZE / 2; // 180
// All original icon coords were in 180x180 space; scale to 360x360
const S = 2;

type PieceProps = {
  delay: number;
  children: React.ReactNode;
  dropY?: number;
  rotate?: number;
};

function FallingPiece({ delay, children, dropY = -160, rotate = 0 }: PieceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shifted = frame - delay;

  const progress = spring({
    frame: shifted,
    fps,
    config: { damping: 11, stiffness: 140, mass: 0.8 },
  });

  const y = interpolate(progress, [0, 1], [dropY, 0]);
  const opacity = interpolate(shifted, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rot = interpolate(progress, [0, 1], [rotate, 0]);

  return (
    <g
      style={{
        transform: `translateY(${y}px) rotate(${rot}deg)`,
        transformOrigin: `${CX}px ${CY}px`,
        opacity,
      }}
    >
      {children}
    </g>
  );
}

export const SaladLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orange rounded-rect background — scales in from center
  const bgScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  // Bowl slides in from above (as one piece)
  // Ingredients are staggered after the bowl lands

  return (
    <AbsoluteFill
      style={{
        background: "#0d0b09",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
      >
        {/* ── Orange background ── */}
        <g
          style={{
            transform: `scale(${bgScale})`,
            transformOrigin: `${CX}px ${CY}px`,
          }}
        >
          <rect
            width={SIZE}
            height={SIZE}
            rx={76}
            fill="#E8703A"
          />
        </g>

        {/* ── Bowl (falls in from top) ── */}
        <FallingPiece delay={8} dropY={-180}>
          {/* Bowl rim ellipse: original (90, 108) rx=62 ry=18 → scaled */}
          <ellipse cx={CX} cy={CY + 36} rx={124} ry={36} fill="#FFFFFF" />
          {/* Bowl body: lower semicircle */}
          <path
            d={`M ${CX - 124} ${CY + 36} A 124 124 0 0 0 ${CX + 124} ${CY + 36} Z`}
            fill="#FFFFFF"
          />
        </FallingPiece>

        {/* ── Green leaves (staggered) ── */}

        {/* Center-top large leaf: original (90, 78, 19) → (180, 156, 38) */}
        <FallingPiece delay={15} dropY={-140} rotate={12}>
          <circle cx={CX} cy={156} r={38} fill="#388E3C" />
        </FallingPiece>

        {/* Left-center leaf: original (68, 86, 18) → (136, 172, 36) */}
        <FallingPiece delay={20} dropY={-130} rotate={-10}>
          <circle cx={136} cy={172} r={36} fill="#4CAF50" />
        </FallingPiece>

        {/* Right-center leaf: original (114, 86, 18) → (228, 172, 36) */}
        <FallingPiece delay={25} dropY={-130} rotate={8}>
          <circle cx={228} cy={172} r={36} fill="#4CAF50" />
        </FallingPiece>

        {/* Far-left leaf: original (52, 100, 13) → (104, 200, 26) */}
        <FallingPiece delay={30} dropY={-120} rotate={-15}>
          <circle cx={104} cy={200} r={26} fill="#66BB6A" />
        </FallingPiece>

        {/* Far-right leaf: original (128, 100, 13) → (256, 200, 26) */}
        <FallingPiece delay={35} dropY={-120} rotate={15}>
          <circle cx={256} cy={200} r={26} fill="#66BB6A" />
        </FallingPiece>

        {/* Right-of-center leaf: original (100, 92, 13) → (200, 184, 26) */}
        <FallingPiece delay={39} dropY={-110} rotate={5}>
          <circle cx={200} cy={184} r={26} fill="#81C784" />
        </FallingPiece>

        {/* Left-of-center leaf: original (80, 94, 11) → (160, 188, 22) */}
        <FallingPiece delay={43} dropY={-110} rotate={-5}>
          <circle cx={160} cy={188} r={22} fill="#A5D6A7" />
        </FallingPiece>

        {/* ── Tomato (red): original (78, 100, 11) → (156, 200, 22) ── */}
        <FallingPiece delay={48} dropY={-100} rotate={-8}>
          <circle cx={156} cy={200} r={22} fill="#EF5350" />
        </FallingPiece>

        {/* ── Corn (yellow): original (106, 102, 7) → (212, 204, 14) ── */}
        <FallingPiece delay={53} dropY={-90} rotate={10}>
          <circle cx={212} cy={204} r={14} fill="#FFD54F" />
        </FallingPiece>
      </svg>
    </AbsoluteFill>
  );
};
