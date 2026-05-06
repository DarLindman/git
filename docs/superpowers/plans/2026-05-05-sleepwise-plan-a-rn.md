# SleepWise — Plan A: Foundation (React Native + Expo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Expo project and build all testable business logic — models, alarm engine, sleep score, and service interfaces — fully tested with Jest before any UI is built.

**Architecture:** Expo (managed workflow) with expo-router for navigation. Business logic lives in pure TypeScript modules (no React Native deps) so Jest can run them on Windows without a simulator. Services are protocol-based (interface + real impl) so logic is testable with mocks.

**Tech Stack:** React Native, Expo SDK 51+, TypeScript, expo-router, react-native-health, expo-sensors, expo-av, expo-notifications, expo-background-fetch, expo-linear-gradient, react-native-reanimated, Jest

**Dev workflow:**
- Unit tests → `npx jest` on Windows (no device needed)
- UI testing → Expo Go on iPhone (scan QR)
- HealthKit testing → EAS Build dev client + AltStore on iPhone
- App Store → EAS Build production + $99 Apple Developer account

---

## File Map

```
SleepWise/
├── app/                          ← expo-router screens
│   ├── _layout.tsx               ← root layout + tab bar
│   ├── (tabs)/
│   │   ├── index.tsx             ← Tonight tab
│   │   ├── history.tsx           ← History tab
│   │   ├── statistics.tsx        ← Statistics tab
│   │   └── settings.tsx          ← Settings tab
├── src/
│   ├── models/
│   │   ├── SleepStage.ts         ← stage enum, priority, HK mapping
│   │   ├── SleepEntry.ts         ← single stage interval
│   │   ├── SleepSession.ts       ← one night + computed stats
│   │   └── AlarmConfig.ts        ← alarm settings + window logic
│   ├── engine/
│   │   ├── AlarmEngine.ts        ← window + stage logic + snooze
│   │   └── SleepScore.ts         ← score formula
│   ├── services/
│   │   ├── ISleepStageProvider.ts ← interface
│   │   ├── HealthKitService.ts   ← react-native-health impl
│   │   ├── MotionService.ts      ← expo-sensors impl
│   │   ├── SoundService.ts       ← expo-av impl
│   │   └── AlarmTaskService.ts   ← background fetch + notifications
│   ├── i18n/
│   │   ├── index.ts              ← i18n setup
│   │   ├── he.ts                 ← Hebrew strings
│   │   └── en.ts                 ← English strings
│   └── design/
│       └── tokens.ts             ← colors, fonts, Aurora palette
├── __tests__/
│   ├── SleepStage.test.ts
│   ├── AlarmEngine.test.ts
│   └── SleepScore.test.ts
├── app.json
├── babel.config.js
└── package.json
```

---

## Task 1: Create Expo Project

**Files:** All scaffolded by Expo CLI

- [ ] **Step 1.1: Create project**

  ```bash
  cd "C:\Users\Dar\Documents\Git"
  npx create-expo-app SleepWise --template tabs
  cd SleepWise
  ```

- [ ] **Step 1.2: Install dependencies**

  ```bash
  npx expo install expo-av expo-sensors expo-notifications expo-background-fetch expo-task-manager expo-localization expo-linear-gradient react-native-reanimated react-native-health @react-native-async-storage/async-storage
  npm install i18n-js
  npm install --save-dev jest jest-expo @types/jest
  ```

- [ ] **Step 1.3: Configure Jest in package.json**

  Add to `package.json`:
  ```json
  "jest": {
    "preset": "jest-expo",
    "testMatch": ["**/__tests__/**/*.test.ts"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
  ```

- [ ] **Step 1.4: Configure app.json for HealthKit**

  In `app.json`, inside `"expo"`:
  ```json
  "plugins": [
    [
      "react-native-health",
      {
        "isSleepAnalysisEnabled": true,
        "isHeartRateEnabled": true
      }
    ],
    [
      "expo-notifications",
      {
        "sounds": ["./assets/sounds/forest_morning.mp3",
                   "./assets/sounds/ocean_waves.mp3",
                   "./assets/sounds/tibetan_bowls.mp3",
                   "./assets/sounds/dawn_chimes.mp3"]
      }
    ]
  ],
  "ios": {
    "supportsTablet": false,
    "bundleIdentifier": "com.yourname.sleepwise",
    "infoPlist": {
      "NSHealthShareUsageDescription": "SleepWise reads your sleep data to wake you at the lightest sleep stage.",
      "NSHealthUpdateUsageDescription": "SleepWise does not write health data.",
      "NSMotionUsageDescription": "SleepWise uses motion to detect sleep stages when Apple Watch is unavailable.",
      "UIBackgroundModes": ["audio", "fetch", "processing"]
    }
  }
  ```

- [ ] **Step 1.5: Create directory structure**

  ```bash
  mkdir src\models src\engine src\services src\i18n src\design __tests__ assets\sounds
  ```

- [ ] **Step 1.6: Verify project runs**

  ```bash
  npx expo start
  ```
  Expected: QR code appears. Scan with Expo Go on iPhone — default tabs app loads.

- [ ] **Step 1.7: Commit**

  ```bash
  git add SleepWise/
  git commit -m "feat: scaffold SleepWise Expo project"
  ```

---

## Task 2: SleepStage Model

**Files:**
- Create: `SleepWise/src/models/SleepStage.ts`
- Create: `SleepWise/__tests__/SleepStage.test.ts`

- [ ] **Step 2.1: Write failing tests**

  Create `SleepWise/__tests__/SleepStage.test.ts`:

  ```typescript
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
  ```

- [ ] **Step 2.2: Run — expect failure**

  ```bash
  cd SleepWise && npx jest SleepStage
  ```
  Expected: `Cannot find module '../src/models/SleepStage'`

- [ ] **Step 2.3: Implement SleepStage.ts**

  Create `SleepWise/src/models/SleepStage.ts`:

  ```typescript
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

  // HealthKit value strings from react-native-health
  type HKSleepValue = 'DEEP' | 'REM' | 'CORE' | 'AWAKE' | 'INBED' | string;

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
  ```

- [ ] **Step 2.4: Run — expect all pass**

  ```bash
  npx jest SleepStage
  ```
  Expected: `Tests: 7 passed`

- [ ] **Step 2.5: Commit**

  ```bash
  git add src/models/SleepStage.ts __tests__/SleepStage.test.ts
  git commit -m "feat: add SleepStage model with priority and HK mapping"
  ```

---

## Task 3: SleepEntry, SleepSession, AlarmConfig

**Files:**
- Create: `SleepWise/src/models/SleepEntry.ts`
- Create: `SleepWise/src/models/SleepSession.ts`
- Create: `SleepWise/src/models/AlarmConfig.ts`

- [ ] **Step 3.1: Create SleepEntry.ts**

  ```typescript
  import { SleepStage } from './SleepStage';

  export interface SleepEntry {
    id: string;
    stage: SleepStage;
    startMs: number;   // Unix ms
    endMs: number;
  }

  export const entryDurationMs = (e: SleepEntry): number => e.endMs - e.startMs;
  ```

- [ ] **Step 3.2: Create SleepSession.ts**

  ```typescript
  import { SleepEntry, entryDurationMs } from './SleepEntry';
  import { SleepStage } from './SleepStage';

  export interface SleepSession {
    id: string;
    dateMs: number;
    entries: SleepEntry[];
  }

  export const totalSleepMs = (s: SleepSession): number =>
    s.entries
      .filter(e => e.stage !== SleepStage.Awake)
      .reduce((sum, e) => sum + entryDurationMs(e), 0);

  const stagePct = (s: SleepSession, stage: SleepStage): number => {
    const total = totalSleepMs(s);
    if (total === 0) return 0;
    const stageMs = s.entries
      .filter(e => e.stage === stage)
      .reduce((sum, e) => sum + entryDurationMs(e), 0);
    return stageMs / total;
  };

  export const deepPct  = (s: SleepSession) => stagePct(s, SleepStage.Deep);
  export const remPct   = (s: SleepSession) => stagePct(s, SleepStage.REM);
  export const corePct  = (s: SleepSession) => stagePct(s, SleepStage.Core);
  ```

- [ ] **Step 3.3: Create AlarmConfig.ts**

  ```typescript
  export interface AlarmConfig {
    targetTimeMs: number;   // Unix ms
    windowMinutes: number;  // default 30
    soundId: string;        // e.g. 'forest_morning'
    maxVolume: number;      // 0.0 – 1.0
  }

  export const defaultAlarmConfig = (): AlarmConfig => ({
    targetTimeMs: 0,
    windowMinutes: 30,
    soundId: 'forest_morning',
    maxVolume: 1.0,
  });

  export const windowStartMs = (c: AlarmConfig): number =>
    c.targetTimeMs - c.windowMinutes * 60 * 1000;

  export const isWithinWindow = (c: AlarmConfig, nowMs = Date.now()): boolean =>
    nowMs >= windowStartMs(c) && nowMs <= c.targetTimeMs;

  export const isPastTarget = (c: AlarmConfig, nowMs = Date.now()): boolean =>
    nowMs > c.targetTimeMs;
  ```

- [ ] **Step 3.4: Build check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: zero errors.

- [ ] **Step 3.5: Commit**

  ```bash
  git add src/models/
  git commit -m "feat: add SleepEntry, SleepSession, AlarmConfig models"
  ```

---

## Task 4: AlarmEngine

**Files:**
- Create: `SleepWise/src/engine/AlarmEngine.ts`
- Create: `SleepWise/__tests__/AlarmEngine.test.ts`

- [ ] **Step 4.1: Write failing tests**

  Create `SleepWise/__tests__/AlarmEngine.test.ts`:

  ```typescript
  import { evaluate, AlarmDecision, snoozeDecision, SnoozeDecision } from '../src/engine/AlarmEngine';
  import { AlarmConfig } from '../src/models/AlarmConfig';
  import { SleepStage } from '../src/models/SleepStage';

  const makeConfig = (targetHour: number, windowMinutes = 30): AlarmConfig => {
    const d = new Date(2026, 4, 5, targetHour, 0, 0); // May 5 2026
    return { targetTimeMs: d.getTime(), windowMinutes, soundId: 'forest_morning', maxVolume: 1.0 };
  };

  const ms = (hour: number, min = 0) =>
    new Date(2026, 4, 5, hour, min, 0).getTime();

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
    it('in window + null stage → checkAgainLater', () => {
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
  ```

- [ ] **Step 4.2: Run — expect failure**

  ```bash
  npx jest AlarmEngine
  ```
  Expected: `Cannot find module '../src/engine/AlarmEngine'`

- [ ] **Step 4.3: Implement AlarmEngine.ts**

  Create `SleepWise/src/engine/AlarmEngine.ts`:

  ```typescript
  import { AlarmConfig, isWithinWindow, isPastTarget } from '../models/AlarmConfig';
  import { SleepStage, isAcceptableForWakeup } from '../models/SleepStage';

  export enum AlarmDecision {
    WaitUntilWindow  = 'WAIT',
    CheckAgainLater  = 'CHECK_AGAIN',
    FireNow          = 'FIRE',
  }

  export enum SnoozeDecision {
    ResumeMonitoring = 'RESUME',
    ForceWake        = 'FORCE_WAKE',
  }

  const MAX_SNOOZES = 2;

  /** Pure function — easy to unit test and use in background tasks */
  export const evaluate = (
    config: AlarmConfig,
    nowMs: number,
    stage: SleepStage | null,
  ): AlarmDecision => {
    if (isPastTarget(config, nowMs)) return AlarmDecision.FireNow;
    if (!isWithinWindow(config, nowMs)) return AlarmDecision.WaitUntilWindow;
    if (stage !== null && isAcceptableForWakeup(stage)) return AlarmDecision.FireNow;
    return AlarmDecision.CheckAgainLater;
  };

  export const snoozeDecision = (snoozeCount: number): SnoozeDecision =>
    snoozeCount >= MAX_SNOOZES
      ? SnoozeDecision.ForceWake
      : SnoozeDecision.ResumeMonitoring;

  export const SNOOZE_DELAY_MS = 5 * 60 * 1000; // 5 minutes
  ```

- [ ] **Step 4.4: Run — expect all pass**

  ```bash
  npx jest AlarmEngine
  ```
  Expected: `Tests: 11 passed`

- [ ] **Step 4.5: Commit**

  ```bash
  git add src/engine/AlarmEngine.ts __tests__/AlarmEngine.test.ts
  git commit -m "feat: add AlarmEngine with window logic and smart snooze"
  ```

---

## Task 5: SleepScore

**Files:**
- Create: `SleepWise/src/engine/SleepScore.ts`
- Create: `SleepWise/__tests__/SleepScore.test.ts`

- [ ] **Step 5.1: Write failing tests**

  Create `SleepWise/__tests__/SleepScore.test.ts`:

  ```typescript
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
      // 8h, 20% deep, 25% REM, woke in Core
      const s = makeSession(1.6, 2.0, 4.4);
      expect(calculate(s, SleepStage.Core)).toBe(100);
    });

    it('4h sleep scores below 75', () => {
      const s = makeSession(0.8, 1.0, 2.2);
      expect(calculate(s, SleepStage.Core)).toBeLessThan(75);
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
      const s = makeSession(4, 4, 4); // unrealistically long
      expect(calculate(s, SleepStage.Awake)).toBeLessThanOrEqual(100);
    });
  });
  ```

- [ ] **Step 5.2: Run — expect failure**

  ```bash
  npx jest SleepScore
  ```

- [ ] **Step 5.3: Implement SleepScore.ts**

  Create `SleepWise/src/engine/SleepScore.ts`:

  ```typescript
  import { SleepSession, totalSleepMs, deepPct, remPct } from '../models/SleepSession';
  import { SleepStage } from '../models/SleepStage';

  export const calculate = (
    session: SleepSession,
    wokeInStage: SleepStage | null,
  ): number => {
    const totalMs = totalSleepMs(session);
    if (totalMs === 0) return 0;

    const hours     = totalMs / 3_600_000;
    const hourScore = Math.min(hours / 8, 1) * 40;
    const deepScore = Math.min(deepPct(session) / 0.20, 1) * 30;
    const remScore  = Math.min(remPct(session)  / 0.25, 1) * 20;
    const wakeBonus =
      wokeInStage === SleepStage.Core || wokeInStage === SleepStage.Awake ? 10 : 0;

    return Math.round(Math.min(Math.max(hourScore + deepScore + remScore + wakeBonus, 0), 100));
  };
  ```

- [ ] **Step 5.4: Run — expect all pass**

  ```bash
  npx jest SleepScore
  ```
  Expected: `Tests: 5 passed`

- [ ] **Step 5.5: Run full suite**

  ```bash
  npx jest
  ```
  Expected: `Test Suites: 3 passed, Tests: 23 passed`

- [ ] **Step 5.6: Commit**

  ```bash
  git add src/engine/SleepScore.ts __tests__/SleepScore.test.ts
  git commit -m "feat: add SleepScore calculator — all 23 tests passing"
  ```

---

## Task 6: Service Interfaces + SoundService

**Files:**
- Create: `SleepWise/src/services/ISleepStageProvider.ts`
- Create: `SleepWise/src/services/SoundService.ts`
- Create: `SleepWise/src/services/HealthKitService.ts`
- Create: `SleepWise/src/services/MotionService.ts`

- [ ] **Step 6.1: Create ISleepStageProvider.ts**

  ```typescript
  import { SleepStage } from '../models/SleepStage';

  export interface ISleepStageProvider {
    currentStage(): Promise<SleepStage | null>;
  }
  ```

- [ ] **Step 6.2: Create SoundService.ts**

  ```typescript
  import { Audio } from 'expo-av';

  export const SOUNDS = [
    { id: 'forest_morning', he: 'יער בוקר',   en: 'Forest Morning' },
    { id: 'ocean_waves',    he: 'גלי ים',     en: 'Ocean Waves' },
    { id: 'tibetan_bowls',  he: 'קערות טיבט', en: 'Tibetan Bowls' },
    { id: 'dawn_chimes',    he: 'פעמוני שחר', en: 'Dawn Chimes' },
  ] as const;

  export type SoundId = typeof SOUNDS[number]['id'];

  const SOUND_FILES: Record<SoundId, ReturnType<typeof require>> = {
    forest_morning: require('../../assets/sounds/forest_morning.mp3'),
    ocean_waves:    require('../../assets/sounds/ocean_waves.mp3'),
    tibetan_bowls:  require('../../assets/sounds/tibetan_bowls.mp3'),
    dawn_chimes:    require('../../assets/sounds/dawn_chimes.mp3'),
  };

  const RAMP_DURATION_MS = 90_000;

  /** Pure helper — volume at a given elapsed time */
  export const rampedVolume = (
    elapsedMs: number,
    maxVolume: number = 1.0,
  ): number => {
    const progress = Math.min(elapsedMs / RAMP_DURATION_MS, 1);
    return 0.1 + progress * (maxVolume - 0.1);
  };

  let _sound: Audio.Sound | null = null;
  let _rampInterval: ReturnType<typeof setInterval> | null = null;

  export const SoundService = {
    async play(soundId: SoundId, maxVolume = 1.0) {
      await SoundService.stop();
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(SOUND_FILES[soundId], {
        isLooping: true,
        volume: 0.1,
      });
      _sound = sound;
      await sound.playAsync();

      const start = Date.now();
      _rampInterval = setInterval(async () => {
        if (!_sound) { clearInterval(_rampInterval!); return; }
        const vol = rampedVolume(Date.now() - start, maxVolume);
        await _sound.setVolumeAsync(vol);
        if (vol >= maxVolume) clearInterval(_rampInterval!);
      }, 1000);
    },

    async stop() {
      if (_rampInterval) { clearInterval(_rampInterval); _rampInterval = null; }
      if (_sound) { await _sound.stopAsync(); await _sound.unloadAsync(); _sound = null; }
    },
  };
  ```

- [ ] **Step 6.3: Create HealthKitService.ts**

  ```typescript
  import AppleHealthKit, { HealthKitPermissions, HealthValue } from 'react-native-health';
  import { ISleepStageProvider } from './ISleepStageProvider';
  import { SleepStage, sleepStageFromHK } from '../models/SleepStage';
  import { SleepSession } from '../models/SleepSession';
  import { SleepEntry } from '../models/SleepEntry';

  const PERMISSIONS: HealthKitPermissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.SleepAnalysis,
             AppleHealthKit.Constants.Permissions.HeartRate],
      write: [],
    },
  };

  export const HealthKitService = {
    requestPermissions(): Promise<void> {
      return new Promise((resolve, reject) => {
        AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
          if (err) reject(new Error(err)); else resolve();
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
          const latest = results[0] as HealthValue & { value: string };
          resolve(sleepStageFromHK(latest.value));
        });
      });
    },

    async fetchSessions(fromMs: number, toMs: number): Promise<SleepSession[]> {
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
            return [{ id: r.startDate, stage, startMs: new Date(r.startDate).getTime(), endMs: new Date(r.endDate).getTime() }];
          });
          resolve(groupIntoSessions(entries));
        });
      });
    },

    async isWatchTrackingEnabled(): Promise<boolean> {
      const sessions = await HealthKitService.fetchSessions(
        Date.now() - 86_400_000, Date.now()
      );
      return sessions.length > 0;
    },
  } satisfies ISleepStageProvider & Record<string, unknown>;

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
  ```

- [ ] **Step 6.4: Create MotionService.ts**

  ```typescript
  import { Accelerometer } from 'expo-sensors';
  import { ISleepStageProvider } from './ISleepStageProvider';
  import { SleepStage } from '../models/SleepStage';

  const MAX_SAMPLES = 3000; // 50Hz × 60s
  const LIGHT_SLEEP_THRESHOLD = 0.005;

  const samples: number[] = [];

  const addSample = (magnitude: number) => {
    samples.push(magnitude);
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  };

  const movementVariance = (): number => {
    if (samples.length < 2) return 0;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
  };

  let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

  export const MotionService = {
    start() {
      Accelerometer.setUpdateInterval(20); // 50Hz
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        addSample(Math.sqrt(x * x + y * y + z * z));
      });
    },

    stop() {
      subscription?.remove();
      subscription = null;
      samples.length = 0;
    },

    currentStage(): Promise<SleepStage | null> {
      const isLight = movementVariance() > LIGHT_SLEEP_THRESHOLD;
      return Promise.resolve(isLight ? SleepStage.Core : SleepStage.Deep);
    },
  } satisfies ISleepStageProvider & Record<string, unknown>;
  ```

- [ ] **Step 6.5: Build check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: zero errors.

- [ ] **Step 6.6: Commit**

  ```bash
  git add src/services/
  git commit -m "feat: add service interfaces, SoundService, HealthKitService, MotionService"
  ```

---

## Task 7: Design Tokens + i18n

**Files:**
- Create: `SleepWise/src/design/tokens.ts`
- Create: `SleepWise/src/i18n/en.ts`
- Create: `SleepWise/src/i18n/he.ts`
- Create: `SleepWise/src/i18n/index.ts`

- [ ] **Step 7.1: Create tokens.ts**

  ```typescript
  export const Colors = {
    // Aurora backgrounds
    bg:         '#0d1520',
    bgDeep:     '#090d18',
    tealGlow:   'rgba(60,200,180,0.22)',
    purpleGlow: 'rgba(100,60,180,0.20)',
    blueGlow:   'rgba(40,100,160,0.15)',

    // Text
    textPrimary:   '#e8f8f5',
    textSecondary: 'rgba(100,220,200,0.55)',
    textMuted:     'rgba(100,220,200,0.3)',

    // Accent
    teal:      'rgba(60,200,180,0.7)',
    tealFaint: 'rgba(60,200,180,0.15)',

    // Graph
    graphStroke: 'rgba(60,200,180,0.45)',
    graphFill:   'rgba(60,200,180,0.08)',
  };

  export const FontFamily = {
    display: 'Gloock',          // loaded via expo-font
    serif:   'InstrumentSerif', // loaded via expo-font
    ui:      'InstrumentSans',  // loaded via expo-font
  };

  export const Spacing = {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  36,
    xxl: 48,
  };
  ```

- [ ] **Step 7.2: Create i18n strings**

  Create `SleepWise/src/i18n/en.ts`:
  ```typescript
  export default {
    tabs: {
      tonight:    'Tonight',
      history:    'History',
      statistics: 'Statistics',
      settings:   'Settings',
    },
    tonight: {
      trackingActive:  'Sleep tracking active',
      watchTracking:   'Your Watch is tracking tonight',
      startTracking:   'Start Tracking',
      alarmSet:        'Alarm set for',
      window:          'Smart window',
      summary:         'Good morning',
    },
    stages: {
      DEEP:  'Deep Sleep',
      REM:   'REM Sleep',
      CORE:  'Light Sleep',
      AWAKE: 'Awake',
    },
    score: 'Sleep Score',
    settings: {
      alarmWindow:  'Alarm window (minutes)',
      wakeSound:    'Wake sound',
      language:     'Language',
      appleWatch:   'Apple Watch',
    },
  } as const;
  ```

  Create `SleepWise/src/i18n/he.ts`:
  ```typescript
  export default {
    tabs: {
      tonight:    'הלילה',
      history:    'היסטוריה',
      statistics: 'סטטיסטיקות',
      settings:   'הגדרות',
    },
    tonight: {
      trackingActive:  'מעקב שינה פעיל',
      watchTracking:   'השעון עוקב הלילה',
      startTracking:   'התחל מעקב',
      alarmSet:        'אזעקה ב-',
      window:          'חלון חכם',
      summary:         'בוקר טוב',
    },
    stages: {
      DEEP:  'שינה עמוקה',
      REM:   'שנת REM',
      CORE:  'שינה קלה',
      AWAKE: 'ערני',
    },
    score: 'ציון שינה',
    settings: {
      alarmWindow:  'חלון השכמה (דקות)',
      wakeSound:    'צליל השכמה',
      language:     'שפה',
      appleWatch:   'Apple Watch',
    },
  } as const;
  ```

  Create `SleepWise/src/i18n/index.ts`:
  ```typescript
  import * as Localization from 'expo-localization';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import en from './en';
  import he from './he';

  type Strings = typeof en;
  type Lang = 'en' | 'he';

  const STORAGE_KEY = 'sw_lang';

  const deviceLang = (): Lang =>
    Localization.getLocales()[0]?.languageCode === 'he' ? 'he' : 'en';

  let _lang: Lang = deviceLang();
  const _strings: Record<Lang, Strings> = { en, he };

  export const i18n = {
    t: (): Strings => _strings[_lang],
    lang: (): Lang => _lang,
    async setLang(lang: Lang) {
      _lang = lang;
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    },
    async init() {
      const saved = await AsyncStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved) _lang = saved;
    },
  };
  ```

- [ ] **Step 7.3: Build check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 7.4: Commit**

  ```bash
  git add src/design/ src/i18n/
  git commit -m "feat: add design tokens and Hebrew/English i18n"
  ```

---

## Task 8: Full Test Suite Verification

- [ ] **Step 8.1: Run all tests**

  ```bash
  npx jest --verbose
  ```

  Expected output:
  ```
  PASS __tests__/SleepStage.test.ts    (7 tests)
  PASS __tests__/AlarmEngine.test.ts   (11 tests)
  PASS __tests__/SleepScore.test.ts    (5 tests)

  Test Suites: 3 passed
  Tests:       23 passed
  ```

- [ ] **Step 8.2: Final commit**

  ```bash
  git commit -m "test: Plan A complete — 23 tests passing, foundation ready"
  ```

---

## Plan A Complete When:
- [ ] `npx jest` → 23 tests, 0 failures
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx expo start` → QR code appears, app loads in Expo Go
- [ ] All source files committed to `SleepWise/`

*Plan B: UI screens (Tonight, History, Statistics, Settings) + Aurora animations begins after all above are checked.*
