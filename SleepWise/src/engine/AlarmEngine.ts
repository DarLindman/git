import { AlarmConfig, isWithinWindow, isPastTarget } from '../models/AlarmConfig';
import { SleepStage, isAcceptableForWakeup } from '../models/SleepStage';

export enum AlarmDecision {
  WaitUntilWindow = 'WAIT',
  CheckAgainLater = 'CHECK_AGAIN',
  FireNow         = 'FIRE',
}

export enum SnoozeDecision {
  ResumeMonitoring = 'RESUME',
  ForceWake        = 'FORCE_WAKE',
}

const MAX_SNOOZES = 2;
export const SNOOZE_DELAY_MS = 5 * 60 * 1000;

export const evaluate = (
  config: AlarmConfig,
  nowMs: number,
  stage: SleepStage | null,
): AlarmDecision => {
  if (isPastTarget(config, nowMs))    return AlarmDecision.FireNow;
  if (!isWithinWindow(config, nowMs)) return AlarmDecision.WaitUntilWindow;
  if (stage !== null && isAcceptableForWakeup(stage)) return AlarmDecision.FireNow;
  return AlarmDecision.CheckAgainLater;
};

export const snoozeDecision = (snoozeCount: number): SnoozeDecision =>
  snoozeCount >= MAX_SNOOZES
    ? SnoozeDecision.ForceWake
    : SnoozeDecision.ResumeMonitoring;
