import { evaluate, AlarmDecision, snoozeDecision, SnoozeDecision } from '../src/engine/AlarmEngine';
import { AlarmConfig } from '../src/models/AlarmConfig';
import { SleepStage } from '../src/models/SleepStage';

const makeConfig = (targetHour: number, windowMinutes = 30): AlarmConfig => {
  const d = new Date(2026, 4, 5, targetHour, 0, 0);
  return { targetTimeMs: d.getTime(), windowMinutes, soundId: 'forest_morning', maxVolume: 1.0 };
};

const ms = (hour: number, min = 0) => new Date(2026, 4, 5, hour, min, 0).getTime();
const cfg = makeConfig(7);

describe('evaluate()', () => {
  it('before window → waitUntilWindow', () => {
    expect(evaluate(cfg, ms(5, 0), SleepStage.Core)).toBe(AlarmDecision.WaitUntilWindow);
  });
  it('in window + Core → fireNow', () => {
    expect(evaluate(cfg, ms(6, 45), SleepStage.Core)).toBe(AlarmDecision.FireNow);
  });
  it('in window + REM → fireNow', () => {
    expect(evaluate(cfg, ms(6, 45), SleepStage.REM)).toBe(AlarmDecision.FireNow);
  });
  it('in window + Awake → fireNow', () => {
    expect(evaluate(cfg, ms(6, 45), SleepStage.Awake)).toBe(AlarmDecision.FireNow);
  });
  it('in window + Deep → checkAgainLater', () => {
    expect(evaluate(cfg, ms(6, 45), SleepStage.Deep)).toBe(AlarmDecision.CheckAgainLater);
  });
  it('in window + null → checkAgainLater', () => {
    expect(evaluate(cfg, ms(6, 45), null)).toBe(AlarmDecision.CheckAgainLater);
  });
  it('past target + Deep → fireNow (force)', () => {
    expect(evaluate(cfg, ms(7, 5), SleepStage.Deep)).toBe(AlarmDecision.FireNow);
  });
  it('past target + null → fireNow (force)', () => {
    expect(evaluate(cfg, ms(7, 1), null)).toBe(AlarmDecision.FireNow);
  });
});

describe('snoozeDecision()', () => {
  it('0 snoozes → resume monitoring', () => {
    expect(snoozeDecision(0)).toBe(SnoozeDecision.ResumeMonitoring);
  });
  it('1 snooze → resume monitoring', () => {
    expect(snoozeDecision(1)).toBe(SnoozeDecision.ResumeMonitoring);
  });
  it('2 snoozes (max) → force wake', () => {
    expect(snoozeDecision(2)).toBe(SnoozeDecision.ForceWake);
  });
});
