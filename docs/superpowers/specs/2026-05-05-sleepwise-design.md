# SleepWise — Design Spec
**Date:** 2026-05-05  
**Status:** Awaiting approval

---

## Overview

A free iOS sleep app that connects to Apple Health, reads sleep stage data, and wakes the user during their lightest sleep phase within a configurable window before their target alarm time. Inspired by Sleep Cycle, free and open.

**Platform:** iOS (App Store) — SwiftUI  
**Languages:** Hebrew + English (follows device language by default; user can override)  
**Scope:** V1 only. Social/friends features deferred to V2.

---

## Visual Design System

**Direction:** Aurora — dark backgrounds with breathing teal-purple gradients  
**Feel:** Like watching northern lights from under a blanket. Alive but calm.

| Token | Value |
|-------|-------|
| Background | `#0d1520` deep navy |
| Gradient layer 1 | `rgba(60,200,180,0.22)` teal, top-right |
| Gradient layer 2 | `rgba(100,60,180,0.20)` purple, bottom-left |
| Accent | `rgba(60,200,180,0.7)` teal |
| Primary text | `#e8f8f5` near-white |
| Secondary text | `rgba(100,220,200,0.4)` muted teal |
| Background animation | slow breathing, 12–14s, `brightness` + radial shift |

**Typography**
- Display (time, big numbers): **Gloock** — elegant, distinctive, not overused
- Italic labels (sleep phase name): **Instrument Serif** italic
- UI labels + buttons: **Instrument Sans** 300–400

**Sleep graph:** Single quiet SVG path, gradient fill below the curve, one glowing dot for current position. No axes, no grid — minimal.

---

## Architecture

### Tech Stack
| Layer | Technology |
|-------|-----------|
| UI | SwiftUI |
| Sleep data (Watch) | HealthKit — `HKCategoryTypeIdentifier.sleepAnalysis` |
| Sleep data (iPhone) | CoreMotion — `CMMotionManager` accelerometer |
| Alarm audio | AVFoundation — gradual volume ramp |
| Scheduled alarm | UserNotifications + BackgroundTasks |
| Widget | WidgetKit |
| Watch communication | WatchConnectivity |

### Sleep Detection Logic

**Priority:** Awake → Core (N1/N2) → REM → Deep (never preferred, last resort)

**With Apple Watch (sleep tracking enabled):**
- HealthKit polling every 2 minutes during alarm window
- Trigger alarm when latest stage = Awake or Core
- If only REM available in window, trigger on REM
- If window ends with no light sleep detected → trigger at target time regardless

**iPhone-only fallback:**
- CMMotionManager samples accelerometer at 50Hz
- Movement variance above threshold = light sleep
- Same window logic applies

**Smart Snooze:**
- Delays 5 minutes but re-enters monitoring loop
- Waits for next light sleep moment rather than blind 5-min countdown
- Maximum 2 snoozes, then forces wake

### Alarm Window
- Default: 30 minutes before target time
- User-configurable: 10–90 minutes (in Settings)

---

## Navigation

Tab Bar (bottom, 4 items — iOS HIG):

```
[ הלילה ] [ היסטוריה ] [ סטטיסטיקות ] [ הגדרות ]
```

---

## Screens

### Tab 1 — הלילה (Tonight)

**State A: Before sleep (Watch user)**
- "השעון עוקב הלילה" — no button, fully automatic
- Shows tonight's alarm time + window
- Brief summary card of last night (score + hours)

**State B: Before sleep (iPhone-only user)**
- Set alarm time picker
- "התחל מעקב" button — starts CoreMotion monitoring
- Brief summary card of last night

**State C: Active sleep tracking**
- Full Aurora gradient background (breathing animation)
- Current time (Gloock, large)
- Current sleep stage (Instrument Serif italic)
- Live sleep graph building in real-time
- Alarm time shown quietly at bottom

**State D: Morning wake-up summary**
- Total sleep hours
- Sleep score (0–100)
- Stage breakdown (Deep / Core / REM pie or bars)
- Exact moment the alarm triggered and which stage the user was in
- "Good morning" message in device language

### Tab 2 — היסטוריה (History)

- **Weekly view:** 7 columns, each with a mini sleep graph + hours
- **Monthly view:** Calendar grid, each day colored by score (muted teal = good, muted red = poor)
- Tap any night → full detail screen (same as morning summary)
- Toggle between weekly/monthly via segmented control

### Tab 3 — סטטיסטיקות (Statistics)

- Average sleep hours — last 7 days / last 30 days (toggle)
- Average sleep score
- Stage breakdown averages (% Deep / Core / REM)
- Streak: consecutive nights with ≥ 7 hours
- Best wake time (which stage the user most often wakes from)

### Tab 4 — הגדרות (Settings)

- **Alarm window:** slider 10–90 min (default 30)
- **Wake sound:** picker with 4 options + preview button
- **Volume ramp:** how quickly sound builds (gentle / moderate / firm)
- **Language:** Hebrew / English / Follow device
- **Apple Watch:** status indicator + link to Health app if sleep tracking is off
- **About / Privacy**

---

## Alarm Sounds (V1, bundled)

4 tracks, each builds over 90 seconds:

| Name | Arc |
|------|-----|
| יער בוקר (Forest Morning) | Quiet birds + breeze → lively birdsong |
| גלי ים (Ocean Waves) | Gentle lapping → stronger rhythmic waves |
| קערות טיבט (Tibetan Bowls) | Soft single tone → resonant layered bowls |
| פעמוני שחר (Dawn Chimes) | Delicate single chime → bright uplifting melody |

All tracks use AVFoundation volume envelope: starts at 10% volume, reaches 100% by 90 seconds. User can set max volume cap in settings.

---

## Apple Watch Integration

| Scenario | Behavior |
|---------|---------|
| Watch detected + sleep tracking ON | Fully automatic. No button shown. |
| Watch detected + sleep tracking OFF | Prompt shown: "הפעל מעקב שינה ב-Apple Watch" with link to Health app. Offer iPhone fallback. |
| No Watch | iPhone CoreMotion mode. Show "התחל מעקב" button. |

HealthKit permissions requested on first launch:
- Read: `sleepAnalysis`
- Read: `heartRate` (optional, for future scoring improvements)

---

## Widget (WidgetKit)

**Small:** Last night's sleep hours + score badge  
**Medium:** Mini sleep graph + score + next alarm time  

Updates once per morning after wake summary is generated.

---

## Localization

- All strings in `Localizable.strings` from day one
- Hebrew: RTL layout, `lang="he"`, `dir="rtl"`
- English: LTR layout
- Default: `Locale.current.language`
- User override stored in UserDefaults

---

## Sleep Score Algorithm (V1)

Simple weighted formula:
```
score = (total_hours / 8.0 × 40)
      + (deep_pct / 0.20 × 30)      // 20% deep is ideal
      + (rem_pct / 0.25 × 20)       // 25% REM is ideal
      + (wake_stage_bonus × 10)     // 10 pts if woken in Core/Awake
```
Clamped to 0–100.

---

## Privacy

- All sleep data stays on device (HealthKit + local CoreData)
- No analytics, no tracking, no backend in V1
- App Store privacy label: Health & Fitness data, not shared

---

## Out of Scope (V2)

- Friends / social sleep sharing
- Apple Music / Spotify alarm integration
- AI-powered sleep coaching

---

## Verification Plan

1. Run on real device (not simulator) — HealthKit requires real hardware
2. Test Watch path: enable/disable Watch sleep tracking, verify UI state switches correctly
3. Test iPhone-only path: place phone on surface, verify CoreMotion detects movement variance
4. Test alarm window: set a 2-minute window, verify alarm fires within it
5. Test Smart Snooze: snooze twice, verify third attempt forces wake
6. Test sounds: all 4 tracks, verify volume ramp over 90 seconds
7. Test localization: switch device to English, verify layout flips to LTR
8. Test Widget: verify it updates correctly after morning summary
9. TestFlight: install on personal device, use for 3+ nights before App Store submission
