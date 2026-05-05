import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../src/design/tokens';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function AuroraBackground({ children }: { children?: React.ReactNode }) {
  const opacity1 = useSharedValue(0.8);
  const opacity2 = useSharedValue(0.6);

  useEffect(() => {
    opacity1.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 7000 }),
        withTiming(0.6, { duration: 7000 }),
      ),
      -1,
      false,
    );
    opacity2.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 9000 }),
        withTiming(0.9, { duration: 9000 }),
      ),
      -1,
      false,
    );
  }, []);

  const glow1Style = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const glow2Style = useAnimatedStyle(() => ({ opacity: opacity2.value }));

  return (
    <View style={styles.container}>
      {/* Base dark layer */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />

      {/* Teal glow — top right, breathing */}
      <AnimatedLinearGradient
        colors={['rgba(60,200,180,0.28)', 'transparent']}
        style={[StyleSheet.absoluteFill, styles.glow1, glow1Style]}
        start={{ x: 0.7, y: 0 }}
        end={{ x: 0.2, y: 0.6 }}
      />

      {/* Purple glow — bottom left, counter-breathing */}
      <AnimatedLinearGradient
        colors={['rgba(100,60,180,0.22)', 'transparent']}
        style={[StyleSheet.absoluteFill, styles.glow2, glow2Style]}
        start={{ x: 0, y: 0.7 }}
        end={{ x: 0.7, y: 0.2 }}
      />

      {/* Blue depth layer — constant */}
      <LinearGradient
        colors={['transparent', 'rgba(20,60,120,0.18)', 'transparent']}
        style={[StyleSheet.absoluteFill]}
        start={{ x: 0.8, y: 0.8 }}
        end={{ x: 0.2, y: 0.2 }}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  base: {
    backgroundColor: Colors.bg,
  },
  glow1: {
    borderRadius: 0,
  },
  glow2: {
    borderRadius: 0,
  },
});
