import { SleepEntry, entryDurationMs } from './SleepEntry';
import { SleepStage } from './SleepStage';

export interface SleepSession {
  id: string;
  dateMs: number;
  entries: SleepEntry[];
}

export const totalSleepMs = (s: SleepSession): number =>
  s.entries
    .filter(e => e.stage !== SleepStage.Awake)
    .reduce((sum, e) => sum + entryDurationMs(e), 0);

const stagePct = (s: SleepSession, stage: SleepStage): number => {
  const total = totalSleepMs(s);
  if (total === 0) return 0;
  const ms = s.entries
    .filter(e => e.stage === stage)
    .reduce((sum, e) => sum + entryDurationMs(e), 0);
  return ms / total;
};

export const deepPct = (s: SleepSession) => stagePct(s, SleepStage.Deep);
export const remPct  = (s: SleepSession) => stagePct(s, SleepStage.REM);
export const corePct = (s: SleepSession) => stagePct(s, SleepStage.Core);
