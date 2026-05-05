import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { SleepEntry } from '../../src/models/SleepEntry';
import { SleepStage } from '../../src/models/SleepStage';
import { Colors } from '../../src/design/tokens';

interface Props {
  entries: SleepEntry[];
  width?: number;
  height?: number;
}

const STAGE_Y: Record<SleepStage, number> = {
  [SleepStage.Awake]: 6,
  [SleepStage.Core]:  22,
  [SleepStage.REM]:   36,
  [SleepStage.Deep]:  52,
};

function buildPath(entries: SleepEntry[], width: number, height: number): string {
  if (!entries.length) return `M0,${height / 2}L${width},${height / 2}`;

  const totalMs = entries[entries.length - 1].endMs - entries[0].startMs;
  if (totalMs === 0) return `M0,${height / 2}L${width},${height / 2}`;

  const points = entries.flatMap((e) => {
    const x1 = ((e.startMs - entries[0].startMs) / totalMs) * width;
    const x2 = ((e.endMs   - entries[0].startMs) / totalMs) * width;
    const y  = STAGE_Y[e.stage];
    return [
      { x: x1, y },
      { x: x2, y },
    ];
  });

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return d + ` L${width},${points[points.length - 1].y.toFixed(1)}`;
}

export function SleepGraph({ entries, width = 280, height = 60 }: Props) {
  const pathData = buildPath(entries, width, height);

  // Dot position at last entry
  const lastEntry  = entries[entries.length - 1];
  const dotY       = lastEntry ? STAGE_Y[lastEntry.stage] : height / 2;
  const dotOpacity = useSharedValue(0.4);

  useEffect(() => {
    dotOpacity.value = withTiming(1, { duration: 800 });
  }, [entries.length]);

  const fillPath = pathData + ` L${width},${height} L0,${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(60,200,180,0.3)" />
            <Stop offset="100%" stopColor="rgba(60,200,180,0)" />
          </LinearGradient>
        </Defs>

        {/* Fill under curve */}
        <Path d={fillPath} fill="url(#fill)" />

        {/* Stroke */}
        <Path
          d={pathData}
          fill="none"
          stroke={Colors.graphStroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current position dot */}
        {lastEntry && (
          <>
            <Circle cx={width - 20} cy={dotY} r={7} fill="rgba(60,200,180,0.15)" />
            <Circle cx={width - 20} cy={dotY} r={3.5} fill="rgba(60,200,180,0.8)" />
          </>
        )}
      </Svg>
    </View>
  );
}
