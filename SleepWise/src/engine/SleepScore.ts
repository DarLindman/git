import { SleepSession, totalSleepMs, deepPct, remPct } from '../models/SleepSession';
import { SleepStage } from '../models/SleepStage';

export const calculate = (
  session: SleepSession,
  wokeInStage: SleepStage | null,
): number => {
  const ms = totalSleepMs(session);
  if (ms === 0) return 0;

  const hours     = ms / 3_600_000;
  const hourScore = Math.min(hours / 8, 1) * 40;
  const deepScore = Math.min(deepPct(session) / 0.20, 1) * 30;
  const remScore  = Math.min(remPct(session)  / 0.25, 1) * 20;
  const wakeBonus =
    wokeInStage === SleepStage.Core || wokeInStage === SleepStage.Awake ? 10 : 0;

  return Math.round(
    Math.min(Math.max(hourScore + deepScore + remScore + wakeBonus, 0), 100)
  );
};
