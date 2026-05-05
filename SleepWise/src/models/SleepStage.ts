export enum SleepStage {
  Deep  = 'DEEP',
  REM   = 'REM',
  Core  = 'CORE',
  Awake = 'AWAKE',
}

const PRIORITY: Record<SleepStage, number> = {
  [SleepStage.Deep]:  0,
  [SleepStage.REM]:   1,
  [SleepStage.Core]:  2,
  [SleepStage.Awake]: 3,
};

export const stagePriority = (stage: SleepStage): number => PRIORITY[stage];

export const isAcceptableForWakeup = (stage: SleepStage): boolean =>
  PRIORITY[stage] >= PRIORITY[SleepStage.REM];

type HKSleepValue = string;

export const sleepStageFromHK = (value: HKSleepValue): SleepStage | null => {
  const map: Record<string, SleepStage> = {
    DEEP:  SleepStage.Deep,
    REM:   SleepStage.REM,
    CORE:  SleepStage.Core,
    AWAKE: SleepStage.Awake,
  };
  return map[value] ?? null;
};

export const stageDisplayName = (stage: SleepStage, lang: 'he' | 'en' = 'he'): string => {
  const names: Record<SleepStage, { he: string; en: string }> = {
    [SleepStage.Deep]:  { he: 'שינה עמוקה', en: 'Deep Sleep' },
    [SleepStage.REM]:   { he: 'שנת REM',    en: 'REM Sleep' },
    [SleepStage.Core]:  { he: 'שינה קלה',   en: 'Light Sleep' },
    [SleepStage.Awake]: { he: 'ערני',        en: 'Awake' },
  };
  return names[stage][lang];
};
