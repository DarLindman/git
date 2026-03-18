# Capybara Animations & Logo Redesign — Design Spec
**Date:** 2026-03-18
**Status:** Approved

## Overview

Replace the salad video logo with an inline SVG of the existing app capybara holding a salad bowl (ingredients fall in on load). Expand the capybara's presence to the camera/analysis and diary screens. Improve all existing animations (tail wag, ear twitch, better walk turn, more expressive states). Everything uses CSS keyframes + transform/opacity only, honoring `prefers-reduced-motion`.

---

## 1. Logo Redesign

### What
Replace every instance of `<video src="/salad-logo.webm">` with an inline SVG (`<svg class="capy-logo">`) that reuses the existing capybara body shape from `#capy-tpl` extended with arms, a white salad bowl, and staggered falling ingredients (green leaves, tomatoes, corn — circles as designed in mockup v4).

Also remove the `auto-restart` IIFE at the bottom of the script that references `dash-logo-vid` — it becomes dead code once the video is replaced.

### Instances to update
| Location | Current element | Selector to replace |
|---|---|---|
| `#screen-dashboard` pet strip | `<video id="dash-logo-vid">` | `#dash-logo-vid` |
| `#screen-welcome` | `<video src="/salad-logo.webm">` (no id) — first `<video>` inside `.welcome-icon` div | `.welcome-icon video` |
| `<head>` | no favicon | add `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` |
| `public/favicon.svg` | does not exist | new file — 44px version of logo SVG |

### Animation (CSS only)
- **Background**: orange rounded-rect scales in from 0→1 (`capy-logo-bg-enter`, 300ms, `cubic-bezier(0.22,1,0.36,1)`)
- **Bowl + arms**: drop in from above (`capy-logo-bowl-drop`, translateY -40px→0, 400ms, delay 100ms)
- **Ingredients**: 11 circles, each `capy-logo-ing-fall` (translateY -30px→0 + rotate var→0, 450ms, staggered 120ms apart starting at 500ms). Each `<g class="capy-logo-ing">` uses a custom property `--delay` set inline.
- **Idle breathe**: `pet-breathe` 4s loop applied to the body group `<g class="capy-logo-body">`
- `prefers-reduced-motion`: all enter animations set to `animation: none`; breathe removed

### SVG structure (viewBox `0 0 120 120`)
- Orange `<rect>` background, rx=24, animated with `capy-logo-bg-enter`
- `<g class="capy-logo-body">`: capybara body/head/ears/legs/eyes/mouth — same shapes as `#capy-tpl` (static happy state, no state-class system needed)
- Arms: two `<path>` curves from body sides down to bowl rim (same as v4 mockup)
- Paws: two small ellipses at bowl rim
- Bowl: white `<ellipse>` rim (cx=60, cy=93, rx=40, ry=10) + white `<path>` semicircle body, animated with `capy-logo-bowl-drop`
- Ingredients: 11 `<g class="capy-logo-ing">` wrappers each containing one `<circle>`, positions from v4 mockup (bottom layer x≈28–92 y≈96–105, mid layer x≈35–85 y≈90–97, top x=60 y=90)
- Colours: greens (#2E7D32 → #A5D6A7), red tomatoes (#EF5350, #E53935), yellow corn (#FFD54F)

### Favicon (`/public/favicon.svg`)
Standalone SVG file (not a template clone — self-contained). 44×44 viewBox, orange rect rx=10, simplified capybara (head + body, no legs detail, no blush), bowl + 6 key ingredients (3 greens, 2 tomatoes, 1 corn). Linked from `<head>`.

---

## 2. Capybara SVG — New Elements in `#capy-tpl`

### Tail
Small curved path at the right rear of the body. Wrapped in `<g class="pet-tail">` with `transform-box: fill-box; transform-origin: center` for rotation.

```svg
<g class="pet-tail" style="transform-box:fill-box;transform-origin:center">
  <path d="M 88 72 Q 96 68 94 78" stroke="#b07d50" stroke-width="4" fill="none" stroke-linecap="round"/>
</g>
```

### Surprised mouth
```svg
<ellipse class="pet-mouth-surprised" cx="55" cy="62" rx="5" ry="4" fill="#8B5E35"/>
```
Hidden by default (same pattern as other mouth elements).

### Thinking question mark
```svg
<text class="pet-think-q" x="82" y="18" font-size="14" fill="#E8703A" font-family="sans-serif" font-weight="bold" opacity="0">?</text>
```
Hidden by default (`opacity: 0`). Shown via `pet--thinking` state CSS + `capy-think-q` opacity animation.

### New CSS state: `pet--surprised`
Follows the exact same pattern as all existing states. `setPetState` array must be extended to include `'surprised'`.

```css
/* hide defaults */
.pet--surprised .pet-eyes-neutral  { display: none; }
.pet--surprised .pet-mouth-neutral { display: none; }
/* show surprised elements */
.pet--surprised .pet-eyes-happy      { display: block; }  /* reuses wide eyes */
.pet--surprised .pet-mouth-surprised { display: block; }
/* hide others */
.pet--surprised .pet-mouth-grin   { display: none; }
.pet--surprised .pet-mouth-frown  { display: none; }
```

### New CSS modifier: `pet--thinking`
`pet--thinking` is a **modifier class** (not a base state) — it is toggled separately from `setPetState` and is never passed to `setPetState`. It overlays the body-rock and `?` animations on top of whatever base state is current.

```css
/* Body rock — overrides breathe while thinking */
.pet--thinking {
  animation: capy-think 1.2s ease-in-out infinite !important;
  transform-origin: center bottom;
}
@keyframes capy-think {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  30%       { transform: rotate(-8deg) translateY(-3px); }
  60%       { transform: rotate(4deg) translateY(-1px); }
}

/* Question mark pulse */
.pet--thinking .pet-think-q { animation: capy-think-q 1.2s ease-in-out infinite; }
@keyframes capy-think-q {
  0%, 100% { opacity: 0; transform: translateY(0); }
  30%, 70%  { opacity: 1; transform: translateY(-3px); }
}
```

---

## 3. Animation Improvements

### 3a. Idle animations

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
.pet-wagging .pet-tail { animation: pet-tail-wag 0.6s ease-in-out; }
```

**Ear twitch** (new):
```css
@keyframes pet-ear-twitch {
  0%, 100% { transform: scaleY(1); }
  40%       { transform: scaleY(1.35); }
}
.pet-ear-twitching .pet-ear-left { animation: pet-ear-twitch 150ms ease-in-out; }
```
The ears in `#capy-tpl` must have `<g class="pet-ear-left">` and `<g class="pet-ear-right">` wrappers added around the existing ear circles (left ear = cx=30, right ear = cx=80).

### 3b. State transition pop
When `setPetState` changes state, briefly add class `pet-state-pop` to the `.pet-wrap`:
```css
@keyframes pet-state-pop {
  0%   { transform: scale(0.92); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
.pet-state-pop { animation: pet-state-pop 0.25s cubic-bezier(0.22,1,0.36,1) both; }
```
Remove the class after 250ms via `setTimeout`.

### 3c. Stats screen walk (improve existing)
- Speed: 0.85 px/frame (was 0.5)
- Bob: `capy-walk-bob` rotate ±3deg translateY -3px (was ±2deg -2px)
- Turn: pause scaleX flip 150ms — add `pet-hop` class, wait for it, then flip, then remove:
```css
@keyframes pet-hop {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
.pet-hopping { animation: pet-hop 150ms cubic-bezier(0.25,1,0.5,1); }
```

### 3d. `startIdleAnimations` / `stopIdleAnimations`

```javascript
// Module-level refs for cleanup in navigate()
let _dashPetWrap   = null;
let _diaryPetWrap  = null;
let _cameraPetWrap = null;

function startIdleAnimations(petWrap) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopIdleAnimations(petWrap); // clear any existing
  const intervals = [];
  // Tail wag: random 5–8s
  intervals.push(setInterval(() => {
    petWrap.classList.add('pet-wagging');
    setTimeout(() => petWrap.classList.remove('pet-wagging'), 600);
  }, 5000 + Math.random() * 3000));
  // Ear twitch: random 8–12s
  intervals.push(setInterval(() => {
    petWrap.classList.add('pet-ear-twitching');
    setTimeout(() => petWrap.classList.remove('pet-ear-twitching'), 150);
  }, 8000 + Math.random() * 4000));
  petWrap._idleIntervals = intervals;
}

function stopIdleAnimations(petWrap) {
  if (!petWrap?._idleIntervals) return;
  petWrap._idleIntervals.forEach(clearInterval);
  petWrap._idleIntervals = [];
}
```

`navigate()` must call `stopIdleAnimations` on all three refs unconditionally on every navigation:
```javascript
// at the top of navigate():
stopIdleAnimations(_dashPetWrap);
stopIdleAnimations(_diaryPetWrap);
stopIdleAnimations(_cameraPetWrap);
```

---

## 4. Camera / Analysis Screen (New)

### Placement
`<div id="pet-camera-wrap">` inserted as the **first child of `div.page`** inside `#screen-analysis`. This places it above `#analysis-img`, `#analysis-loading`, and the result section.

```html
<div class="page">
  <div id="pet-camera-wrap" style="display:flex;justify-content:center;padding:8px 0 4px"></div>
  <!-- existing: analysis-img, analysis-loading, analysis-result, ... -->
```

### Behaviour
| App state | Pet state | Animation |
|---|---|---|
| Idle (screen just entered) | `neutral` | breathe + idle |
| Analysis in progress | `thinking` | `capy-think` body rock + `capy-think-q` opacity pulse |
| Analysis succeeded | `ecstatic` | `pet-tap` × 2, then `setPetState(wrap,'happy')` after 2s |
| Analysis failed / error | `sad` | frown, breathe only |

### JS integration
New helper `_cameraCapyState(state)`. `'thinking'` is **not** passed to `setPetState` — it is only toggled as a modifier class. `setPetState` is extended only with `'surprised'` (not `'thinking'`). The known-states array in `setPetState` becomes: `['ecstatic','happy','neutral','sad','sleeping','surprised']`.

```javascript
function _cameraCapyState(state) {
  const wrap = document.getElementById('pet-camera-wrap');
  if (!wrap) return;
  if (!wrap.querySelector('svg')) {
    const pet = cloneCapybara(56);
    wrap.appendChild(pet);
    _cameraPetWrap = pet;
    startIdleAnimations(pet);
  }
  const pet = wrap.querySelector('.pet-wrap');
  if (!pet) return;
  // thinking is a modifier, not a base state
  const baseState = state === 'thinking' ? 'neutral' : state;
  setPetState(pet, baseState);
  pet.classList.toggle('pet--thinking', state === 'thinking');
}
```

On `navigate('analysis')`, call `_cameraCapyState('neutral')` — this clears `pet--thinking` via the toggle and resets the base state.
```
Called: before fetch → `'thinking'`; on success → `'ecstatic'`; on error → `'sad'`; on screen enter (in `navigate('analysis')`) → `'neutral'`.

### Size
`cloneCapybara(56)`

---

## 5. Diary / Home Screen (New)

### Placement
Inside `#daily-summary-card`, absolutely positioned bottom-left. The card already has sufficient height. Add `position: relative` to `#daily-summary-card` CSS rule.

```html
<div id="pet-diary-wrap" style="position:absolute;bottom:8px;left:8px;z-index:1;pointer-events:none"></div>
```
Inserted as last child inside `#daily-summary-card`.

### Size
`cloneCapybara(48)`

### State logic (called at end of `renderDailySummary`)
```javascript
function getDiaryPetState(cal, goal) {
  if (cal === 0)               return 'sleeping';
  if (goal > 0 && cal > goal)  return 'surprised';
  if (cal > 0)                 return 'happy';
  return 'neutral';
}
// usage:
const state = getDiaryPetState(totals.cal, calcRecommendedCal());
const diaryWrap = document.getElementById('pet-diary-wrap');
if (diaryWrap) {
  if (!diaryWrap.querySelector('svg')) {
    const pet = cloneCapybara(48);
    diaryWrap.appendChild(pet);
    _diaryPetWrap = pet;
    startIdleAnimations(pet);
  }
  const pet = diaryWrap.querySelector('.pet-wrap');
  if (pet) setPetState(pet, state);
}
```

### No speech bubble — pet appears alone

---

## 6. `prefers-reduced-motion` Coverage

The existing codebase has a global `@media (prefers-reduced-motion: reduce)` rule (line ~154) that sets `animation-duration: 0.01ms`. That rule covers all new CSS animations automatically. The `startIdleAnimations` function additionally guards with a `matchMedia` check so JS-triggered intervals never fire. No per-class overrides needed beyond the logo enter animations which explicitly set `animation: none` in that media query block for clarity.

---

## Out of Scope
- Sound effects
- Capybara on settings / weight / auth screens
- Drag interactions
- Capybara dialogue system / persistent messages
- Editing the capybara SVG shape beyond the new elements specified above
