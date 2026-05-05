import { SleepStage, sleepStageFromHK, isAcceptableForWakeup, stagePriority } from '../src/models/SleepStage';

describe('SleepStage priority', () => {
  it('awake has highest priority', () => {
    expect(stagePriority(SleepStage.Awake)).toBeGreaterThan(stagePriority(SleepStage.Core));
  });
  it('core > rem > deep', () => {
    expect(stagePriority(SleepStage.Core)).toBeGreaterThan(stagePriority(SleepStage.REM));
    expect(stagePriority(SleepStage.REM)).toBeGreaterThan(stagePriority(SleepStage.Deep));
  });
});

describe('isAcceptableForWakeup', () => {
  it('awake, core, rem are acceptable', () => {
    expect(isAcceptableForWakeup(SleepStage.Awake)).toBe(true);
    expect(isAcceptableForWakeup(SleepStage.Core)).toBe(true);
    expect(isAcceptableForWakeup(SleepStage.REM)).toBe(true);
  });
  it('deep is not acceptable', () => {
    expect(isAcceptableForWakeup(SleepStage.Deep)).toBe(false);
  });
});

describe('sleepStageFromHK', () => {
  it('maps all four HealthKit values', () => {
    expect(sleepStageFromHK('DEEP')).toBe(SleepStage.Deep);
    expect(sleepStageFromHK('REM')).toBe(SleepStage.REM);
    expect(sleepStageFromHK('CORE')).toBe(SleepStage.Core);
    expect(sleepStageFromHK('AWAKE')).toBe(SleepStage.Awake);
  });
  it('returns null for unknown value', () => {
    expect(sleepStageFromHK('INBED')).toBeNull();
  });
});
