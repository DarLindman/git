# Capybara Animations & Logo Redesign — Design Spec
**Date:** 2026-03-18
**Status:** Approved

## Overview

Replace the salad video logo with an inline SVG of the existing app capybara holding a salad bowl (ingredients fall in on load). Expand the capybara's presence to the camera/analysis and diary screens. Improve all existing animations (tail wag, ear twitch, better walk turn, more expressive states). Everything uses CSS keyframes + transform/opacity only, honoring `prefers-reduced-motion`.

---

## 1. Logo Redesign

### What
Replace every instance of `<video src="/salad-logo.webm">` with an inline SVG (`<svg id="capy-logo-svg">`) that reuses the existing capybara body shape from `#capy-tpl` extended with arms, a white salad bowl, and staggered falling ingredients (green leaves, tomatoes, corn — circles as designed in mockup v4).

### Instances to update
| Location | Current | New |
|---|---|---|
| `#screen-dashboard` pet strip | `<video id="dash-logo-vid">` | `<svg id="capy-logo-svg" class="capy-logo">` |
| `#screen-welcome` | `<video src="/salad-logo.webm">` | same SVG markup |
| `<head>` | no favicon | `<link rel="icon" href="/favicon.svg">` |
| `public/favicon.svg` | does not exist | new file — 44px version of logo SVG |

### Animation (CSS only)
- **Background**: orange rounded-rect scales in from 0→1 (`capy-logo-bg-enter`, 300ms, `cubic-bezier(0.22,1,0.36,1)`)
- **Bowl + arms**: drop in from above (`capy-logo-bowl-drop`, translateY -40px→0, 400ms, delay 100ms)
- **Ingredients**: 11 circles, each `capy-logo-ing-fall` (translateY -30px→0 + rotate var→0, 450ms, staggered 120ms apart starting at 500ms)
- **Idle breathe**: `pet-breathe` 3s loop (already exists), applied to whole SVG group
- `prefers-reduced-motion`: all enter animations set to `animation: none`; breathe removed

### SVG structure (viewBox `0 0 120 120`)
- Orange `<rect>` background, rx=24
- Capybara body/head/ears/legs/eyes/mouth — same shapes as `#capy-tpl` (static happy state for logo)
- Arms: two `<path>` curves from body sides down to bowl rim
- Paws: two small ellipses at bowl rim
- Bowl: white `<ellipse>` rim (cx=60, cy=93, rx=40, ry=10) + white `<path>` semicircle body
- Ingredients: 11 `<circle>` elements in two layers — bottom layer spread far to sides (x≈28–92, y≈96–105), mid layer (x≈35–85, y≈90–97), one top circle (x=60, y=90) just peeking above rim
- Colours: greens (#2E7D32 → #A5D6A7), red tomatoes (#EF5350, #E53935), yellow corn (#FFD54F)

### Favicon (`/public/favicon.svg`)
Same SVG at 44px: simplified (no legs detail, no blush), background orange rect rx=10, capybara + bowl + 6 key ingredients. Linked via `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` in `<head>`.

---

## 2. Capybara SVG — New Elements

The `#capy-tpl` template gets two new animatable parts:

### Tail
Small curved `<path>` at the right rear of the body (approx x=88–96, y=68–78). Wrapped in `<g class="pet-tail">`.

```
<path class="pet-tail-shape" d="M 88 72 Q 96 68 94 78" stroke="#b07d50" stroke-width="4" fill="none" stroke-linecap="round"/>
```

### Surprised mouth
New `<path class="pet-mouth-surprised">` — small open oval at snout center, hidden by default, shown in `pet--surprised` state.

### New CSS state: `pet--surprised`
- Shows `pet-eyes-happy` (wide) + `pet-mouth-surprised`
- Hides neutral/grin/frown
- Used on diary screen when user is over calorie goal

---

## 3. Animation Improvements

### 3a. Idle animations (applied to all `.pet-wrap` instances)

**Breathe** (improve existing):
```css
@keyframes pet-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.04); }
}
/* duration: 4s (was 3s), easing: cubic-bezier(0.45,0,0.55,1) */
```

**Tail wag** (new):
```css
@keyframes pet-tail-wag {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(18deg); }
  75%       { transform: rotate(-10deg); }
}
```
Applied via JS: `startIdleAnimations(petWrap)` schedules `setInterval` that randomly (every 5–8s) adds class `pet-wagging` (which applies `pet-tail-wag 0.6s ease-in-out`) then removes it.

**Ear twitch** (new):
```css
@keyframes pet-ear-twitch {
  0%, 100% { transform: scaleY(1); }
  40%       { transform: scaleY(1.35); }
}
```
Applied to `.pet-ear-left` (or both ears) randomly every 8–12s via `startIdleAnimations`. Duration 150ms.

### 3b. State transition
When `setPetState` changes state, add class `pet-state-pop` to the eyes group:
```css
@keyframes pet-state-pop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}
.pet-state-pop { animation: pet-state-pop 0.3s cubic-bezier(0.22,1,0.36,1) both; }
```

### 3c. Stats screen walk (improve existing)
- Speed: 0.85 px/frame (was 0.5)
- Bob: `capy-walk-bob` rotate ±3deg (was ±2deg)
- Turn: on direction change, add `pet-hop` class for 150ms before flipping scaleX:
```css
@keyframes pet-hop {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
```

---

## 4. Camera / Analysis Screen (New)

### Placement
Below the capture buttons, above the result section. A small `<div id="pet-camera-wrap">` inserted into `#screen-analysis` HTML.

### Behaviour
| App state | Pet state | Animation |
|---|---|---|
| Idle (no analysis running) | `neutral` | breathe only |
| Analysis in progress | `thinking` | new `capy-think` animation |
| Analysis succeeded | `ecstatic` | `pet-tap` × 2 (existing), then settle to `happy` after 2s |
| Analysis failed | `sad` | frown, no special animation |

### `thinking` animation (new)
```css
@keyframes capy-think {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  30%       { transform: rotate(-8deg) translateY(-3px); }
  60%       { transform: rotate(4deg) translateY(-1px); }
}
/* duration: 1.2s, infinite while analyzing */
```
A `<text>` element `?` (font-size 14, fill #E8703A) above the head, animated with `opacity: 0 → 1 → 0` in sync.

### JS integration
- `analyzeImage` / `analyzeText`: set `_cameraCapyState('thinking')` before fetch, `_cameraCapyState('ecstatic'/'sad')` in then/catch.
- `_cameraCapyState(state)` helper: sets pet state + starts/stops `capy-think` class.

### Size
`cloneCapybara(56)` — same size as stats capybara.

---

## 5. Diary / Home Screen (New)

### Placement
Inside `#daily-summary-card`, absolutely positioned in the bottom-left corner (RTL: bottom-right visually). Does not affect card layout. `position: absolute; bottom: 8px; left: 8px; z-index: 1`. The card gets `position: relative`.

### Size
`cloneCapybara(48)`

### State logic (called from `renderDailySummary`)
```javascript
function getDiaryPetState(cal, goal) {
  if (cal === 0)               return 'sleeping';
  if (goal > 0 && cal > goal)  return 'surprised';
  if (cal > 0)                 return 'happy';
  return 'neutral';
}
```

### No speech bubble
Pet appears alone — diary already shows full numeric summary. No text added.

### `pet--surprised` CSS (new state)
Shows wide eyes (`pet-eyes-happy`) + `pet-mouth-surprised`. Hides grin/frown/neutral. No extra animation beyond breathe.

---

## 6. `startIdleAnimations` / `stopIdleAnimations`

New JS helpers that manage tail wag + ear twitch timers for any `.pet-wrap`. Called:
- `startIdleAnimations(petWrap)` — on dashboard load, diary render, camera screen enter
- `stopIdleAnimations(petWrap)` — on navigate away (inside existing `navigate()` function)

Store interval IDs on the element: `petWrap._idleIntervals = [...]`. `stopIdleAnimations` clears all.

`prefers-reduced-motion` guard at top of `startIdleAnimations`: return early if matched.

---

## 7. `prefers-reduced-motion` Coverage

All new keyframe animations must be disabled:
```css
@media (prefers-reduced-motion: reduce) {
  .pet-wagging,
  .pet-ear-twitching,
  .pet-state-pop,
  .pet-hop,
  .pet--thinking { animation: none !important; }
  .capy-logo-svg * { animation: none !important; }
}
```

---

## Out of Scope
- Sound effects
- Capybara on settings / weight / auth screens
- Drag interactions
- Capybara dialogue system / persistent messages
- Editing the capybara SVG shape (only new elements added, not reshaped)
