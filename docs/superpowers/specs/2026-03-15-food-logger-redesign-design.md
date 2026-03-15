# Food Logger — Redesign Spec
**Date**: 2026-03-15
**Approach**: Culinary Journal
**Status**: Approved

---

## Overview

Redesign `food-logger/public/index.html` to feel like a **personal chef's journal** — not a generic app. The current design is functional but reads as "AI-generated UI". The goal is to break visual predictability while preserving the existing color palette and Hebrew RTL layout.

**What stays**: color palette, fonts, PWA structure, all functionality
**What changes**: layout system, border radius variety, dividers, data visualizations, animations, icons

---

## 1. Visual Language

### Typography System

| Role | Font | Weight | Size range | Notes |
|------|------|--------|------------|-------|
| Hero numbers | Fraunces | 300 italic | 72–96px | Tilted 2deg, feels hand-written |
| Section headings | Fraunces | 600 | 24–32px | Normal, sharp |
| Body / labels | DM Sans | 400–500 | 12–16px | Clean, readable |
| Timestamps / data | IBM Plex Mono | 400 | 10–13px | All nutritional numbers, times |

**Key principle**: Size contrast is the main hierarchy tool. Giant Fraunces number next to tiny mono label.

### Border Radius — Breaking Uniformity

Remove the current flat `18px` everywhere. Use:

```css
--radius-sharp:  4px;   /* Main cards — feels like paper */
--radius-pill:   99px;  /* Buttons, tags */
--radius-input:  8px;   /* Form inputs */
--radius-badge:  3px;   /* Macro badges */
```

### Dividers

Replace `border-bottom: 1px solid var(--border)` section dividers with SVG wavy paths:

```svg
<path d="M0,4 Q120,0 240,4 Q360,8 480,4" stroke="var(--border)" fill="none" stroke-width="1"/>
```

Use between major sections (hero → macros, macros → log entries). Straight borders remain for table rows and small separators.

### Icons

Replace all emoji icons in navigation and UI with hand-drawn-style SVG icons:
- Stroke width: 1.5px
- Style: outline only (no fill)
- Size: 20px viewBox, rendered at 22px
- Consistent corner radius: 2px on paths

Icons needed: home, camera, stats, weight, settings, plus, trash, check, chevron

### Color Palette (unchanged)

```css
--bg:          #0d0b09;
--surface:     #161310;
--surface2:    #201d18;
--surface3:    #2a2620;
--border:      #2e2920;
--text:        #f0e8dc;
--text2:       #c0b8ac;
--muted:       #7a6e62;
--accent:      #e8703a;
--accent-dim:  rgba(232,112,58,0.15);
--accent-glow: rgba(232,112,58,0.28);
--gold:        #c4a265;
--protein:     #5eead4;
--carb:        #93c5fd;
--fat:         #fca5a5;
--fiber:       #c4b5fd;
```

---

## 2. Animation System

**Principle**: Every animation must express cause-and-effect. No decorative motion.

### Global tokens

```css
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--dur-fast:    150ms;
--dur-mid:     250ms;
--dur-slow:    400ms;
```

### Rules

- Screen transitions: `translateY(12px) → 0` + `opacity 0 → 1`, 250ms ease-out
- Staggered list items: 50ms delay per item, max 5 items animated (rest appear instantly)
- Button press: `scale(0.97)` on active, restored on release — 150ms
- Exit animations: 60% of enter duration
- All animations respect `prefers-reduced-motion: reduce`

---

## 3. Dashboard Screen

**Concept**: First page of a personal cookbook.

### Hero (calories)
```
[greeting, Fraunces 300 italic, muted]
━━━━━━━━━━━━━━━━━━━ (SVG wavy divider)

        1,240
        ───────── קלוריות נשארו
         מתוך 2,000
```

- `1,240`: Fraunces 96px, italic, `transform: rotate(-1.5deg)`, color `--text`
- "קלוריות נשארו": DM Sans 12px, uppercase, letter-spacing 2px, `--muted`
- "מתוך 2,000": IBM Plex Mono 12px, `--text2`

**Progress visualization**: Not a bar. An organic ring (SVG circle with `stroke-dashoffset` animation, 0.7s ease-out on mount). When over goal: ring turns `#e85d5d`.

### Macros — "The Plate"

Single SVG (~200px) showing 4 organic arc segments arranged as a circle (plate). Each arc = one macro, colored with the macro token. Arcs have slight gaps between them (4px). On hover/tap: tooltip with `name: Xgr / Yg target`.

No labels inside the SVG — a small legend below in 2-column grid, IBM Plex Mono 11px.

### Streak line

Single line, not a card:
```
12 ימים ברצף  ·  השבוע 14,230 קק״ל  ·  ממוצע 2,033
```
IBM Plex Mono 11px, `--muted`, centered, with `·` separators.

### Log preview (last 3 entries)

Each entry — asymmetric row, NOT a card:
```
[timestamp mono, --muted]  [food name, DM Sans 500]      [kcal, Fraunces 300]
                            [P xx · C xx · F xx, mono sm]
```

Separated by a single thin line (1px, `--border`). No background, no shadow, no border-radius.

CTA button "הוסף ארוחה" — full width pill, accent background, at the bottom.

---

## 4. Camera & Analysis Screens

### Camera

**Viewfinder corners**: 4 SVG corner markers (L-shaped, 20px, 1px stroke, accent color). Slow pulse animation (opacity 0.6 → 1, 2s infinite ease-in-out).

**Capture button**: 64px circle, double border (inner solid, outer dashed rotating 10s linear infinite). Press: `scale(0.92)` + brief glow.

**Text input**: Characters appear letter-by-letter on input with 15ms per-character fade-in (JS `setInterval` driven).

### Analysis results

Layout styled as a printed receipt / docket:

```
── ניתוח ─────────────────────── 14:22 ──

  [food name, Fraunces 500, 22px]
  ──────────────────────────────────────
  קלוריות          [n] קק״ל      mono
  חלבון            [n] גר׳       mono
  פחמימות          [n] גר׳       mono
  שומן             [n] גר׳       mono
  ──────────────────────────────────────
  אמינות   [●●●○○ dots]  [label]

[ + הוסף ליומן ]        [ ✕ ביטול ]
```

Each row enters from bottom with 60ms stagger delay — simulates printing. Dashes are `<hr>` styled with `border-style: dashed`.

---

## 5. Stats Screen

**Concept**: Field notebook data page.

### Weekly view

Dots + connected SVG line (not a bar chart):
```
א  ב  ג  ד  ה  ו  ש
●  ●  ●  ●  ·  ·  ·
```
- Logged days: `●` in `--accent`
- Missing days: `·` in `--muted`
- SVG polyline connecting logged dots, drawn with `stroke-dashoffset` animation on mount
- Average line: horizontal dashed SVG line in `--gold`

### Monthly/Yearly views

Heatmap grid (7-column weeks × N rows). Each cell: 8px square, color-coded by calorie intake relative to goal. No axes — dates as tooltip on tap.

---

## 6. Remotion — New Asset

New composition: `AmbientSteam` — a 4-second seamless loop of 3 rising steam wisps (SVG paths animating upward with slight sway). Rendered at 400×300 at 30fps to `public/ambient-steam.mp4`.

Embedded in dashboard hero as `<video autoplay muted loop playsinline>` with `opacity: 0.05`, positioned absolutely behind the calorie number. Creates depth without distraction.

---

## 7. Screens Not Redesigned

- Auth / Welcome: Minor polish only (apply new border radius, wavy dividers)
- Weight log: Apply new typography system only
- Settings: Apply new typography system only

Focus of implementation is: Dashboard, Camera, Analysis, Stats.

---

## 8. Implementation Notes

- All changes are confined to `food-logger/public/index.html` (CSS + HTML + JS inline)
- Remotion changes in `food-logger/remotion/src/` (new `AmbientSteam.tsx` composition)
- No new dependencies — SVG animations are CSS-only
- The "receipt" animation in Analysis uses `requestAnimationFrame` / `setTimeout` in existing JS
- RTL layout must be verified on all modified screens
- `prefers-reduced-motion` media query must wrap all entrance animations

---

## Success Criteria

1. Dashboard calorie number feels like editorial typography, not a widget
2. The macro "plate" is immediately readable and feels custom-made
3. Analysis results feel tactile — like a receipt printing
4. Stats sparkline feels hand-drawn, not charted
5. No screen looks like it came from a UI kit
