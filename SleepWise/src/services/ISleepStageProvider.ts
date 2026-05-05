import { SleepStage } from '../models/SleepStage';

export interface ISleepStageProvider {
  currentStage(): Promise<SleepStage | null>;
}
