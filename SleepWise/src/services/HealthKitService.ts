import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';
import { ISleepStageProvider } from './ISleepStageProvider';
import { SleepStage, sleepStageFromHK } from '../models/SleepStage';
import { SleepSession } from '../models/SleepSession';
import { SleepEntry } from '../models/SleepEntry';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.HeartRate,
    ],
    write: [],
  },
};

function groupIntoSessions(entries: SleepEntry[]): SleepSession[] {
  if (!entries.length) return [];
  const sessions: SleepSession[] = [];
  let group = [entries[0]];
  for (const e of entries.slice(1)) {
    if (e.startMs - group[group.length - 1].endMs > 3_600_000) {
      sessions.push({ id: String(group[0].startMs), dateMs: group[0].startMs, entries: group });
      group = [e];
    } else {
      group.push(e);
    }
  }
  sessions.push({ id: String(group[0].startMs), dateMs: group[0].startMs, entries: group });
  return sessions;
}

export const HealthKitService: ISleepStageProvider & {
  requestPermissions(): Promise<void>;
  fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]>;
  isWatchTrackingEnabled(): Promise<boolean>;
} = {
  requestPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
        if (err) reject(new Error(String(err))); else resolve();
      });
    });
  },

  currentStage(): Promise<SleepStage | null> {
    return new Promise((resolve) => {
      const now = new Date();
      const options = {
        startDate: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
        limit: 1,
        ascending: false,
      };
      AppleHealthKit.getSleepSamples(options, (err, results) => {
        if (err || !results?.length) { resolve(null); return; }
        const latest = results[0] as unknown as { value: string };
        resolve(sleepStageFromHK(latest.value));
      });
    });
  },

  fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]> {
    return new Promise((resolve) => {
      const options = {
        startDate: new Date(fromMs).toISOString(),
        endDate: new Date(toMs).toISOString(),
        ascending: true,
      };
      AppleHealthKit.getSleepSamples(options, (err, results) => {
        if (err || !results) { resolve([]); return; }
        const entries: SleepEntry[] = (results as any[]).flatMap((r) => {
          const stage = sleepStageFromHK(r.value);
          if (!stage) return [];
          return [{
            id: r.startDate,
            stage,
            startMs: new Date(r.startDate).getTime(),
            endMs: new Date(r.endDate).getTime(),
          }];
        });
        resolve(groupIntoSessions(entries));
      });
    });
  },

  async isWatchTrackingEnabled(): Promise<boolean> {
    const sessions = await HealthKitService.fetchSessions(
      Date.now() - 86_400_000,
      Date.now(),
    );
    return sessions.length > 0;
  },
};
