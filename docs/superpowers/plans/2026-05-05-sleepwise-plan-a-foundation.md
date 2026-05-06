# SleepWise — Plan A: Foundation & Logic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete business logic layer for SleepWise — data models, HealthKit integration, CoreMotion fallback, alarm engine, and sound service — fully tested before any UI is built.

**Architecture:** Pure Swift services and models, each with a single responsibility, communicating through protocols so they're independently testable. No SwiftUI in this plan. The alarm engine uses a protocol-based `SleepStageProvider` so it can be tested without HealthKit.

**Tech Stack:** Swift 5.9, HealthKit, CoreMotion, AVFoundation, XCTest, iOS 17+ target

**Prerequisites:** macOS with Xcode 15+ installed. This plan creates Swift source files in the Git repo; run all `xcodebuild` commands on Mac.

---

## File Map

```
SleepWise/                                  ← new folder in Git repo root
├── SleepWise/                              ← Xcode app target sources
│   ├── SleepWiseApp.swift
│   ├── Models/
│   │   ├── SleepStage.swift               ← stage enum, priority, HK mapping
│   │   ├── SleepEntry.swift               ← single stage interval
│   │   ├── SleepSession.swift             ← one night's data + computed stats
│   │   └── AlarmConfig.swift              ← user alarm settings + window logic
│   ├── Services/
│   │   ├── HealthKitService.swift         ← HK permissions + queries
│   │   ├── MotionService.swift            ← CoreMotion variance detector
│   │   ├── AlarmEngine.swift              ← window/stage logic + smart snooze
│   │   └── SoundService.swift             ← AVFoundation volume ramp
│   └── Utilities/
│       └── SleepScore.swift               ← score formula
└── SleepWiseTests/
    ├── SleepStageTests.swift
    ├── AlarmEngineTests.swift
    ├── SleepScoreTests.swift
    ├── MotionServiceTests.swift
    └── SoundServiceTests.swift
```

---

## Task 1: Xcode Project Setup

**Files:**
- Create: `SleepWise/SleepWise.xcodeproj` (via Xcode GUI)
- Create: `SleepWise/SleepWise/SleepWiseApp.swift`

**⚠️ Requires Mac + Xcode 15.**

- [ ] **Step 1.1: Create Xcode project**

  Open Xcode → File → New → Project → iOS → App:
  - Product Name: `SleepWise`
  - Bundle ID: `com.yourdomain.SleepWise`
  - Interface: SwiftUI
  - Language: Swift
  - Save location: `<repo-root>/SleepWise/`

- [ ] **Step 1.2: Add HealthKit capability**

  Xcode → Target: SleepWise → Signing & Capabilities → + Capability → HealthKit

- [ ] **Step 1.3: Add Background Modes capability**

  Same panel → + Capability → Background Modes → check:
  - ✅ Audio, AirPlay, and Picture in Picture
  - ✅ Background fetch

- [ ] **Step 1.4: Add Privacy descriptions to Info.plist**

  Target → Info → add these keys:
  ```
  NSHealthShareUsageDescription  = "SleepWise reads your sleep data to detect your sleep stage and wake you at the right moment."
  NSHealthUpdateUsageDescription = "SleepWise does not write health data."
  NSMotionUsageDescription       = "SleepWise uses motion data to detect sleep stages when Apple Watch is not available."
  ```

- [ ] **Step 1.5: Create folder structure**

  In Finder inside `SleepWise/SleepWise/`, create folders:
  `Models/`, `Services/`, `Utilities/`

  In Xcode project navigator, drag these folders in (check "Create groups").

- [ ] **Step 1.6: Replace SleepWiseApp.swift**

  ```swift
  import SwiftUI

  @main
  struct SleepWiseApp: App {
      var body: some Scene {
          WindowGroup {
              Text("SleepWise — Logic phase")
          }
      }
  }
  ```

- [ ] **Step 1.7: Build to verify setup**

  `Cmd+B` in Xcode — should build with zero errors.

- [ ] **Step 1.8: Commit**

  ```bash
  git add SleepWise/
  git commit -m "feat: scaffold SleepWise Xcode project"
  ```

---

## Task 2: SleepStage Model

**Files:**
- Create: `SleepWise/SleepWise/Models/SleepStage.swift`
- Create: `SleepWise/SleepWiseTests/SleepStageTests.swift`

- [ ] **Step 2.1: Write the failing tests**

  Create `SleepWise/SleepWiseTests/SleepStageTests.swift`:

  ```swift
  import XCTest
  import HealthKit
  @testable import SleepWise

  final class SleepStageTests: XCTestCase {

      func test_stagePriority_awakeHighestDeepLowest() {
          XCTAssertGreaterThan(SleepStage.awake, SleepStage.core)
          XCTAssertGreaterThan(SleepStage.core, SleepStage.rem)
          XCTAssertGreaterThan(SleepStage.rem, SleepStage.deep)
      }

      func test_acceptableForWakeup_remAndAbove() {
          XCTAssertTrue(SleepStage.awake.isAcceptableForWakeup)
          XCTAssertTrue(SleepStage.core.isAcceptableForWakeup)
          XCTAssertTrue(SleepStage.rem.isAcceptableForWakeup)
          XCTAssertFalse(SleepStage.deep.isAcceptableForWakeup)
      }

      func test_healthKitMapping_allFourStages() {
          XCTAssertEqual(SleepStage.from(.asleepDeep), .deep)
          XCTAssertEqual(SleepStage.from(.asleepREM), .rem)
          XCTAssertEqual(SleepStage.from(.asleepCore), .core)
          XCTAssertEqual(SleepStage.from(.awake), .awake)
      }

      func test_healthKitMapping_inSleep_returnsNil() {
          XCTAssertNil(SleepStage.from(.inBed))
      }

      func test_displayName_hebrew() {
          XCTAssertEqual(SleepStage.deep.hebrewName, "שינה עמוקה")
          XCTAssertEqual(SleepStage.rem.hebrewName, "שנת REM")
          XCTAssertEqual(SleepStage.core.hebrewName, "שינה קלה")
          XCTAssertEqual(SleepStage.awake.hebrewName, "ערני")
      }
  }
  ```

- [ ] **Step 2.2: Run tests — expect compile failure**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SleepStageTests \
    2>&1 | grep -E "error:|PASSED|FAILED"
  ```
  Expected: compile error — `SleepStage` not defined.

- [ ] **Step 2.3: Implement SleepStage.swift**

  Create `SleepWise/SleepWise/Models/SleepStage.swift`:

  ```swift
  import HealthKit

  enum SleepStage: Int, Comparable {
      case deep  = 0
      case rem   = 1
      case core  = 2
      case awake = 3

      // Higher raw value = higher wakeup priority
      static func < (lhs: SleepStage, rhs: SleepStage) -> Bool {
          lhs.rawValue < rhs.rawValue
      }

      var isAcceptableForWakeup: Bool { self >= .rem }

      static func from(_ value: HKCategoryValueSleepAnalysis) -> SleepStage? {
          switch value {
          case .asleepDeep: return .deep
          case .asleepREM:  return .rem
          case .asleepCore: return .core
          case .awake:      return .awake
          default:          return nil
          }
      }

      var hebrewName: String {
          switch self {
          case .deep:  return "שינה עמוקה"
          case .rem:   return "שנת REM"
          case .core:  return "שינה קלה"
          case .awake: return "ערני"
          }
      }

      var englishName: String {
          switch self {
          case .deep:  return "Deep Sleep"
          case .rem:   return "REM Sleep"
          case .core:  return "Light Sleep"
          case .awake: return "Awake"
          }
      }
  }
  ```

- [ ] **Step 2.4: Run tests — expect all pass**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SleepStageTests \
    2>&1 | grep -E "Test Case|PASSED|FAILED"
  ```
  Expected: 4 test cases PASSED.

- [ ] **Step 2.5: Commit**

  ```bash
  git add SleepWise/SleepWise/Models/SleepStage.swift \
          SleepWise/SleepWiseTests/SleepStageTests.swift
  git commit -m "feat: add SleepStage model with HK mapping and priority"
  ```

---

## Task 3: SleepEntry, SleepSession, AlarmConfig

**Files:**
- Create: `SleepWise/SleepWise/Models/SleepEntry.swift`
- Create: `SleepWise/SleepWise/Models/SleepSession.swift`
- Create: `SleepWise/SleepWise/Models/AlarmConfig.swift`

No separate test file for these — they are tested indirectly by SleepScoreTests (Task 5).

- [ ] **Step 3.1: Create SleepEntry.swift**

  ```swift
  import Foundation

  struct SleepEntry: Identifiable, Equatable {
      let id: UUID
      let stage: SleepStage
      let start: Date
      let end: Date

      init(id: UUID = UUID(), stage: SleepStage, start: Date, end: Date) {
          self.id = id
          self.stage = stage
          self.start = start
          self.end = end
      }

      var duration: TimeInterval { end.timeIntervalSince(start) }
  }
  ```

- [ ] **Step 3.2: Create SleepSession.swift**

  ```swift
  import Foundation

  struct SleepSession: Identifiable {
      let id: UUID
      let date: Date
      let entries: [SleepEntry]

      init(id: UUID = UUID(), date: Date, entries: [SleepEntry]) {
          self.id = id
          self.date = date
          self.entries = entries
      }

      // Total sleep = all non-awake entries
      var totalSleepDuration: TimeInterval {
          entries.filter { $0.stage != .awake }
                 .reduce(0) { $0 + $1.duration }
      }

      private func pct(for stage: SleepStage) -> Double {
          guard totalSleepDuration > 0 else { return 0 }
          let t = entries.filter { $0.stage == stage }.reduce(0) { $0 + $1.duration }
          return t / totalSleepDuration
      }

      var deepPct: Double  { pct(for: .deep) }
      var remPct: Double   { pct(for: .rem) }
      var corePct: Double  { pct(for: .core) }
  }
  ```

- [ ] **Step 3.3: Create AlarmConfig.swift**

  ```swift
  import Foundation

  struct AlarmConfig: Codable, Equatable {
      var targetTime: Date
      var windowMinutes: Int
      var soundName: String
      var maxVolume: Float

      init(
          targetTime: Date,
          windowMinutes: Int = 30,
          soundName: String = "forest_morning",
          maxVolume: Float = 1.0
      ) {
          self.targetTime = targetTime
          self.windowMinutes = windowMinutes
          self.soundName = soundName
          self.maxVolume = maxVolume
      }

      var windowStart: Date {
          targetTime.addingTimeInterval(-Double(windowMinutes) * 60)
      }

      func isWithinWindow(at time: Date = Date()) -> Bool {
          time >= windowStart && time <= targetTime
      }

      func isPastTarget(at time: Date = Date()) -> Bool {
          time > targetTime
      }
  }
  ```

- [ ] **Step 3.4: Build to verify no compile errors**

  `Cmd+B` in Xcode — zero errors expected.

- [ ] **Step 3.5: Commit**

  ```bash
  git add SleepWise/SleepWise/Models/
  git commit -m "feat: add SleepEntry, SleepSession, AlarmConfig models"
  ```

---

## Task 4: AlarmEngine

**Files:**
- Create: `SleepWise/SleepWise/Services/AlarmEngine.swift`
- Create: `SleepWise/SleepWiseTests/AlarmEngineTests.swift`

- [ ] **Step 4.1: Write failing tests**

  Create `SleepWise/SleepWiseTests/AlarmEngineTests.swift`:

  ```swift
  import XCTest
  @testable import SleepWise

  final class AlarmEngineTests: XCTestCase {
      var config: AlarmConfig!

      override func setUp() {
          config = AlarmConfig(
              targetTime: makeTime(hour: 7, minute: 0),
              windowMinutes: 30
          )
      }

      // MARK: - evaluate()

      func test_beforeWindow_returnsWaitUntilWindow() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 5, minute: 0),
              currentStage: .core
          )
          XCTAssertEqual(result, .waitUntilWindow)
      }

      func test_inWindow_coreStage_fireNow() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 6, minute: 45),
              currentStage: .core
          )
          XCTAssertEqual(result, .fireNow(stage: .core))
      }

      func test_inWindow_remStage_fireNow() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 6, minute: 45),
              currentStage: .rem
          )
          XCTAssertEqual(result, .fireNow(stage: .rem))
      }

      func test_inWindow_awakeStage_fireNow() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 6, minute: 45),
              currentStage: .awake
          )
          XCTAssertEqual(result, .fireNow(stage: .awake))
      }

      func test_inWindow_deepStage_checkAgainLater() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 6, minute: 45),
              currentStage: .deep
          )
          XCTAssertEqual(result, .checkAgainLater)
      }

      func test_inWindow_noStage_checkAgainLater() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 6, minute: 45),
              currentStage: nil
          )
          XCTAssertEqual(result, .checkAgainLater)
      }

      func test_pastTargetTime_deepStage_forcesFire() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 7, minute: 5),
              currentStage: .deep
          )
          XCTAssertEqual(result, .fireNow(stage: .deep))
      }

      func test_pastTargetTime_noStage_forcesFire() {
          let result = AlarmEngine.evaluate(
              config: config,
              currentTime: makeTime(hour: 7, minute: 1),
              currentStage: nil
          )
          XCTAssertEqual(result, .fireNow(stage: nil))
      }

      // MARK: - snooze

      func test_snoozeIncrements_belowMax() {
          let engine = AlarmEngine(config: config)
          XCTAssertEqual(engine.snoozeCount, 0)
          engine.recordSnooze()
          XCTAssertEqual(engine.snoozeCount, 1)
      }

      func test_snoozeAtMax_returnsForceWake() {
          let engine = AlarmEngine(config: config)
          engine.recordSnooze()
          engine.recordSnooze()
          let decision = engine.snoozeDecision()
          XCTAssertEqual(decision, .forceWake)
      }

      func test_snoozeUnderMax_returnsResumeMonitoring() {
          let engine = AlarmEngine(config: config)
          engine.recordSnooze()
          let decision = engine.snoozeDecision()
          XCTAssertEqual(decision, .resumeMonitoring(delaySeconds: 300))
      }

      // MARK: - Helpers

      private func makeTime(hour: Int, minute: Int) -> Date {
          var c = DateComponents()
          c.year = 2026; c.month = 5; c.day = 5
          c.hour = hour; c.minute = minute; c.second = 0
          return Calendar.current.date(from: c)!
      }
  }
  ```

- [ ] **Step 4.2: Run tests — expect compile failure**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/AlarmEngineTests \
    2>&1 | grep -E "error:|PASSED|FAILED"
  ```
  Expected: compile error.

- [ ] **Step 4.3: Implement AlarmEngine.swift**

  Create `SleepWise/SleepWise/Services/AlarmEngine.swift`:

  ```swift
  import Foundation

  // MARK: - Types

  enum AlarmDecision: Equatable {
      case waitUntilWindow
      case checkAgainLater
      case fireNow(stage: SleepStage?)
  }

  enum SnoozeDecision: Equatable {
      case resumeMonitoring(delaySeconds: Int)
      case forceWake
  }

  protocol SleepStageProvider {
      func currentStage() async throws -> SleepStage?
  }

  // MARK: - AlarmEngine

  final class AlarmEngine {
      let config: AlarmConfig
      private(set) var snoozeCount: Int = 0
      private let maxSnoozes = 2
      private let snoozeDelaySeconds = 300 // 5 minutes

      init(config: AlarmConfig) {
          self.config = config
      }

      // Pure function — easy to test
      static func evaluate(
          config: AlarmConfig,
          currentTime: Date,
          currentStage: SleepStage?
      ) -> AlarmDecision {
          if config.isPastTarget(at: currentTime) {
              return .fireNow(stage: currentStage)
          }
          if !config.isWithinWindow(at: currentTime) {
              return .waitUntilWindow
          }
          if let stage = currentStage, stage.isAcceptableForWakeup {
              return .fireNow(stage: stage)
          }
          return .checkAgainLater
      }

      func recordSnooze() {
          snoozeCount += 1
      }

      func snoozeDecision() -> SnoozeDecision {
          if snoozeCount >= maxSnoozes {
              return .forceWake
          }
          return .resumeMonitoring(delaySeconds: snoozeDelaySeconds)
      }

      // MARK: - Async monitoring loop (used at runtime, not in tests)

      private var monitorTask: Task<Void, Never>?
      var onFire: ((SleepStage?) -> Void)?

      func startMonitoring(provider: SleepStageProvider) {
          monitorTask?.cancel()
          monitorTask = Task { [weak self] in
              await self?.monitorLoop(provider: provider)
          }
      }

      func stopMonitoring() {
          monitorTask?.cancel()
          monitorTask = nil
      }

      private func monitorLoop(provider: SleepStageProvider) async {
          let intervalNs: UInt64 = 2 * 60 * 1_000_000_000
          while !Task.isCancelled {
              let stage = try? await provider.currentStage()
              let decision = AlarmEngine.evaluate(
                  config: config,
                  currentTime: Date(),
                  currentStage: stage
              )
              switch decision {
              case .fireNow(let s):
                  await MainActor.run { onFire?(s) }
                  return
              case .waitUntilWindow, .checkAgainLater:
                  try? await Task.sleep(nanoseconds: intervalNs)
              }
          }
      }
  }
  ```

- [ ] **Step 4.4: Run tests — expect all pass**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/AlarmEngineTests \
    2>&1 | grep -E "Test Case|PASSED|FAILED"
  ```
  Expected: 11 test cases PASSED.

- [ ] **Step 4.5: Commit**

  ```bash
  git add SleepWise/SleepWise/Services/AlarmEngine.swift \
          SleepWise/SleepWiseTests/AlarmEngineTests.swift
  git commit -m "feat: add AlarmEngine with window logic and smart snooze"
  ```

---

## Task 5: SleepScore

**Files:**
- Create: `SleepWise/SleepWise/Utilities/SleepScore.swift`
- Create: `SleepWise/SleepWiseTests/SleepScoreTests.swift`

- [ ] **Step 5.1: Write failing tests**

  Create `SleepWise/SleepWiseTests/SleepScoreTests.swift`:

  ```swift
  import XCTest
  @testable import SleepWise

  final class SleepScoreTests: XCTestCase {

      func test_perfectSleep_scores100() {
          // 8h: 20% deep, 25% REM, 55% core, woke in Core
          let session = makeSession(
              deepHours: 1.6, remHours: 2.0, coreHours: 4.4
          )
          let score = SleepScore.calculate(session: session, wokeInStage: .core)
          XCTAssertEqual(score, 100)
      }

      func test_shortSleep_scoreLower() {
          // 4h instead of 8 — hour component halved
          let session = makeSession(deepHours: 0.8, remHours: 1.0, coreHours: 2.2)
          let score = SleepScore.calculate(session: session, wokeInStage: .core)
          XCTAssertLessThan(score, 75)
      }

      func test_wokeInDeep_minus10Points() {
          let session = makeSession(deepHours: 1.6, remHours: 2.0, coreHours: 4.4)
          let coreScore = SleepScore.calculate(session: session, wokeInStage: .core)
          let deepScore = SleepScore.calculate(session: session, wokeInStage: .deep)
          XCTAssertEqual(coreScore - deepScore, 10)
      }

      func test_emptySession_scoresZero() {
          let session = SleepSession(date: Date(), entries: [])
          let score = SleepScore.calculate(session: session, wokeInStage: nil)
          XCTAssertEqual(score, 0)
      }

      func test_scoreClamped0to100() {
          // Impossible perfect session shouldn't exceed 100
          let session = makeSession(deepHours: 3.0, remHours: 3.0, coreHours: 3.0)
          let score = SleepScore.calculate(session: session, wokeInStage: .awake)
          XCTAssertLessThanOrEqual(score, 100)
          XCTAssertGreaterThanOrEqual(score, 0)
      }

      // MARK: - Helper

      private func makeSession(deepHours: Double, remHours: Double, coreHours: Double) -> SleepSession {
          let base = Date()
          var t = base
          var entries: [SleepEntry] = []

          func add(_ stage: SleepStage, hours: Double) {
              let end = t.addingTimeInterval(hours * 3600)
              entries.append(SleepEntry(stage: stage, start: t, end: end))
              t = end
          }

          add(.deep, hours: deepHours)
          add(.rem,  hours: remHours)
          add(.core, hours: coreHours)
          return SleepSession(date: base, entries: entries)
      }
  }
  ```

- [ ] **Step 5.2: Run tests — expect compile failure**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SleepScoreTests \
    2>&1 | grep -E "error:|PASSED|FAILED"
  ```

- [ ] **Step 5.3: Implement SleepScore.swift**

  Create `SleepWise/SleepWise/Utilities/SleepScore.swift`:

  ```swift
  import Foundation

  enum SleepScore {
      /// Returns 0–100.
      static func calculate(session: SleepSession, wokeInStage: SleepStage?) -> Int {
          guard session.totalSleepDuration > 0 else { return 0 }

          let hours = session.totalSleepDuration / 3600.0
          let hourScore  = min(hours / 8.0, 1.0) * 40.0
          let deepScore  = min(session.deepPct / 0.20, 1.0) * 30.0
          let remScore   = min(session.remPct  / 0.25, 1.0) * 20.0
          let wakeBonus: Double = {
              switch wokeInStage {
              case .awake, .core: return 10.0
              default: return 0.0
              }
          }()

          let raw = hourScore + deepScore + remScore + wakeBonus
          return Int(min(max(raw, 0), 100).rounded())
      }
  }
  ```

- [ ] **Step 5.4: Run tests — expect all pass**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SleepScoreTests \
    2>&1 | grep -E "Test Case|PASSED|FAILED"
  ```
  Expected: 5 test cases PASSED.

- [ ] **Step 5.5: Commit**

  ```bash
  git add SleepWise/SleepWise/Utilities/SleepScore.swift \
          SleepWise/SleepWiseTests/SleepScoreTests.swift
  git commit -m "feat: add SleepScore calculator"
  ```

---

## Task 6: MotionService

**Files:**
- Create: `SleepWise/SleepWise/Services/MotionService.swift`
- Create: `SleepWise/SleepWiseTests/MotionServiceTests.swift`

- [ ] **Step 6.1: Write failing tests**

  Create `SleepWise/SleepWiseTests/MotionServiceTests.swift`:

  ```swift
  import XCTest
  @testable import SleepWise

  final class MotionServiceTests: XCTestCase {
      var service: MotionService!

      override func setUp() {
          service = MotionService()
      }

      func test_noSamples_varianceZero() {
          XCTAssertEqual(service.movementVariance, 0.0, accuracy: 0.0001)
      }

      func test_constantSamples_varianceZero() {
          for _ in 0..<200 { service.addSample(1.0) }
          XCTAssertEqual(service.movementVariance, 0.0, accuracy: 0.0001)
      }

      func test_stillPerson_belowThreshold() {
          // Gravity ~1g with tiny noise — still body
          for _ in 0..<200 {
              service.addSample(1.0 + Double.random(in: -0.002...0.002))
          }
          XCTAssertFalse(service.isLightSleep)
      }

      func test_movingPerson_aboveThreshold() {
          // Simulate turning over — large variance
          for i in 0..<200 {
              service.addSample(1.0 + sin(Double(i) * 0.3) * 0.3)
          }
          XCTAssertTrue(service.isLightSleep)
      }

      func test_sampleBuffer_capsAt3000() {
          // 50Hz × 60s = 3000 samples max
          for i in 0..<4000 { service.addSample(Double(i)) }
          XCTAssertEqual(service.sampleCount, 3000)
      }
  }
  ```

- [ ] **Step 6.2: Run — expect compile failure**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/MotionServiceTests \
    2>&1 | grep -E "error:|PASSED|FAILED"
  ```

- [ ] **Step 6.3: Implement MotionService.swift**

  Create `SleepWise/SleepWise/Services/MotionService.swift`:

  ```swift
  import CoreMotion
  import Foundation

  final class MotionService {
      private let manager = CMMotionManager()
      private var samples: [Double] = []
      private let maxSamples = 3000  // 50Hz × 60 seconds
      let lightSleepThreshold: Double = 0.005

      // MARK: - Public API

      var isAvailable: Bool { manager.isAccelerometerAvailable }

      var sampleCount: Int { samples.count }

      var movementVariance: Double {
          guard samples.count > 1 else { return 0 }
          let mean = samples.reduce(0, +) / Double(samples.count)
          let variance = samples.reduce(0.0) { acc, x in
              acc + (x - mean) * (x - mean)
          } / Double(samples.count)
          return variance
      }

      var isLightSleep: Bool { movementVariance > lightSleepThreshold }

      func startMonitoring() {
          guard isAvailable else { return }
          manager.accelerometerUpdateInterval = 1.0 / 50.0
          manager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
              guard let data else { return }
              let x = data.acceleration.x
              let y = data.acceleration.y
              let z = data.acceleration.z
              let magnitude = sqrt(x*x + y*y + z*z)
              self?.addSample(magnitude)
          }
      }

      func stopMonitoring() {
          manager.stopAccelerometerUpdates()
          samples.removeAll()
      }

      // Internal — also called by tests
      func addSample(_ value: Double) {
          samples.append(value)
          if samples.count > maxSamples {
              samples.removeFirst(samples.count - maxSamples)
          }
      }
  }

  // MARK: - SleepStageProvider conformance

  extension MotionService: SleepStageProvider {
      func currentStage() async throws -> SleepStage? {
          isLightSleep ? .core : .deep
      }
  }
  ```

- [ ] **Step 6.4: Run tests — expect all pass**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/MotionServiceTests \
    2>&1 | grep -E "Test Case|PASSED|FAILED"
  ```
  Expected: 5 test cases PASSED.

- [ ] **Step 6.5: Commit**

  ```bash
  git add SleepWise/SleepWise/Services/MotionService.swift \
          SleepWise/SleepWiseTests/MotionServiceTests.swift
  git commit -m "feat: add MotionService with variance-based light sleep detection"
  ```

---

## Task 7: SoundService

**Files:**
- Create: `SleepWise/SleepWise/Services/SoundService.swift`
- Create: `SleepWise/SleepWiseTests/SoundServiceTests.swift`
- Add 4 placeholder audio files (silent MP3s for testing)

- [ ] **Step 7.1: Write failing tests**

  Create `SleepWise/SleepWiseTests/SoundServiceTests.swift`:

  ```swift
  import XCTest
  @testable import SleepWise

  final class SoundServiceTests: XCTestCase {

      func test_volumeAtStart_isMinimum() {
          let v = SoundService.rampedVolume(elapsed: 0, rampDuration: 90, maxVolume: 1.0)
          XCTAssertEqual(v, 0.1, accuracy: 0.001)
      }

      func test_volumeAtEnd_isMaximum() {
          let v = SoundService.rampedVolume(elapsed: 90, rampDuration: 90, maxVolume: 1.0)
          XCTAssertEqual(v, 1.0, accuracy: 0.001)
      }

      func test_volumeMidway_isHalf() {
          let v = SoundService.rampedVolume(elapsed: 45, rampDuration: 90, maxVolume: 1.0)
          XCTAssertEqual(v, 0.55, accuracy: 0.001)  // 0.1 + 0.5 * 0.9
      }

      func test_volumeAfterEnd_clampedToMax() {
          let v = SoundService.rampedVolume(elapsed: 200, rampDuration: 90, maxVolume: 0.8)
          XCTAssertEqual(v, 0.8, accuracy: 0.001)
      }

      func test_customMaxVolume_respected() {
          let v = SoundService.rampedVolume(elapsed: 90, rampDuration: 90, maxVolume: 0.6)
          XCTAssertEqual(v, 0.6, accuracy: 0.001)
      }

      func test_availableSounds_containsFour() {
          XCTAssertEqual(SoundService.availableSounds.count, 4)
      }
  }
  ```

- [ ] **Step 7.2: Run — expect compile failure**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SoundServiceTests \
    2>&1 | grep -E "error:|PASSED|FAILED"
  ```

- [ ] **Step 7.3: Implement SoundService.swift**

  Create `SleepWise/SleepWise/Services/SoundService.swift`:

  ```swift
  import AVFoundation
  import Foundation

  struct SleepSound: Identifiable, Equatable {
      let id: String      // filename without extension
      let hebrewName: String
      let englishName: String
  }

  final class SoundService {
      static let availableSounds: [SleepSound] = [
          SleepSound(id: "forest_morning", hebrewName: "יער בוקר",    englishName: "Forest Morning"),
          SleepSound(id: "ocean_waves",    hebrewName: "גלי ים",      englishName: "Ocean Waves"),
          SleepSound(id: "tibetan_bowls",  hebrewName: "קערות טיבט",  englishName: "Tibetan Bowls"),
          SleepSound(id: "dawn_chimes",    hebrewName: "פעמוני שחר",  englishName: "Dawn Chimes"),
      ]

      private var player: AVAudioPlayer?
      private var rampTimer: Timer?
      private let rampDuration: TimeInterval = 90
      private var rampStart: Date?

      // Pure function — used in tests and the timer
      static func rampedVolume(
          elapsed: TimeInterval,
          rampDuration: TimeInterval,
          maxVolume: Float
      ) -> Float {
          let progress = Float(min(elapsed / rampDuration, 1.0))
          return 0.1 + progress * (maxVolume - 0.1)
      }

      func play(soundID: String, maxVolume: Float = 1.0) {
          guard let url = Bundle.main.url(forResource: soundID, withExtension: "mp3") else {
              print("SoundService: missing asset \(soundID).mp3")
              return
          }
          stopRamp()
          do {
              try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
              try AVAudioSession.sharedInstance().setActive(true)
              player = try AVAudioPlayer(contentsOf: url)
              player?.volume = 0.1
              player?.numberOfLoops = -1
              player?.prepareToPlay()
              player?.play()
              startRamp(maxVolume: maxVolume)
          } catch {
              print("SoundService: playback error: \(error)")
          }
      }

      func stop() {
          stopRamp()
          player?.stop()
          player = nil
      }

      // MARK: - Private

      private func startRamp(maxVolume: Float) {
          rampStart = Date()
          rampTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
              guard let self, let player = self.player, let start = self.rampStart else {
                  timer.invalidate(); return
              }
              let elapsed = Date().timeIntervalSince(start)
              player.volume = SoundService.rampedVolume(
                  elapsed: elapsed,
                  rampDuration: self.rampDuration,
                  maxVolume: maxVolume
              )
              if elapsed >= self.rampDuration { timer.invalidate() }
          }
      }

      private func stopRamp() {
          rampTimer?.invalidate()
          rampTimer = nil
          rampStart = nil
      }
  }
  ```

- [ ] **Step 7.4: Add placeholder audio files**

  In Terminal on Mac — create 4 silent 3-second MP3s (requires `ffmpeg`):

  ```bash
  cd SleepWise/SleepWise/Resources/Sounds
  for name in forest_morning ocean_waves tibetan_bowls dawn_chimes; do
    ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 -q:a 9 -acodec libmp3lame "${name}.mp3"
  done
  ```

  Then in Xcode: drag the 4 MP3s into the `Resources/Sounds` group, check "Add to target: SleepWise".

  > **Note:** Replace with real audio files before App Store submission.

- [ ] **Step 7.5: Run tests — expect all pass**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    -only-testing:SleepWiseTests/SoundServiceTests \
    2>&1 | grep -E "Test Case|PASSED|FAILED"
  ```
  Expected: 6 test cases PASSED.

- [ ] **Step 7.6: Commit**

  ```bash
  git add SleepWise/SleepWise/Services/SoundService.swift \
          SleepWise/SleepWiseTests/SoundServiceTests.swift \
          "SleepWise/SleepWise/Resources/Sounds/"
  git commit -m "feat: add SoundService with 90s volume ramp"
  ```

---

## Task 8: HealthKitService

**Files:**
- Create: `SleepWise/SleepWise/Services/HealthKitService.swift`

> HealthKit cannot be unit tested without a real device + signed app. Manual verification steps are provided instead.

- [ ] **Step 8.1: Implement HealthKitService.swift**

  Create `SleepWise/SleepWise/Services/HealthKitService.swift`:

  ```swift
  import HealthKit
  import Foundation

  final class HealthKitService: SleepStageProvider {
      private let store = HKHealthStore()

      var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

      // MARK: - Permissions

      func requestPermissions() async throws {
          let sleepType  = HKCategoryType(.sleepAnalysis)
          let heartType  = HKQuantityType(.heartRate)
          try await store.requestAuthorization(toShare: [], read: [sleepType, heartType])
      }

      // MARK: - SleepStageProvider (real-time, last 5 min)

      func currentStage() async throws -> SleepStage? {
          let type = HKCategoryType(.sleepAnalysis)
          let now  = Date()
          let pred = HKQuery.predicateForSamples(
              withStart: now.addingTimeInterval(-300),
              end: now
          )
          let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

          return try await withCheckedThrowingContinuation { cont in
              let q = HKSampleQuery(
                  sampleType: type,
                  predicate: pred,
                  limit: 1,
                  sortDescriptors: [sort]
              ) { _, samples, error in
                  if let error { cont.resume(throwing: error); return }
                  guard
                      let sample = samples?.first as? HKCategorySample,
                      let value  = HKCategoryValueSleepAnalysis(rawValue: sample.value),
                      let stage  = SleepStage.from(value)
                  else {
                      cont.resume(returning: nil); return
                  }
                  cont.resume(returning: stage)
              }
              self.store.execute(q)
          }
      }

      // MARK: - Historical sessions

      func fetchSessions(from start: Date, to end: Date) async throws -> [SleepSession] {
          let type = HKCategoryType(.sleepAnalysis)
          let pred = HKQuery.predicateForSamples(withStart: start, end: end)
          let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

          return try await withCheckedThrowingContinuation { cont in
              let q = HKSampleQuery(
                  sampleType: type,
                  predicate: pred,
                  limit: HKObjectQueryNoLimit,
                  sortDescriptors: [sort]
              ) { _, samples, error in
                  if let error { cont.resume(throwing: error); return }
                  let entries = (samples as? [HKCategorySample] ?? []).compactMap { s -> SleepEntry? in
                      guard
                          let value = HKCategoryValueSleepAnalysis(rawValue: s.value),
                          let stage = SleepStage.from(value)
                      else { return nil }
                      return SleepEntry(stage: stage, start: s.startDate, end: s.endDate)
                  }
                  cont.resume(returning: HealthKitService.groupIntoSessions(entries))
              }
              self.store.execute(q)
          }
      }

      // MARK: - Watch detection

      /// Returns true if the Watch wrote any sleep data in the last 24h.
      func isWatchTrackingEnabled() async -> Bool {
          guard isAvailable else { return false }
          let type = HKCategoryType(.sleepAnalysis)
          let pred = HKQuery.predicateForSamples(
              withStart: Date().addingTimeInterval(-86400),
              end: Date()
          )
          return await withCheckedContinuation { cont in
              let q = HKSampleQuery(
                  sampleType: type,
                  predicate: pred,
                  limit: 1,
                  sortDescriptors: nil
              ) { _, samples, _ in
                  cont.resume(returning: !(samples ?? []).isEmpty)
              }
              self.store.execute(q)
          }
      }

      // MARK: - Internal helpers

      static func groupIntoSessions(_ entries: [SleepEntry]) -> [SleepSession] {
          guard !entries.isEmpty else { return [] }
          var sessions: [SleepSession] = []
          var current: [SleepEntry] = [entries[0]]

          for entry in entries.dropFirst() {
              let gap = entry.start.timeIntervalSince(current.last!.end)
              if gap > 3600 {
                  sessions.append(SleepSession(date: current[0].start, entries: current))
                  current = [entry]
              } else {
                  current.append(entry)
              }
          }
          sessions.append(SleepSession(date: current[0].start, entries: current))
          return sessions
      }
  }
  ```

- [ ] **Step 8.2: Manual verification on device**

  1. Run app on a real iPhone (Cmd+R, select your device)
  2. Grant HealthKit permission when prompted
  3. In Xcode console, add a temporary button that calls:
     ```swift
     Task {
         let hk = HealthKitService()
         try? await hk.requestPermissions()
         let sessions = try? await hk.fetchSessions(
             from: Date().addingTimeInterval(-7 * 86400),
             to: Date()
         )
         print("Sessions fetched: \(sessions?.count ?? 0)")
         sessions?.forEach { s in
             print("  Night \(s.date): \(s.totalSleepDuration / 3600, specifier: "%.1f")h, score: \(SleepScore.calculate(session: s, wokeInStage: nil))")
         }
     }
     ```
  4. Expected: prints sessions from Apple Health (requires Watch sleep data or manual Health entries).

- [ ] **Step 8.3: Commit**

  ```bash
  git add SleepWise/SleepWise/Services/HealthKitService.swift
  git commit -m "feat: add HealthKitService with session fetching and Watch detection"
  ```

---

## Task 9: Full Test Suite Run

- [ ] **Step 9.1: Run all tests**

  ```bash
  xcodebuild test \
    -scheme SleepWise \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    2>&1 | grep -E "Test Suite|Test Case|PASSED|FAILED|error:"
  ```

  Expected output:
  ```
  Test Suite 'SleepStageTests' passed
  Test Suite 'AlarmEngineTests' passed
  Test Suite 'SleepScoreTests' passed
  Test Suite 'MotionServiceTests' passed
  Test Suite 'SoundServiceTests' passed
  ```
  Total: **31 tests, 0 failures.**

- [ ] **Step 9.2: Commit**

  ```bash
  git commit -m "test: all Plan A tests passing — foundation complete"
  ```

---

## Verification Checklist (Plan A complete when all ✅)

- [ ] All 31 unit tests pass on simulator
- [ ] App builds without warnings on real device
- [ ] HealthKit permission prompt appears on first launch
- [ ] Sleep sessions fetch successfully from Apple Health (requires real device with Watch data)
- [ ] Motion variance correctly returns `isLightSleep = true` when phone is shaken, `false` when still
- [ ] Sound plays and volume increases gradually over 90 seconds
- [ ] `AlarmEngine.evaluate()` returns correct decision for all combinations of time + stage

---

*Plan B (UI + Widget + Localization) begins once all items above are checked.*
