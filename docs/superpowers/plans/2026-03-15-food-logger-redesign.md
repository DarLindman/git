# Food Logger UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard, diary, and receipt screens of the food-logger PWA with a warm-brutalism/leather-journal aesthetic, add a Remotion-rendered fire animation on the streak circle, and style the receipt as a stark white thermal printout.

**Architecture:** All visual changes are confined to `food-logger/public/index.html` (inline CSS + JS) and a new Remotion component `FireLoop.tsx`. No backend changes. The fire animation is a pre-rendered MP4 (`fire-loop.mp4`) overlaid with `mix-blend-mode: screen` so the black background disappears.

**Tech Stack:** Vanilla JS/CSS (inline in index.html), Remotion 4.x (TypeScript/React), Node.js dev server (`npm run dev` in `food-logger/`).

**Spec:** `docs/superpowers/specs/2026-03-15-food-logger-redesign-design.md`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `food-logger/remotion/src/FireLoop.tsx` | **Create** | New particle fire Remotion composition |
| `food-logger/remotion/src/Root.tsx` | **Modify** | Register FireLoop composition |
| `food-logger/public/fire-loop.mp4` | **Create** | Rendered output from Remotion |
| `food-logger/public/index.html` | **Modify** | CSS vars, dashboard HTML/CSS/JS, diary CSS/JS, receipt HTML/CSS/JS |

---

## Chunk 1: Remotion FireLoop Component

### Task 1: Create FireLoop.tsx

**Files:**
- Create: `food-logger/remotion/src/FireLoop.tsx`

- [ ] **Step 1: Create the component**

```tsx
// food-logger/remotion/src/FireLoop.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  xOffset: (((i * 73) % 51) - 25),
  swayAmp: 8 + (i * 37) % 13,
  speedMul: 0.7 + (i * 17 % 30) / 100,
  phaseOffset: Math.floor((i / 15) * 60),
  baseRadius: 7 + (i * 11) % 5,
}));

function Particle({ id, xOffset, swayAmp, speedMul, phaseOffset, baseRadius, frame, totalFrames }: {
  id: number; xOffset: number; swayAmp: number; speedMul: number;
  phaseOffset: number; baseRadius: number; frame: number; totalFrames: number;
}) {
  const f = ((frame + phaseOffset) * speedMul) % totalFrames;
  const progress = f / totalFrames;

  const cx = 100 + xOffset + Math.sin(progress * Math.PI * 3 + id) * swayAmp;
  const cy = interpolate(progress, [0, 1], [295, 20]);
  const r = interpolate(progress, [0, 1], [baseRadius, 1.5]);
  const opacity = interpolate(progress, [0, 0.08, 0.65, 1], [0, 1, 0.75, 0]);

  // Colors per spec: #FF2200 → #FF6600 → #FFB300 → near-white (fades via opacity)
  const red   = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [255, 255, 255, 255]));
  const green = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [34,  102, 179, 220]));
  const blue  = Math.round(interpolate(progress, [0, 0.4, 0.7, 1], [0,   0,   0,   0]));

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={`rgba(${red},${green},${blue},${opacity})`}
    />
  );
}

export const FireLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <svg width="200" height="320" viewBox="0 0 200 320"
      style={{ background: '#000000' }}>
      {PARTICLES.map(p => (
        <Particle key={p.id} {...p} frame={frame} totalFrames={durationInFrames} />
      ))}
    </svg>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd food-logger/remotion
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Register FireLoop in Root.tsx

**Files:**
- Modify: `food-logger/remotion/src/Root.tsx`

- [ ] **Step 1: Replace entire Root.tsx**

```tsx
import React from "react";
import { Composition } from "remotion";
import { SaladLogo } from "./SaladLogo";
import { AmbientSteam } from "./AmbientSteam";
import { FireLoop } from "./FireLoop";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="SaladLogo" component={SaladLogo}
        durationInFrames={90} fps={30} width={360} height={360} />
      <Composition id="AmbientSteam" component={AmbientSteam}
        durationInFrames={120} fps={30} width={400} height={300} />
      <Composition id="FireLoop" component={FireLoop}
        durationInFrames={60} fps={30} width={200} height={320} />
    </>
  );
};
```

- [ ] **Step 2: Preview in Remotion Studio**

```bash
cd food-logger/remotion
npm run studio
```

Select `FireLoop`. Verify particles rise, colors shift orange→amber, loop is seamless.

---

### Task 3: Render fire-loop.mp4

**Files:**
- Create: `food-logger/public/fire-loop.mp4`

- [ ] **Step 1: Render**

```bash
cd food-logger/remotion
npx remotion render FireLoop ../public/fire-loop.mp4
```

Expected: file `food-logger/public/fire-loop.mp4` created.

- [ ] **Step 2: Commit**

```bash
cd food-logger
git add remotion/src/FireLoop.tsx remotion/src/Root.tsx public/fire-loop.mp4
git commit -m "feat: Remotion FireLoop composition and rendered fire-loop.mp4"
```

---

## Chunk 2: Dashboard HTML & CSS

### Task 4: Update CSS variables

**Files:**
- Modify: `food-logger/public/index.html` (`:root` block)

- [ ] **Step 1: Update only these tokens in `:root` — leave all others untouched**

```css
--bg:          #0F0A07;
--surface:     #1A1209;
--surface2:    #231810;
--border:      #3D2515;
--text:        #F5E8D0;
--text2:       #C4956A;
--muted:       #8B6B4A;
--accent:      #E8703A;
--accent-dim:  rgba(232,112,58,0.12);
--accent-glow: rgba(232,112,58,0.25);
```

Do NOT remove `--surface3`, `--gold`, `--protein`, `--carb`, `--fat`, `--fiber`, `--ease-out`, `--ease-spring`, `--dur-fast`, or any other existing tokens.

- [ ] **Step 2: Manual verify**

`npm run dev` → open `http://localhost:3000`. App visible, warm dark background, no broken layout.

---

### Task 5: Remove ambient steam, update calorie display HTML

**Files:**
- Modify: `food-logger/public/index.html` (~line 1896)

- [ ] **Step 1: Delete the ambient steam video element**

Find and remove:
```html
<video class="dash-ambient-steam"
  src="/ambient-steam.mp4"
  autoplay muted loop playsinline
  aria-hidden="true"></video>
```

- [ ] **Step 2: Replace the calorie label block**

Find:
```html
<div class="dash-cal-remaining" id="dash-cal-remaining">—</div>
<div class="dash-cal-label-row">
  <span class="dash-cal-label-main">קלוריות נשארו</span>
  <span class="dash-cal-label-sub" id="dash-cal-goal-label">מתוך —</span>
</div>
```

Replace with (the entire `.dash-cal-label-row` div is removed and replaced):
```html
<div class="dash-cal-remaining" id="dash-cal-remaining">—</div>
<div class="dash-cal-goal-row" id="dash-cal-goal-row" style="display:none">
  <span class="dash-cal-slash">/</span>
  <span class="dash-cal-goal-num" id="dash-cal-goal-label"></span>
</div>
<div class="dash-cal-label-main">קלוריות היום</div>
<div class="dash-cal-label-sub" id="dash-cal-label-sub"></div>
```

Note: `id="dash-cal-goal-label"` is preserved on the new `<span>` so existing JS continues to work.

---

### Task 6: Replace streak circle with fire-wrapped version

**Files:**
- Modify: `food-logger/public/index.html` (~line 1914)

- [ ] **Step 1: Replace streak HTML**

Find:
```html
<div class="dash-streak-circle">
  <div class="dash-streak-num" id="dash-streak-num">—</div>
  <div class="dash-streak-lbl">ימים ברצף</div>
</div>
```

Replace with:
```html
<div class="dash-streak-wrap dash-stagger">
  <video id="dash-fire-vid" class="dash-fire-vid"
    src="/fire-loop.mp4" muted playsinline autoplay loop
    style="display:none" aria-hidden="true"></video>
  <div class="dash-streak-circle">
    <div class="dash-streak-num" id="dash-streak-num">—</div>
    <div class="dash-streak-lbl">ימים ברצף</div>
  </div>
</div>
```

---

### Task 7: Add new dashboard CSS, update streak circle size

**Files:**
- Modify: `food-logger/public/index.html` (CSS section)

- [ ] **Step 1: Delete `.dash-ambient-steam` CSS rule** (~line 275)

- [ ] **Step 2: Update streak circle size** — in `.dash-streak-circle {` change `width: 140px` → `160px` and `height: 140px` → `160px`

- [ ] **Step 3: Add `dash-stagger` class** to these three elements in HTML:
  - `.dash-greeting-line` div
  - `.dash-hero-cal` div
  - `.dash-cta` button (the "הוסף ארוחה" button)
  - (`.dash-streak-wrap` already has it from Task 6)

- [ ] **Step 4: Add new CSS rules** after `.dash-streak-lbl` block:

```css
/* Fire & streak wrap */
.dash-streak-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 260px;
}
.dash-streak-circle {
  position: relative;
  z-index: 1;
}
.dash-fire-vid {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 320px;
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 2;
}
/* Calorie goal row */
.dash-cal-goal-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Fraunces', serif;
  font-size: 28px;
  color: var(--text2);
  font-style: italic;
}
/* Entrance stagger */
.dash-stagger {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out);
}
.dash-stagger.anim-visible {
  opacity: 1;
  transform: translateY(0);
}
/* Grain texture */
.dash-wrap::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 5: Manual verify**

Reload dashboard. No steam video, streak circle slightly larger, grain subtle.

- [ ] **Step 6: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: dashboard HTML/CSS — calorie display, streak fire wrap, stagger, grain"
```

---

## Chunk 3: Dashboard JavaScript

### Task 8: Update loadDashboard calorie logic

**Files:**
- Modify: `food-logger/public/index.html` (`loadDashboard`, ~line 2772)

- [ ] **Step 1: Replace calorie display lines**

Find:
```js
document.getElementById('dash-cal-remaining').textContent = goal > 0 ? Math.max(0, goal - cal).toLocaleString('he-IL') : '—';
document.getElementById('dash-cal-goal-label').textContent = goal > 0 ? 'מתוך ' + goal.toLocaleString('he-IL') : '';
```

Replace with:
```js
const calEl = document.getElementById('dash-cal-remaining');
const goalRow = document.getElementById('dash-cal-goal-row');
const goalLbl = document.getElementById('dash-cal-goal-label');
if (cal === 0 && goal === 0) {
  calEl.textContent = '—';
} else if (cal === 0) {
  calEl.textContent = '0';
} else {
  animateCountUp(calEl, cal);
}
if (goal > 0) {
  goalLbl.textContent = goal.toLocaleString('he-IL');
  goalRow.style.display = 'flex';
} else {
  goalRow.style.display = 'none';
}
```

---

### Task 9: Add helper functions and wire up stagger + fire

**Files:**
- Modify: `food-logger/public/index.html` (JS section)

- [ ] **Step 1: Add helpers** just before `loadDashboard`:

```js
function animateCountUp(el, target, duration) {
  duration = duration || 800;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target.toLocaleString('he-IL');
    return;
  }
  var start = performance.now();
  function tick(now) {
    var t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(t * target).toLocaleString('he-IL');
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function animateDashStagger() {
  var els = document.querySelectorAll('.dash-stagger');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach(function(el) { el.classList.remove('anim-visible'); });
  var delays = [0, 150, 300, 450];
  els.forEach(function(el, i) {
    if (reduced) { el.classList.add('anim-visible'); return; }
    setTimeout(function() { el.classList.add('anim-visible'); }, delays[i] || 0);
  });
}
```

- [ ] **Step 2: Call stagger on dashboard navigation**

Find (~line 2691):
```js
if (screen === 'dashboard') loadDashboard();
```
Change to:
```js
if (screen === 'dashboard') { loadDashboard(); animateDashStagger(); }
```

- [ ] **Step 3: Add fire toggle in loadDashboard streak block**

Find:
```js
const { streak } = await apiFetch('/api/streak');
const numEl = document.getElementById('dash-streak-num');
if (numEl) numEl.textContent = streak ?? '—';
```

Add after `if (numEl)` line:
```js
const fireVid = document.getElementById('dash-fire-vid');
if (fireVid) fireVid.style.display = (streak >= 1) ? '' : 'none';
```

- [ ] **Step 4: Manual verify**

- Calorie count-up animates on load
- Elements stagger in sequentially
- Fire shows when streak ≥ 1, hidden when 0
- `X / Y` format when goal set; `—` when no goal and no calories

- [ ] **Step 5: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: dashboard JS — calorie X/Y display, count-up, fire toggle, stagger"
```

---

## Chunk 4: Diary Redesign

### Task 10: Diary background, date stamp, ruled lines

**Files:**
- Modify: `food-logger/public/index.html` (CSS section)

- [ ] **Step 1: Add diary background**

Add or update `#screen-home` CSS rule:
```css
#screen-home {
  background: linear-gradient(160deg, #1C0F08 0%, #0D0603 100%);
}
```

- [ ] **Step 2: Style the date stamp**

Add/update `#diary-date-label`:
```css
#diary-date-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 12px;
}
```

- [ ] **Step 3: Add ruled lines to `#meal-list`**

Add to `#meal-list` CSS rule:
```css
#meal-list {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 27px,
    rgba(61,37,21,0.35) 27px,
    rgba(61,37,21,0.35) 28px
  );
  background-size: 100% 28px;
  padding: 4px 0;
}
```

---

### Task 11: Meal row styling and JS

**Files:**
- Modify: `food-logger/public/index.html` (CSS and `renderMealList` function)

- [ ] **Step 1: Update `.meal-item-row` CSS** (~line 1053)

Add/update these properties on `.meal-item-row`:
```css
.meal-item-row {
  border-left: 3px solid var(--meal-accent, var(--border));
  background: transparent;
  border-bottom: 1px solid rgba(61,37,21,0.3);
  border-radius: 0;
}
```

- [ ] **Step 2: Add meal accent variables and `.mir-name` styling**

After `.meal-item-row` block add:
```css
.meal-accent-breakfast { --meal-accent: #F5A623; }
.meal-accent-lunch     { --meal-accent: #E8703A; }
.meal-accent-dinner    { --meal-accent: #C0392B; }
.meal-accent-snack     { --meal-accent: #8B6B4A; }

.mir-name {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 16px;
  color: var(--text);
}
```

- [ ] **Step 3: Inject accent class in `renderMealList`** (~line 2866)

Find:
```js
el.innerHTML = entries.map(e => `<div class="meal-item-row" id="entry-${e.id}">
```

Replace with:
```js
const ACCENT = { breakfast: 'meal-accent-breakfast', lunch: 'meal-accent-lunch', dinner: 'meal-accent-dinner', snack: 'meal-accent-snack' };
el.innerHTML = entries.map(e => `<div class="meal-item-row ${ACCENT[e.meal_type] || ''}" id="entry-${e.id}">
```

- [ ] **Step 4: Manual verify**

Diary screen: dark leather background, date in stamp, ruled lines, colored left borders per meal type, food names in Fraunces italic.

- [ ] **Step 5: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: diary leather journal — ruled lines, date stamp, meal accent borders, serif names"
```

---

## Chunk 5: Receipt Redesign

### Task 12: Receipt screen CSS

**Files:**
- Modify: `food-logger/public/index.html` (CSS section)

- [ ] **Step 1: Add white background rules**

```css
#screen-analysis {
  background: #FAFAF8;
  color: #1A1A1A;
}
#screen-analysis .topbar {
  background: #FAFAF8;
  border-bottom: 1px solid #E0DDD8;
  color: #1A1A1A;
}
#screen-analysis .topbar button {
  color: #1A1A1A;
}
```

- [ ] **Step 2: Update `.receipt` container**

Find `.receipt {` and update:
```css
.receipt {
  background: #FFFFFF;
  border: none;
  border-radius: 0;
  box-shadow: 0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 24px 20px;
  font-family: 'IBM Plex Mono', monospace;
}
```

- [ ] **Step 3: Add receipt typography and footer CSS**

```css
.receipt-store-header {
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 6px;
  color: #1A1A1A;
  margin-bottom: 2px;
}
.receipt-store-sub {
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: #999;
  letter-spacing: 2px;
  margin-bottom: 12px;
}
.receipt-lbl { font-family: 'IBM Plex Mono', monospace !important; color: #555 !important; text-transform: uppercase; letter-spacing: 1px; }
.receipt-val { font-family: 'IBM Plex Mono', monospace !important; color: #1A1A1A !important; background: transparent !important; }
.receipt-name-input {
  font-family: 'IBM Plex Mono', monospace !important;
  color: #1A1A1A !important;
  background: transparent !important;
  font-size: 18px !important;
  font-weight: 700 !important;
}
.receipt-unit { color: #888 !important; }
.receipt-barcode {
  display: flex; justify-content: center; gap: 2px;
  margin: 12px 0 4px; height: 28px; align-items: flex-end;
}
.receipt-barcode span { background: #1A1A1A; display: inline-block; border-radius: 0; }
.receipt-footer {
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px; color: #AAA; letter-spacing: 3px; margin-top: 4px;
}
#screen-analysis .meal-opt { border: 1px solid #DDD; background: #FFF; color: #333; }
#screen-analysis .meal-opt.selected {
  border-color: #E8703A; background: rgba(232,112,58,0.08); color: #E8703A;
}
#screen-analysis .btn-primary { background: #1A1A1A; color: #FFF; box-shadow: none; }
#screen-analysis .receipt-hr { border-top-color: #CCCCCC; }
```

---

### Task 13: Receipt HTML and JS

**Files:**
- Modify: `food-logger/public/index.html` (~line 2018)

- [ ] **Step 1: Replace existing `.receipt-header`**

Find and remove:
```html
<div class="receipt-header">
  <span class="receipt-title">── ניתוח ─</span>
  <span class="receipt-time" id="receipt-time"></span>
</div>
```

Replace with:
```html
<div class="receipt-store-header">FOOD LOG</div>
<div class="receipt-store-sub" id="receipt-time"></div>
<hr class="receipt-hr">
```

`id="receipt-time"` is preserved — existing JS that sets its `textContent` needs no changes.

- [ ] **Step 2: Add barcode and footer**

Inside `#receipt-body`, find the `<hr>` that comes after the time row (the last `<hr>` before the closing `</div>` of the receipt). Add the barcode and footer immediately after it, before the `</div>`:
```html
<hr class="receipt-hr">  <!-- this is the existing last hr — after the time row -->
<div class="receipt-barcode" id="receipt-barcode"></div>
<div class="receipt-footer">תודה על הרישום ✓</div>
</div>  <!-- closes receipt / receipt-body -->
```

- [ ] **Step 3: Add `renderBarcode` JS helper**

Add near other render helpers:
```js
function renderBarcode(el) {
  if (!el) return;
  el.innerHTML = Array.from({ length: 42 }, function() {
    var h = 12 + Math.random() * 16;
    var w = Math.random() > 0.3 ? (Math.random() > 0.6 ? 3 : 2) : 1;
    return '<span style="width:' + w + 'px;height:' + h + 'px"></span>';
  }).join('');
}
```

- [ ] **Step 4: Call renderBarcode when result is shown**

There are two places where `document.getElementById('analysis-result').style.display = 'block'` is set (in `analyzeText` and `analyzeFood`). Before each occurrence, add:
```js
renderBarcode(document.getElementById('receipt-barcode'));
```

- [ ] **Step 5: Manual verify**

Camera → text input → analyze. Confirm: white/cream screen, "FOOD LOG" mono header, time in subtitle, dashed separators, barcode, "תודה על הרישום ✓" footer, dark save button.

- [ ] **Step 6: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: receipt thermal printer redesign — white bg, FOOD LOG header, barcode footer"
```

---

## Chunk 6: Final Verification & Push

### Task 14: Full cross-screen manual walkthrough

- [ ] **Dashboard:** Stagger animates, calorie count-up plays, `X / Y` shown when goal set, `—` when neither set. Fire above streak when streak ≥ 1.
- [ ] **Diary:** Leather background, ruled lines, date stamp, colored left borders, Fraunces italic names.
- [ ] **Receipt:** White screen, FOOD LOG header, barcode, mono typography, dark save button.
- [ ] **No regressions:** Stats, login, profile, weight screens still work.

### Task 15: Push

- [ ] **Push all commits**

```bash
git push
```
