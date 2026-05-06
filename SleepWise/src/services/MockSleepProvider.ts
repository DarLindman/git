import { ISleepStageProvider } from './ISleepStageProvider';
import { SleepStage } from '../models/SleepStage';
import { SleepSession } from '../models/SleepSession';
import { SleepEntry } from '../models/SleepEntry';

// Realistic sleep cycle: each stage lasts 30s in demo (vs 2min real)
const DEMO_CYCLE: SleepStage[] = [
  SleepStage.Deep,
  SleepStage.Deep,
  SleepStage.Core,  // ← alarm can fire here
  SleepStage.REM,   // ← alarm can fire here
  SleepStage.Core,
  SleepStage.Deep,
  SleepStage.REM,
  SleepStage.Core,  // ← alarm can fire here
];

const DEMO_STAGE_DURATION_MS = 30_000; // 30 seconds per stage in demo

/** Generates a realistic fake sleep session for a given night */
function generateSession(dayStartMs: number): SleepSession {
  const bedtime  = dayStartMs + 22.5 * 3_600_000 + (Math.random() - 0.5) * 3_600_000;
  const totalMs  = (6.5 + Math.random() * 2) * 3_600_000; // 6.5–8.5 hours
  const cycleMs  = totalMs / 4.5; // ~4–5 cycles per night

  const entries: SleepEntry[] = [];
  let t = bedtime;

  while (t < bedtime + totalMs) {
    const add = (stage: SleepStage, pct: number) => {
      const dur = cycleMs * pct;
      entries.push({ id: `${stage}-${t}`, stage, startMs: t, endMs: t + dur });
      t += dur;
    };
    add(SleepStage.Deep,  0.20);
    add(SleepStage.Core,  0.30);
    add(SleepStage.REM,   0.25);
    add(SleepStage.Core,  0.15);
    add(SleepStage.Awake, 0.10);
  }

  return { id: String(dayStartMs), dateMs: bedtime, entries };
}

export const MockSleepProvider: ISleepStageProvider & {
  requestPermissions(): Promise<void>;
  fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]>;
  isWatchTrackingEnabled(): Promise<boolean>;
} = {
  requestPermissions: () => Promise.resolve(),

  isWatchTrackingEnabled: () => Promise.resolve(false),

  currentStage(): Promise<SleepStage | null> {
    const idx = Math.floor(Date.now() / DEMO_STAGE_DURATION_MS) % DEMO_CYCLE.length;
    return Promise.resolve(DEMO_CYCLE[idx]);
  },

  fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]> {
    const sessions: SleepSession[] = [];
    const d = new Date(fromMs);
    d.setHours(0, 0, 0, 0);

    while (d.getTime() < toMs) {
      sessions.push(generateSession(d.getTime()));
      d.setDate(d.getDate() + 1);
    }
    return Promise.resolve(sessions);
  },
};

/** How often to poll in mock mode — shorter for faster testing */
export const MOCK_POLL_INTERVAL_MS = DEMO_STAGE_DURATION_MS;
