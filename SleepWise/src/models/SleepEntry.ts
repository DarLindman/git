import { SleepStage } from './SleepStage';

export interface SleepEntry {
  id: string;
  stage: SleepStage;
  startMs: number;
  endMs: number;
}

export const entryDurationMs = (e: SleepEntry): number => e.endMs - e.startMs;
