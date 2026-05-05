import { calculate } from '../src/engine/SleepScore';
import { SleepSession } from '../src/models/SleepSession';
import { SleepStage } from '../src/models/SleepStage';

const makeSession = (deepH: number, remH: number, coreH: number): SleepSession => {
  let t = 0;
  const entry = (stage: SleepStage, hours: number) => {
    const e = { id: stage, stage, startMs: t, endMs: t + hours * 3_600_000 };
    t = e.endMs;
    return e;
  };
  return { id: 'test', dateMs: 0, entries: [
    entry(SleepStage.Deep, deepH),
    entry(SleepStage.REM,  remH),
    entry(SleepStage.Core, coreH),
  ]};
};

describe('calculate()', () => {
  it('perfect sleep scores 100', () => {
    const s = makeSession(1.6, 2.0, 4.4);
    expect(calculate(s, SleepStage.Core)).toBe(100);
  });

  it('4h sleep scores lower than 8h with identical stage ratios', () => {
    const s4h = makeSession(0.8, 1.0, 2.2);
    const s8h = makeSession(1.6, 2.0, 4.4);
    expect(calculate(s4h, SleepStage.Core)).toBeLessThan(calculate(s8h, SleepStage.Core));
  });

  it('waking in Deep costs 10 points vs Core', () => {
    const s = makeSession(1.6, 2.0, 4.4);
    expect(calculate(s, SleepStage.Core) - calculate(s, SleepStage.Deep)).toBe(10);
  });

  it('empty session scores 0', () => {
    const s: SleepSession = { id: 'e', dateMs: 0, entries: [] };
    expect(calculate(s, null)).toBe(0);
  });

  it('score never exceeds 100', () => {
    const s = makeSession(4, 4, 4);
    expect(calculate(s, SleepStage.Awake)).toBeLessThanOrEqual(100);
  });
});
