import { Accelerometer } from 'expo-sensors';
import { ISleepStageProvider } from './ISleepStageProvider';
import { SleepStage } from '../models/SleepStage';

const MAX_SAMPLES = 3000; // 50Hz × 60s
const LIGHT_SLEEP_THRESHOLD = 0.005;

const samples: number[] = [];

const addSample = (magnitude: number) => {
  samples.push(magnitude);
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
};

const movementVariance = (): number => {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
};

let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

export const MotionService: ISleepStageProvider & {
  start(): void;
  stop(): void;
} = {
  start() {
    Accelerometer.setUpdateInterval(20); // 50Hz
    subscription = Accelerometer.addListener(({ x, y, z }) => {
      addSample(Math.sqrt(x * x + y * y + z * z));
    });
  },

  stop() {
    subscription?.remove();
    subscription = null;
    samples.length = 0;
  },

  currentStage(): Promise<SleepStage | null> {
    const isLight = movementVariance() > LIGHT_SLEEP_THRESHOLD;
    return Promise.resolve(isLight ? SleepStage.Core : SleepStage.Deep);
  },
};
