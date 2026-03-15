# Food Logger UI Redesign — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Dashboard, Diary, Analysis/Receipt screen, Remotion fire animation

---

## Overview

Redesign three screens of the food-logger PWA with a cohesive "warm brutalism / leather journal" aesthetic. All existing data, API calls, and functionality remain unchanged — purely a visual and animation overhaul.

---

## Aesthetic Direction

**Theme:** Warm brutalism meets leather journal. Dark, intimate, personal — like opening a hand-worn diary by candlelight. The receipt screen breaks the pattern intentionally with stark white for contrast and clarity.

**Color Palette — UPDATE ONLY THESE TOKENS, preserve all others:**

The following `:root` tokens should be updated. All other existing tokens (`--surface3`, `--gold`, `--protein`, `--carb`, `--fat`, `--fiber`, `--ease-out`, `--ease-spring`, `--dur-fast`, etc.) must be preserved unchanged.

```css
/* Update these in :root */
--bg:         #0F0A07;
--surface:    #1A1209;
--surface2:   #231810;
--border:     #3D2515;
--text:       #F5E8D0;
--text2:      #C4956A;
--muted:      #8B6B4A;
--accent:     #E8703A;   /* unchanged */
--accent-dim: rgba(232,112,58,0.12);
--accent-glow:rgba(232,112,58,0.25);
```

**Typography:** Fraunces (display), IBM Plex Mono (mono/receipt), DM Sans (body).

---

## Screen 1: Dashboard

### Removals
- Remove the `<video class="dash-ambient-steam">` element from HTML.
- Remove the `.dash-ambient-steam` CSS rule.
- The file `ambient-steam.mp4` stays on disk, just no longer referenced.

### Calorie Display Change
Replace "calories remaining" with consumed/goal format in the hero area.

**JS logic** (in `loadDashboard` or equivalent, where `cal` = total consumed today, `goal` = daily calorie goal):
- `#dash-cal-remaining` textContent:
  - If `cal === 0` and `goal === 0`: show `'—'` (unchanged from current "not configured" signal)
  - If `cal === 0` and `goal > 0`: show `'0'`
  - Otherwise: show `cal.toLocaleString('he-IL')`
- `#dash-cal-goal-label` and `#dash-cal-slash`:
  - If `goal > 0`: show both, set label to `goal.toLocaleString('he-IL')`
  - If `goal === 0`: hide both
- Label text `#dash-cal-label-main`: change static text from `קלוריות נשארו` to `קלוריות היום`

**HTML changes** — replace the **entire existing `.dash-cal-label-row` div** (and its contents) with the following block. The `id="dash-cal-goal-label"` is preserved on the new `<span class="dash-cal-goal-num">` so existing JS (`getElementById('dash-cal-goal-label').textContent = ...`) continues to work unchanged:
```html
<div class="dash-cal-remaining" id="dash-cal-remaining">—</div>
<div class="dash-cal-goal-row" id="dash-cal-goal-row" style="display:none">
  <span class="dash-cal-slash">/</span>
  <span class="dash-cal-goal-num" id="dash-cal-goal-label"></span>
</div>
<div class="dash-cal-label-main">קלוריות היום</div>
<div class="dash-cal-label-sub" id="dash-cal-label-sub"></div>
```

**New CSS:**
```css
.dash-cal-goal-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Fraunces', serif;
  font-size: 28px;
  color: var(--text2);
  font-style: italic;
}
```

### Streak Circle + Fire Overlay

**HTML** — replace the existing bare `.dash-streak-circle` div with:
```html
<div class="dash-streak-wrap">
  <video id="dash-fire-vid" class="dash-fire-vid"
    src="/fire-loop.mp4" muted playsinline autoplay loop
    style="display:none" aria-hidden="true"></video>
  <div class="dash-streak-circle">
    <div class="dash-streak-num" id="dash-streak-num">—</div>
    <div class="dash-streak-lbl">ימים ברצף</div>
  </div>
</div>
```

**CSS:**
```css
.dash-streak-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 260px;          /* circle 160px + ~100px space above for fire */
}

.dash-streak-circle {
  width: 160px;           /* enlarged from 140px */
  height: 160px;
  position: relative;
  z-index: 1;
  /* keep all existing border-radius, background, box-shadow rules */
}

.dash-fire-vid {
  position: absolute;
  bottom: 0;              /* fire base aligns with bottom of circle */
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 320px;
  mix-blend-mode: screen; /* black bg becomes transparent */
  pointer-events: none;
  z-index: 2;
}
```

**JS:** after loading streak value:
```js
document.getElementById('dash-fire-vid').style.display = streak >= 1 ? '' : 'none';
```

### Entrance Animations

**CSS — define stagger states:**
```css
.dash-stagger {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out);
}
.dash-stagger.anim-visible {
  opacity: 1;
  transform: translateY(0);
}
```

Add class `dash-stagger` to: `.dash-greeting-line`, `.dash-hero-cal`, `.dash-streak-wrap`, `.dash-cta` (the add-meal button).

**JS — stagger on each dashboard navigation** (not just first load):
```js
function animateDashStagger() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.dash-stagger').forEach(el => el.classList.add('anim-visible'));
    return;
  }
  document.querySelectorAll('.dash-stagger').forEach(el => el.classList.remove('anim-visible'));
  const delays = [0, 150, 300, 450];
  document.querySelectorAll('.dash-stagger').forEach((el, i) => {
    setTimeout(() => el.classList.add('anim-visible'), delays[i] || 0);
  });
}
```

**Count-up animation** — respects `prefers-reduced-motion`:
```js
function animateCountUp(el, target, duration = 800) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target.toLocaleString('he-IL');
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const val = Math.round(t * target);
    el.textContent = val.toLocaleString('he-IL');
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```
Call `animateCountUp` **only when `cal > 0`**. For the `'—'` and `'0'` sentinel cases, set `textContent` directly without calling `animateCountUp` (calling it with `target=0` would overwrite a `'—'` sentinel with `'0'`):
```js
if (cal > 0) {
  animateCountUp(document.getElementById('dash-cal-remaining'), cal);
} // else textContent was already set by the branch logic above
```

### Grain Texture
```css
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

---

## Screen 2: Diary (יומן)

### Background
```css
#screen-home {
  background: linear-gradient(160deg, #1C0F08 0%, #0D0603 100%);
}
```

### Date Navigation Stamp
The `.date-display` element already exists. Style it as a rubber stamp:
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

### Meal List — Ruled Lines
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

### Meal Item Rows
The actual class is **`.meal-item-row`** (not `.meal-item`). The template literal inside `renderMealList()` generates these. Update the CSS for `.meal-item-row`:

```css
.meal-item-row {
  border-right: none;          /* remove any existing right border */
  border-left: 3px solid var(--meal-accent, var(--border));
  background: transparent;
  border-bottom: 1px solid rgba(61,37,21,0.3);
  border-radius: 0;
}
```

Add meal-type color classes. In `renderMealList()`, add the appropriate class to each row based on `meal.meal_type`:
```js
const mealAccentClass = {
  breakfast: 'meal-accent-breakfast',
  lunch:     'meal-accent-lunch',
  dinner:    'meal-accent-dinner',
  snack:     'meal-accent-snack',
}[meal.meal_type] || '';
// Add mealAccentClass to the row element's className
```

```css
.meal-accent-breakfast { --meal-accent: #F5A623; }
.meal-accent-lunch     { --meal-accent: #E8703A; }
.meal-accent-dinner    { --meal-accent: #C0392B; }
.meal-accent-snack     { --meal-accent: #8B6B4A; }
```

### Food Name in Rows
Inside `renderMealList()`, the `.mir-name` element renders the food name. Add Fraunces italic to this element:
```css
.mir-name {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-size: 16px;
  color: var(--text);
}
```

---

## Screen 3: Analysis / Receipt

### Background
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

### Receipt Container
```css
.receipt {
  background: #FFFFFF;
  border: none;
  border-radius: 0;
  box-shadow: 0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 24px 20px;
}
```

### Receipt Header — Replace Existing
**Remove** the existing `.receipt-header` div:
```html
<!-- REMOVE THIS: -->
<div class="receipt-header">
  <span class="receipt-title">── ניתוח ─</span>
  <span class="receipt-time" id="receipt-time"></span>
</div>
```

**Replace with:**
```html
<div class="receipt-store-header">FOOD LOG</div>
<div class="receipt-store-sub" id="receipt-time"></div>
<hr class="receipt-hr">
```

Note: `receipt-time` id moves to `.receipt-store-sub` so existing JS that sets `document.getElementById('receipt-time').textContent = hhmm` continues to work without changes.

### Receipt Typography
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
.receipt-lbl {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.receipt-val, .receipt-name-input {
  font-family: 'IBM Plex Mono', monospace;
  color: #1A1A1A;
  background: transparent;
}
.receipt-name-input {
  font-size: 18px;
  font-weight: 700;
}
.receipt-hr {
  border: none;
  border-top: 1px dashed #CCCCCC;
  margin: 10px 0;
}
.receipt-unit {
  color: #888;
}
```

### Receipt Footer — Add Below Last `<hr>`
```html
<div class="receipt-barcode" id="receipt-barcode"></div>
<div class="receipt-footer">תודה על הרישום ✓</div>
```

```css
.receipt-barcode {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin: 12px 0 4px;
  height: 28px;
  align-items: flex-end;
}
.receipt-barcode span {
  background: #1A1A1A;
  border-radius: 0;
  display: inline-block;
}
.receipt-footer {
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  color: #AAA;
  letter-spacing: 3px;
  margin-top: 4px;
}
```

**JS — barcode generator** (call when showing receipt):
```js
function renderBarcode(el) {
  el.innerHTML = Array.from({length: 42}, () => {
    const h = 12 + Math.random() * 16;
    const w = Math.random() > 0.3 ? (Math.random() > 0.6 ? 3 : 2) : 1;
    return `<span style="width:${w}px;height:${h}px"></span>`;
  }).join('');
}
// Call: renderBarcode(document.getElementById('receipt-barcode'))
// when analysis result is displayed
```

### Meal Type Buttons (on white bg)
```css
#screen-analysis .meal-opt {
  border: 1px solid #DDD;
  background: #FFF;
  color: #333;
}
#screen-analysis .meal-opt.selected {
  border-color: #E8703A;
  background: rgba(232,112,58,0.08);
  color: #E8703A;
}
```

### Save Button (on white bg)
```css
#screen-analysis .btn-primary {
  background: #1A1A1A;
  color: #FFF;
  box-shadow: none;
}
```

---

## Remotion: FireLoop Composition

### New File: `food-logger/remotion/src/FireLoop.tsx`

**Specs:**
- Composition ID: `FireLoop`
- Size: 200 × 320px
- Duration: 60 frames @ 30fps (2-second seamless loop)
- Output: `food-logger/public/fire-loop.mp4`

**Particle System:**
- 15 particles active at any frame, staggered across the 60-frame loop
- Each particle uses a seed derived from its index to randomize: start X offset (±25px from center 100px), horizontal sway amplitude (8–20px), rise speed, size
- Origin Y: 290px. Destination Y: ~20px
- Color interpolation by normalized height progress:
  - 0%: `#FF2200` (deep red)
  - 40%: `#FF6600` (orange)
  - 70%: `#FFB300` (amber)
  - 100%: transparent
- Radius: `interpolate(progress, [0,1], [8, 1])`
- Opacity: `interpolate(progress, [0, 0.1, 0.7, 1], [0, 1, 0.8, 0])`
- Background: solid `#000000`

**Root.tsx:** Add FireLoop alongside existing compositions:
```tsx
import { FireLoop } from './FireLoop';
// ...
<Composition id="FireLoop" component={FireLoop}
  durationInFrames={60} fps={30} width={200} height={320} />
```

**Render:**
```bash
cd food-logger/remotion
npx remotion render FireLoop ../public/fire-loop.mp4
```

---

## Files Changed

| File | Change |
|------|--------|
| `food-logger/public/index.html` | All CSS + HTML + JS changes above |
| `food-logger/remotion/src/FireLoop.tsx` | New component |
| `food-logger/remotion/src/Root.tsx` | Register FireLoop |
| `food-logger/public/fire-loop.mp4` | Rendered output (after render step) |

## Files NOT Changed
- `food-logger/server.js`
- `food-logger/public/ambient-steam.mp4` (stays on disk)
- `food-logger/public/salad-logo.mp4`
