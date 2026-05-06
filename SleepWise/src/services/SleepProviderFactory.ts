import { HealthKitService } from './HealthKitService';
import { MockSleepProvider, MOCK_POLL_INTERVAL_MS } from './MockSleepProvider';
import { ISleepStageProvider } from './ISleepStageProvider';
import { SleepSession } from '../models/SleepSession';

export type SleepProvider = ISleepStageProvider & {
  requestPermissions(): Promise<void>;
  fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]>;
  isWatchTrackingEnabled(): Promise<boolean>;
};

let _provider: SleepProvider | null = null;
let _isMock = false;

/**
 * Returns the best available sleep provider.
 * Tries HealthKit first; falls back to MockSleepProvider
 * when react-native-health native module isn't compiled in (e.g. Expo Go).
 */
export async function getSleepProvider(): Promise<SleepProvider> {
  if (_provider) return _provider;

  try {
    await HealthKitService.requestPermissions();
    _provider = HealthKitService;
    _isMock = false;
  } catch {
    // HealthKit unavailable (Expo Go, simulator, or permissions denied)
    _provider = MockSleepProvider;
    _isMock = true;
  }

  return _provider;
}

export const isMockMode = () => _isMock;

/** Poll interval: shorter in mock mode for faster demo feedback */
export const pollIntervalMs = () =>
  _isMock ? MOCK_POLL_INTERVAL_MS : 2 * 60 * 1000;
