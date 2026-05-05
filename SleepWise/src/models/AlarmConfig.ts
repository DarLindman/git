export interface AlarmConfig {
  targetTimeMs: number;
  windowMinutes: number;
  soundId: string;
  maxVolume: number;
}

export const defaultAlarmConfig = (): AlarmConfig => ({
  targetTimeMs: 0,
  windowMinutes: 30,
  soundId: 'forest_morning',
  maxVolume: 1.0,
});

export const windowStartMs = (c: AlarmConfig): number =>
  c.targetTimeMs - c.windowMinutes * 60 * 1000;

export const isWithinWindow = (c: AlarmConfig, nowMs = Date.now()): boolean =>
  nowMs >= windowStartMs(c) && nowMs <= c.targetTimeMs;

export const isPastTarget = (c: AlarmConfig, nowMs = Date.now()): boolean =>
  nowMs > c.targetTimeMs;
