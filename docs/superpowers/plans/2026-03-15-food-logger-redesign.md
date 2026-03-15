# Food Logger — Culinary Journal Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `food-logger/public/index.html` with a "Culinary Journal" aesthetic — typographic hero numbers, organic SVG elements, receipt-style analysis, and refined animations — without touching any backend logic.

**Architecture:** All changes are confined to the single-file `food-logger/public/index.html` (inline CSS + JS), plus a new Remotion composition in `food-logger/remotion/src/`. The existing server, database, and API are untouched. JS rendering functions (`renderDonut`, `renderLineChart`) are updated in-place; all other JS logic is preserved.

**Tech Stack:** Vanilla HTML/CSS/JS, SVG animations, Fraunces + DM Sans + IBM Plex Mono (already loaded), Remotion 4.x (TypeScript/React)

**Spec:** `docs/superpowers/specs/2026-03-15-food-logger-redesign-design.md`

---

## How to verify each task

Start the server once at the beginning:
```bash
cd food-logger && npm run dev
# Open http://localhost:3000 in browser
```

No automated tests exist for the frontend. Each task specifies what to visually verify in the browser. Keep devtools open (F12) to catch console errors.

---

## Chunk 1: CSS Foundation

**Files:**
- Modify: `food-logger/public/index.html` — `:root` CSS variables block (lines ~19–38) and global styles

---

### Task 1: Replace border-radius tokens

**Files:**
- Modify: `food-logger/public/index.html:19-38` (`:root` block)

- [ ] **Step 1: Update CSS variables in `:root`**

Find the `:root` block (starts around line 19). Replace the `--radius` and `--radius-sm` variables and add new ones:

```css
/* REMOVE these two lines: */
--radius:     18px;
--radius-sm:  10px;

/* ADD these instead: */
--radius-sharp: 4px;
--radius-pill:  99px;
--radius-input: 8px;
```

Then do a global find-replace in the CSS section only:
- `var(--radius)` → `var(--radius-sharp)` (for cards)
- `var(--radius-sm)` → `var(--radius-input)` (for inputs)
- `border-radius: 99px` stays as-is (already pill-shaped elements)

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000. Log in, go to Dashboard, Home, Settings.
Expected: Cards have sharp 4px corners. Buttons and nav pill remain rounded. No layout breaks.

- [ ] **Step 3: Commit**

```bash
cd food-logger
git add public/index.html
git commit -m "style: replace uniform 18px radius with sharp card + pill system"
```

---

### Task 2: Add animation tokens and global animation rules

**Files:**
- Modify: `food-logger/public/index.html` — CSS section, after `:root` block

- [ ] **Step 1: Add CSS custom properties to `:root`**

Inside the existing `:root {}` block, add after the color variables:

```css
/* Animation system */
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--dur-fast:    150ms;
--dur-mid:     250ms;
--dur-slow:    400ms;
```

- [ ] **Step 2: Add reduced-motion global override**

After the `body` rule block, add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Replace existing screen transition with new token-based one**

First, search for any existing `.screen.active` CSS rule and **replace** it (not add alongside it) to avoid duplicate declarations:

```bash
grep -n "screen.active\|screenEnter\|fadeUp" food-logger/public/index.html
```

Delete any existing animation on `.screen.active`, then add:

```css
@keyframes screenEnter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.screen.active {
  animation: screenEnter var(--dur-mid) var(--ease-out) both;
}
```

- [ ] **Step 4: Verify in browser**

Navigate between screens (Dashboard → Home → Stats).
Expected: Screens slide up smoothly on entry. Enable "prefers-reduced-motion" in OS settings — animations should disappear.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "style: add animation token system and reduced-motion support"
```

---

### Task 3: SVG wavy divider component + SVG nav icons

**Files:**
- Modify: `food-logger/public/index.html` — CSS + HTML

- [ ] **Step 1: Add `.wavy-divider` CSS class**

```css
.wavy-divider {
  display: block;
  width: 100%;
  height: 8px;
  margin: 4px 0;
  overflow: visible;
}
.wavy-divider path {
  stroke: var(--border);
  fill: none;
  stroke-width: 0.5;
}
```

- [ ] **Step 2: Create the reusable wavy divider HTML snippet**

This SVG scales to any width via `viewBox` + `preserveAspectRatio="none"`. Use this markup wherever a section divider is needed:

```html
<svg class="wavy-divider" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0,4 Q25,1 50,4 Q75,7 100,4"/>
</svg>
```

**Note**: The dashboard (`#screen-dashboard`) wavy dividers are already included in Task 4's full HTML replacement — do NOT insert them here to avoid duplicates. This step is for other screens: insert one wavy divider in `#screen-auth` between the wordmark and the auth card, and one in `#screen-welcome` between the subtitle and the feature list.

- [ ] **Step 3: Replace emoji nav icons with SVG icons**

Find the bottom nav HTML (around line 1763, `<!-- BOTTOM NAV -->`). Replace each emoji in `.nav-item` spans with inline SVG. Use these exact SVGs (stroke 1.5px, outline style):

```html
<!-- Home icon -->
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
  <path d="M9 21V12h6v9"/>
</svg>

<!-- Camera icon -->
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>

<!-- Stats icon -->
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
</svg>

<!-- Weight icon -->
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 8v4l3 3"/>
</svg>

<!-- Settings icon -->
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
</svg>
```

Also replace the `＋` in the camera CTA nav button with:
```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
</svg>
```

- [ ] **Step 4: Verify in browser**

Check bottom nav on all screens. Expected: SVG icons visible, no emoji, active state still highlights in `--accent` color, nav pill shape preserved.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "style: SVG nav icons + wavy divider component"
```

---

## Chunk 2: Dashboard Screen Redesign

**Files:**
- Modify: `food-logger/public/index.html:1505-1540` (dashboard HTML) and corresponding CSS (lines ~214–333)

---

### Task 4: Hero calorie number — typographic treatment

**Files:**
- Modify: `food-logger/public/index.html` — dashboard HTML + CSS

- [ ] **Step 1: Restructure dashboard hero HTML**

Replace the contents of `<div id="screen-dashboard" class="screen">` (lines 1505–1540) with:

```html
<div id="screen-dashboard" class="screen">
  <div class="dash-wrap">

    <!-- Greeting -->
    <div class="dash-greeting-line">
      <span class="dash-greeting-text" id="dash-greeting">בוקר טוב</span>
      <video id="dash-logo-vid" class="dash-logo-vid" src="/salad-logo.mp4" muted playsinline autoplay loop></video>
    </div>

    <svg class="wavy-divider" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,4 Q25,1 50,4 Q75,7 100,4"/>
    </svg>

    <!-- Hero calorie number -->
    <div class="dash-hero-cal">
      <div class="dash-cal-remaining" id="dash-cal-remaining">—</div>
      <div class="dash-cal-label-row">
        <span class="dash-cal-label-main">קלוריות נשארו</span>
        <span class="dash-cal-label-sub" id="dash-cal-goal-label">מתוך —</span>
      </div>
      <!-- Calorie ring SVG — rendered by JS -->
      <div class="dash-ring-wrap" id="dash-ring-wrap"></div>
    </div>

    <!-- Macro plate -->
    <div class="dash-plate-wrap">
      <svg id="dash-plate-svg" width="200" height="200" viewBox="0 0 200 200"></svg>
      <div class="dash-plate-tooltip" id="dash-plate-tooltip" style="display:none"></div>
      <div class="dash-plate-legend" id="dash-plate-legend"></div>
    </div>

    <svg class="wavy-divider" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,4 Q25,1 50,4 Q75,7 100,4"/>
    </svg>

    <!-- Streak line -->
    <div class="dash-streak-line" id="dash-streak-line">טוען...</div>

    <!-- Log preview -->
    <div class="dash-log-preview" id="dash-log-preview"></div>

    <!-- CTAs -->
    <div class="dash-username" id="dash-username"></div>
    <button class="btn btn-primary dash-cta" onclick="navigate('camera')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="vertical-align:middle;margin-left:6px">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      הוסף ארוחה
    </button>
    <button class="btn btn-ghost dash-cta-ghost" onclick="navigate('home')">יומן היום</button>
  </div>
</div>
```

- [ ] **Step 2: Add CSS for new dashboard elements**

Replace the old `.dash-*` CSS rules (lines ~214–333) with:

```css
.dash-wrap {
  padding: 40px 20px 120px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dash-greeting-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dash-greeting-text {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 300;
  font-size: 22px;
  color: var(--muted);
}

.dash-logo-vid {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sharp);
  display: block;
}

/* Hero calorie number */
.dash-hero-cal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

.dash-cal-remaining {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 300;
  font-size: clamp(72px, 22vw, 96px);
  color: var(--text);
  line-height: 1;
  transform: rotate(-1.5deg);
  transform-origin: center;
  font-variant-numeric: tabular-nums;
  letter-spacing: -4px;
}

.dash-cal-label-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.dash-cal-label-main {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--muted);
}

.dash-cal-label-sub {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: var(--text2);
}

/* Calorie ring */
.dash-ring-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.dash-ring-wrap svg {
  transform: rotate(-90deg);
}

/* Macro plate */
.dash-plate-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.dash-plate-tooltip {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: var(--text2);
  text-align: center;
  min-height: 18px;
}

.dash-plate-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 20px;
  width: 100%;
  max-width: 240px;
}

.plate-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--text2);
}

.plate-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Streak line */
.dash-streak-line {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  line-height: 1.6;
}

/* Log preview rows */
.dash-log-preview {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.dash-log-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}

.dash-log-row:last-child { border-bottom: none; }

.dash-log-time {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  grid-row: 1;
  grid-column: 1;
  padding-top: 2px;
}

.dash-log-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  grid-row: 1;
  grid-column: 2;
}

.dash-log-kcal {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 300;
  font-size: 20px;
  color: var(--text);
  grid-row: 1;
  grid-column: 3;
  line-height: 1;
}

.dash-log-macros {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--text2);
  grid-row: 2;
  grid-column: 2 / 4;
  margin-top: 2px;
}

.dash-cta { margin-top: 4px; border-radius: var(--radius-pill); }
.dash-cta-ghost { width: 100%; margin-top: 2px; border-radius: var(--radius-pill); }
```

- [ ] **Step 3: Verify layout in browser**

Log in. Go to Dashboard. Expected: Greeting in italic muted text, wavy line below, large calorie number slightly rotated, legend grid below plate area, streak as single text line, entry rows with asymmetric grid layout.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: dashboard hero layout — typographic calorie number, asymmetric log rows"
```

---

### Task 5: Calorie ring + JS wiring for dashboard

**Files:**
- Modify: `food-logger/public/index.html` — JS section, function `updateDashboard()` or equivalent

- [ ] **Step 1: Find the JS function that updates the dashboard**

Search for `loadDashboard` in the JS section (at line ~2272). This `async function loadDashboard()` fetches today's food entries and the streak, then updates the DOM.

- [ ] **Step 2: Replace calorie bar logic with ring renderer**

Add this function before or after `updateDashboard`:

```js
function renderCalRing(eaten, goal) {
  const el = document.getElementById('dash-ring-wrap');
  if (!el) return;
  const R = 48, CX = 56, CY = 56, SW = 6;
  const circ = 2 * Math.PI * R;
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const over = goal > 0 && eaten > goal;
  const fillColor = over ? '#e85d5d' : 'var(--accent)';
  el.innerHTML = `
    <svg width="112" height="112" viewBox="0 0 112 112" style="transform:rotate(-90deg)">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="${SW}"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${fillColor}" stroke-width="${SW}"
        stroke-linecap="round"
        stroke-dasharray="${circ}"
        stroke-dashoffset="${circ}"
        id="cal-ring-fill"
        style="transition: stroke-dashoffset 0.7s var(--ease-out, cubic-bezier(0.22,1,0.36,1))"/>
    </svg>`;
  // Animate after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ring = document.getElementById('cal-ring-fill');
      if (ring) ring.style.strokeDashoffset = circ * (1 - pct);
    });
  });
}
```

- [ ] **Step 3: Update the dashboard data wiring**

In `loadDashboard()` (line ~2272), make these changes:

**In the food entries `try` block** (after computing `cal`, `pro`, `carb`, `fat`):
1. Add `fiber` to the reduce: `fiber: s.fiber + (+e.fiber_g || 0)`
2. Set `document.getElementById('dash-cal-remaining').textContent = goal > 0 ? Math.max(0, goal - cal).toLocaleString('he-IL') : '—'`
3. Set `document.getElementById('dash-cal-goal-label').textContent = goal > 0 ? 'מתוך ' + goal.toLocaleString('he-IL') : ''`
4. Call `renderCalRing(cal, goal)`
5. Call `renderPlate('dash-plate-svg', 'dash-plate-legend', 'dash-plate-tooltip', { pro, carb, fat, fiber })`
6. Call `renderDashLogPreview(entries)`

**In the streak `try` block** (after fetching `/api/streak`):
- Set `document.getElementById('dash-streak-line').textContent = streak + ' ימים ברצף'`
  (Keep it simple — just streak count. Weekly total/avg are available on the Stats screen.)

Also wire up `dash-log-preview`: take the last 3 entries from today's food logs and render them as `.dash-log-row` elements. Example renderer:

```js
function renderDashLogPreview(entries) {
  const el = document.getElementById('dash-log-preview');
  if (!el) return;
  const last3 = entries.slice(-3).reverse();
  if (!last3.length) { el.innerHTML = ''; return; }
  el.innerHTML = last3.map(e => {
    const t = e.logged_at ? e.logged_at.slice(11, 16) : '';
    return `<div class="dash-log-row">
      <div class="dash-log-time">${t}</div>
      <div class="dash-log-name">${e.food_name || ''}</div>
      <div class="dash-log-kcal">${Math.round(e.calories || 0)}</div>
      <div class="dash-log-macros">ח ${Math.round(e.protein_g||0)} · פ ${Math.round(e.carbs_g||0)} · ש ${Math.round(e.fat_g||0)}</div>
    </div>`;
  }).join('');
}
```

- [ ] **Step 4: Verify in browser**

Expected: Ring animates from 0 to correct fill on Dashboard load. If over goal, ring is red. Streak line shows three stats separated by `·`. Log preview shows last 3 meals in asymmetric rows.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: dashboard calorie ring animation + JS data wiring"
```

---

## Chunk 3: Macro Plate (replaces renderDonut)

**Files:**
- Modify: `food-logger/public/index.html` — JS `renderDonut()` function (line ~2916) + CSS

---

### Task 6: Replace renderDonut with renderPlate

- [ ] **Step 1: Add `renderPlate()` function**

Find `renderDonut()` at line ~2916. Add a new function `renderPlate()` directly above it:

```js
function renderPlate(svgId, legendId, tooltipId, totals) {
  const macros = [
    { key: 'pro',   label: 'חלבון',   color: '#5eead4', grams: Math.round(totals.pro   || 0), target: (window.userProfile?.protein_g  || 0) },
    { key: 'carb',  label: 'פחמימות', color: '#93c5fd', grams: Math.round(totals.carb  || 0), target: (window.userProfile?.carbs_g    || 0) },
    { key: 'fat',   label: 'שומן',    color: '#fca5a5', grams: Math.round(totals.fat   || 0), target: (window.userProfile?.fat_g      || 0) },
    { key: 'fiber', label: 'סיבים',   color: '#c4b5fd', grams: Math.round(totals.fiber || 0), target: (window.userProfile?.fiber_g    || 0) },
  ];

  const totalGrams = macros.reduce((s, m) => s + m.grams, 0) || 1;
  const CX = 100, CY = 100, R = 72, GAP_DEG = 3;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function degToRad(d) { return d * Math.PI / 180; }
  function arcPath(startDeg, sweepDeg, cx, cy, r) {
    if (sweepDeg <= 0) return null;
    const s = degToRad(startDeg);
    const e = degToRad(startDeg + sweepDeg);
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  const svgEl = document.getElementById(svgId);
  if (!svgEl) return;
  svgEl.innerHTML = '';

  // Background ring
  const bg = document.createElementNS(SVG_NS, 'circle');
  bg.setAttribute('cx', CX); bg.setAttribute('cy', CY); bg.setAttribute('r', R);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--surface2)'); bg.setAttribute('stroke-width', '20');
  svgEl.appendChild(bg);

  let currentDeg = -90;
  macros.forEach((m, i) => {
    const pct = m.grams / totalGrams;
    const sweepDeg = pct * 360 - GAP_DEG;
    if (sweepDeg <= 0) { currentDeg += pct * 360; return; }

    const d = arcPath(currentDeg, sweepDeg, CX, CY, R);
    if (!d) { currentDeg += pct * 360; return; }

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', m.color);
    path.setAttribute('stroke-width', '20');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('data-macro', i);
    path.setAttribute('data-label', `${m.label}: ${m.grams}גר׳${m.target ? ' / ' + m.target + 'גר׳' : ''}`);
    path.style.cursor = 'pointer';

    // Tap/click handler — inline tooltip
    path.addEventListener('click', (e) => {
      const tip = document.getElementById(tooltipId);
      if (!tip) return;
      const active = path.getAttribute('data-active') === '1';
      // Clear all
      svgEl.querySelectorAll('[data-macro]').forEach(p => p.removeAttribute('data-active'));
      if (active) { tip.style.display = 'none'; return; }
      path.setAttribute('data-active', '1');
      tip.textContent = path.getAttribute('data-label');
      tip.style.display = 'block';
    });

    svgEl.appendChild(path);
    currentDeg += pct * 360;
  });

  // Close click-outside
  svgEl.addEventListener('click', (e) => {
    if (!e.target.hasAttribute('data-macro')) {
      const tip = document.getElementById(tooltipId);
      if (tip) tip.style.display = 'none';
      svgEl.querySelectorAll('[data-macro]').forEach(p => p.removeAttribute('data-active'));
    }
  });

  // Legend
  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = macros.map(m => `
      <div class="plate-legend-item">
        <div class="plate-legend-dot" style="background:${m.color}"></div>
        <span>${m.label} ${m.grams}גר׳</span>
      </div>`).join('');
  }
}
```

- [ ] **Step 2: Update callers and add dashboard plate call**

`renderDonut` is called in **exactly one place**: line 2449 inside `renderDailySummary()`:
```js
renderDonut('macro-donut', 'macro-legend', totals);
```
Replace this single call with:
```js
renderPlate('macro-donut', 'macro-legend', 'macro-plate-tooltip', totals);
```

The dashboard plate (`dash-plate-svg`) is a **new call** — it does NOT currently exist. It is added in Task 5 Step 3 when wiring `loadDashboard()`. Do not add it here.

After replacing the call, delete the now-unused `renderDonut()` function and its helper `donutSVGPaths()` to avoid dead code (both can be found by searching `function renderDonut` and `function donutSVGPaths`).

**Note on fiber target in `renderPlate`**: `userProfile` does not expose a `fiber_g` target. Replace `window.userProfile?.fiber_g` with the hardcoded default `25` (matching the existing pattern in `renderMacroProgressBars` at line ~2957).

- [ ] **Step 3: Update the Home screen HTML to add a tooltip div**

Find `#macro-donut-wrap` in `screen-home` (line ~1579). Add a tooltip div after the SVG:

```html
<div id="macro-plate-tooltip" class="dash-plate-tooltip" style="display:none;margin-top:4px"></div>
```

- [ ] **Step 4: Edge case verification**

In the browser: log in with no food entries today. Expected: plate shows background ring only (all arcs omitted since 0g). Add one item with only protein — expected: single arc fills nearly the full ring.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: replace renderDonut with renderPlate — 4-macro arc SVG with tap tooltips"
```

---

## Chunk 4: Camera & Analysis Screens

**Files:**
- Modify: `food-logger/public/index.html:1592-1649`

---

### Task 7: Camera screen — viewfinder corners + capture button

- [ ] **Step 1: Replace `.cam-corners` CSS and HTML**

Find `.cam-corners` in CSS and the corresponding `<div class="cam-corners">` in HTML.

Replace CSS:
```css
.cam-corners {
  position: absolute;
  inset: 12px;
  pointer-events: none;
  z-index: 2;
}
.cam-corner {
  position: absolute;
  width: 20px;
  height: 20px;
}
.cam-corner path {
  stroke: var(--accent);
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  animation: cornerPulse 2s ease-in-out infinite;
}
.cam-corner:nth-child(1) { top: 0; right: 0; }        /* RTL: top-right = start */
.cam-corner:nth-child(2) { top: 0; left: 0; }
.cam-corner:nth-child(3) { bottom: 0; right: 0; }
.cam-corner:nth-child(4) { bottom: 0; left: 0; }
@keyframes cornerPulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
```

Replace HTML `<div class="cam-corners"></div>` with:
```html
<div class="cam-corners">
  <!-- top-right (RTL start) -->
  <svg class="cam-corner" viewBox="0 0 20 20"><path d="M18 2 H10 M18 2 V10"/></svg>
  <!-- top-left -->
  <svg class="cam-corner" viewBox="0 0 20 20"><path d="M2 2 H10 M2 2 V10"/></svg>
  <!-- bottom-right -->
  <svg class="cam-corner" viewBox="0 0 20 20"><path d="M18 18 H10 M18 18 V10"/></svg>
  <!-- bottom-left -->
  <svg class="cam-corner" viewBox="0 0 20 20"><path d="M2 18 H10 M2 18 V10"/></svg>
</div>
```

- [ ] **Step 2: Style the capture button with double border + rotation**

Find `.cam-btn-shoot` CSS. Replace/extend:

```css
.cam-btn-shoot {
  position: relative;
  width: 64px !important;
  height: 64px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  background: var(--surface2) !important;
  border: 2px solid var(--accent) !important;
  box-shadow: 0 0 0 6px var(--surface), 0 0 0 7px transparent;
  flex-shrink: 0;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast);
  font-size: 24px;
}
.cam-btn-shoot::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px dashed rgba(232,112,58,0.4);
  animation: outerRingRotate 10s linear infinite;
}
.cam-btn-shoot:active {
  transform: scale(0.92);
  box-shadow: 0 0 0 6px var(--surface), 0 0 20px var(--accent-glow);
}
@keyframes outerRingRotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Placeholder animation — Hebrew-safe**

Find the `<textarea id="food-text-input" ...>` element. Add `data-placeholder` attribute with the full placeholder text, and clear the `placeholder` attribute:

```html
<textarea id="food-text-input"
  placeholder=""
  data-placeholder="לדוגמה: 100 גרם חזה עוף עם כוס אורז וסלט ירקות"></textarea>
```

Add this JS function and call it when the camera screen activates:

```js
function animatePlaceholder() {
  const ta = document.getElementById('food-text-input');
  if (!ta) return;
  const full = ta.getAttribute('data-placeholder') || '';
  ta.placeholder = '';
  let i = 0;
  const iv = setInterval(() => {
    if (i >= full.length) { clearInterval(iv); return; }
    ta.placeholder = full.slice(0, ++i);
  }, 15);
}
```

In the `navigate('camera')` function (or wherever `screen-camera` is shown), call `animatePlaceholder()` after the screen switch.

- [ ] **Step 4: Verify in browser**

Navigate to Camera. Expected: 4 L-shaped corners pulse around the preview area. Camera capture button has rotating dashed outer ring. Navigating to camera triggers the placeholder typing animation.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: camera screen — SVG corner markers, double-border capture btn, placeholder animation"
```

---

### Task 8: Analysis receipt layout

**Files:**
- Modify: `food-logger/public/index.html:1614-1649` (analysis screen HTML + CSS)

- [ ] **Step 1: Wrap analysis result in receipt container**

Find `<div id="analysis-result" style="display:none">` (line ~1626). Replace its inner content (keep the outer div and its `style` attribute intact — JS toggles `display`):

```html
<div id="analysis-result" style="display:none">
  <div class="receipt" id="receipt-body">

    <div class="receipt-header">
      <span class="receipt-title">── ניתוח ─</span>
      <span class="receipt-time" id="receipt-time"></span>
    </div>

    <div class="receipt-row receipt-name-row">
      <input id="res-name" type="text" class="receipt-name-input" placeholder="שם האוכל">
    </div>

    <hr class="receipt-hr">

    <div class="receipt-row receipt-entry"><label class="receipt-lbl">קלוריות</label><input id="res-cal" type="number" class="receipt-val"><span class="receipt-unit">קק״ל</span></div>
    <div class="receipt-row receipt-entry"><label class="receipt-lbl">חלבון</label><input id="res-pro" type="number" step="0.1" class="receipt-val"><span class="receipt-unit">גר׳</span></div>
    <div class="receipt-row receipt-entry"><label class="receipt-lbl">פחמימות</label><input id="res-carb" type="number" step="0.1" class="receipt-val"><span class="receipt-unit">גר׳</span></div>
    <div class="receipt-row receipt-entry"><label class="receipt-lbl">שומן</label><input id="res-fat" type="number" step="0.1" class="receipt-val"><span class="receipt-unit">גר׳</span></div>
    <div class="receipt-row receipt-entry"><label class="receipt-lbl">סיבים</label><input id="res-fiber" type="number" step="0.1" class="receipt-val"><span class="receipt-unit">גר׳</span></div>

    <hr class="receipt-hr">

    <div class="receipt-row">
      <span class="receipt-lbl">אמינות</span>
      <span id="res-confidence" class="receipt-confidence"></span>
    </div>

  </div><!-- /receipt -->

  <div class="card-title" style="margin-top:14px">סוג ארוחה</div>
  <div class="meal-select">
    <button class="meal-opt" data-meal="breakfast" onclick="selectMeal(this)">בוקר</button>
    <button class="meal-opt selected" data-meal="lunch" onclick="selectMeal(this)">צהריים</button>
    <button class="meal-opt" data-meal="dinner" onclick="selectMeal(this)">ערב</button>
    <button class="meal-opt" data-meal="snack" onclick="selectMeal(this)">חטיף</button>
  </div>

  <button class="btn btn-primary" id="save-entry-btn" onclick="saveEntry()" style="margin-top:4px">שמור ביומן</button>
</div>
```

**Critical**: All 6 input IDs must be preserved exactly: `res-name`, `res-cal`, `res-pro`, `res-carb`, `res-fat`, `res-fiber`. The `saveEntry()` function (line ~2560) reads all 6 of these IDs. Removing any one will silently zero-out that nutrient on save.

**Also critical**: The `<div id="analysis-error" class="error-msg">` element is located **outside** `#analysis-result` (at line ~1647, after the closing `</div>` of `#analysis-result`). This replacement only touches the inner content of `#analysis-result` — `#analysis-error` is unaffected and must remain in place.

- [ ] **Step 2: Add receipt CSS**

```css
.receipt {
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sharp);
  padding: 20px;
  font-family: 'IBM Plex Mono', monospace;
  overflow: hidden;
}

.receipt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 1px;
}

.receipt-hr {
  border: none;
  border-top: 1px dashed var(--border);
  margin: 10px 0;
}

.receipt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.receipt-name-row { margin-bottom: 4px; }

.receipt-name-input {
  font-family: 'Fraunces', serif !important;
  font-weight: 500 !important;
  font-size: 22px !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid transparent !important;
  color: var(--text) !important;
  padding: 0 !important;
  width: 100%;
}
.receipt-name-input:focus {
  border-bottom-color: var(--border) !important;
  outline: none !important;
  box-shadow: none !important;
}

.receipt-lbl {
  font-size: 12px;
  color: var(--text2);
  flex: 1;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  margin-bottom: 0;
}

.receipt-val {
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 13px !important;
  text-align: left;
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid transparent !important;
  width: 64px;
  color: var(--text) !important;
  padding: 2px 0 !important;
}
.receipt-val:focus {
  border-bottom-color: var(--border) !important;
  outline: none !important;
  box-shadow: none !important;
}

.receipt-unit {
  font-size: 11px;
  color: var(--muted);
  width: 28px;
  text-align: left;
}

.receipt-confidence {
  font-size: 12px;
  color: var(--text2);
}

/* Stagger animation */
@keyframes receiptRow {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.receipt-entry {
  opacity: 0;
  animation: receiptRow var(--dur-mid) var(--ease-out) both;
}
.receipt-entry:nth-child(1) { animation-delay: 80ms; }
.receipt-entry:nth-child(2) { animation-delay: 140ms; }
.receipt-entry:nth-child(3) { animation-delay: 200ms; }
.receipt-entry:nth-child(4) { animation-delay: 260ms; }
.receipt-entry:nth-child(5) { animation-delay: 320ms; }
```

Note: The `.receipt-entry` stagger animation applies when the rows enter the DOM. The JS that shows `#analysis-result` (sets `display:block`) triggers the CSS animation automatically. No JS animation code needed.

- [ ] **Step 3: Set receipt-time in JS**

Find where `analysis-result` is shown (search for `analysis-result` in JS, around `style.display = ''`). Before showing it, add:
```js
const now = new Date();
const hhmm = now.toTimeString().slice(0, 5);
const rtEl = document.getElementById('receipt-time');
if (rtEl) rtEl.textContent = hhmm;
// Re-trigger animation by forcing reflow
const rb = document.getElementById('receipt-body');
if (rb) { rb.querySelectorAll('.receipt-entry').forEach(r => { r.style.animation = 'none'; r.offsetHeight; r.style.animation = ''; }); }
```

- [ ] **Step 4: Verify**

Run analysis on a food item. Expected: result appears as a receipt card. Each of the 5 nutrient rows (calories, protein, carbs, fat, fiber) fades in with stagger. Food name is editable in Fraunces font. Save button still works — save an entry and verify it appears in the diary with correct fiber value (not 0). Error handling: disconnect wifi and run analysis — expected: error message appears in `#analysis-error` below the receipt (not inside it).

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: analysis screen — receipt layout with staggered row animation"
```

---

## Chunk 5: Stats Screen + Home Screen Polish

**Files:**
- Modify: `food-logger/public/index.html` — `renderLineChart()` (line ~2694) + home screen HTML/CSS

---

### Task 9: Refine renderLineChart

- [ ] **Step 1: Update `renderLineChart` function**

Replace the function body at line ~2694 with this enhanced version. Key changes: remove area gradient fill, add day-letter column headers for weekly view, change dot style for missing/zero days, add gold average line, add stroke-dashoffset draw-on animation:

```js
function renderLineChart(rows, { getValue, getLabel, isToday, recommended, dayLetters }) {
  const W = 320, H = 150, BOTTOM = 28, TOP = 16, LEFT = 8, RIGHT = 14;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - BOTTOM - TOP;
  const n = rows.length;
  const values = rows.map(getValue);
  const maxVal = Math.max(...values, recommended || 0, 1);
  const range = maxVal || 1;

  const pts = rows.map((r, i) => {
    const x = n === 1 ? W / 2 : LEFT + (i / (n - 1)) * chartW;
    const y = TOP + chartH - (getValue(r) / range) * chartH;
    const hasData = getValue(r) > 0;
    return { x, y, r, hasData };
  });

  // Polyline only for points that have data
  const dataPoints = pts.filter(p => p.hasData);
  const polyline = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Estimated total path length for dashoffset animation
  let pathLen = 0;
  for (let i = 1; i < dataPoints.length; i++) {
    const dx = dataPoints[i].x - dataPoints[i-1].x;
    const dy = dataPoints[i].y - dataPoints[i-1].y;
    pathLen += Math.sqrt(dx*dx + dy*dy);
  }

  const dots = pts.map(p => {
    const isT = isToday(p.r);
    if (p.hasData) {
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isT ? 4.5 : 3.5}"
        fill="${isT ? 'var(--accent)' : 'rgba(232,112,58,0.8)'}" stroke="var(--bg)" stroke-width="1.5"/>`;
    } else {
      return `<circle cx="${p.x.toFixed(1)}" cy="${(TOP + chartH).toFixed(1)}" r="2"
        fill="var(--muted)" opacity="0.5"/>`;
    }
  }).join('');

  // Labels: prefer dayLetters if provided, else getLabel
  const step = n <= 10 ? 1 : n <= 20 ? 2 : 5;
  const labels = pts.map((p, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const isT = isToday(p.r);
    const lbl = (dayLetters && dayLetters[i]) ? dayLetters[i] : getLabel(p.r);
    return `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle"
      font-size="9" fill="${isT ? 'var(--accent)' : 'var(--muted)'}"
      font-family="IBM Plex Mono,monospace">${lbl}</text>`;
  }).join('');

  let recLine = '';
  if (recommended > 0) {
    const ry = TOP + chartH - (recommended / range) * chartH;
    const labelY = ry < TOP + 12 ? ry + 10 : ry - 3;
    recLine = `<line x1="${LEFT}" y1="${ry.toFixed(1)}" x2="${W - RIGHT}" y2="${ry.toFixed(1)}"
      stroke="var(--gold)" stroke-dasharray="4,3" opacity="0.7" stroke-width="1"/>
      <text x="${W - RIGHT - 2}" y="${labelY.toFixed(1)}" text-anchor="end"
      font-size="8" fill="var(--gold)" opacity="0.9" font-family="IBM Plex Mono,monospace">${recommended}</text>`;
  }

  const polylineId = 'lc-' + Math.random().toString(36).slice(2, 7);

  return `<svg viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">
    ${recLine}
    ${dataPoints.length > 1 ? `<polyline id="${polylineId}" points="${polyline}" fill="none"
      stroke="rgba(232,112,58,0.7)" stroke-width="1.8"
      stroke-linejoin="round" stroke-linecap="round"
      stroke-dasharray="${pathLen.toFixed(0)}"
      stroke-dashoffset="${pathLen.toFixed(0)}"
      style="transition: stroke-dashoffset 0.6s var(--ease-out, cubic-bezier(0.22,1,0.36,1))"/>` : ''}
    ${dots}
    ${labels}
    <script>
      (function(){
        var el = document.getElementById('${polylineId}');
        if (!el) return;
        requestAnimationFrame(function(){ requestAnimationFrame(function(){
          el.style.strokeDashoffset = '0';
        }); });
      })();
    </script>
  </svg>`;
}
```

- [ ] **Step 2: Pass Hebrew day letters for weekly view**

In `loadWeeklyStats()` (line ~2646), update the `renderLineChart` call to pass `dayLetters`:

```js
const hebrewDays = ['א','ב','ג','ד','ה','ו','ש'];
chartEl.innerHTML = renderLineChart(chartDays, {
  getValue: r => +r.calories || 0,
  getLabel: r => formatDateShort(r.day.slice(0, 10)),
  isToday: r => r.day.slice(0, 10) === todayDs,
  recommended: rec,
  dayLetters: chartDays.map(r => {
    const d = new Date(r.day);
    return hebrewDays[d.getDay()];
  }),
});
```

- [ ] **Step 3: Verify in browser**

Go to Stats → Weekly. Expected: Hebrew day letters (א–ש) as column headers. Dots only on days with data; muted small dots at bottom for missing days. Gold dashed average line. Polyline draws in from left on mount. No area gradient fill.

- [ ] **Step 3b: Verify monthly and yearly charts still work**

Click Stats → Monthly, then Stats → Yearly. Expected: both charts render without console errors. The new `renderLineChart` signature passes `dayLetters` as optional — `loadMonthlyStats()` and `loadYearlyStats()` (lines ~2672 and ~2754) do NOT pass `dayLetters` and must still work. If either chart is blank or throws, check that the `dayLetters` fallback (`getLabel`) is reached correctly.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: stats — refined line chart with day letters, draw-on animation, gold avg line"
```

---

### Task 10: Home screen entry rows

**Files:**
- Modify: `food-logger/public/index.html` — `renderMealList()` JS function + CSS

- [ ] **Step 1: Find the meal list renderer**

Search for `meal-list` or where `.meal-item` elements are rendered in JS (around line 2400+). This is the function that builds the daily food log entries.

- [ ] **Step 2: Update meal item HTML template**

**Note**: The existing `renderMealList()` at line 2393 uses simple `onclick="deleteEntry(id)"` — there is **no swipe-to-delete behavior** in the current codebase. Nothing needs to be carried forward; the new delete button replaces the existing `🗑️ emoji button` directly.

The existing template also includes a food emoji (from `getFoodEmoji()`) and a meal-type badge (`.meal-badge`). These are removed in the redesign — the new asymmetric row does not include them. This is intentional per the spec (visual simplification). The `getFoodEmoji()` and `MEAL_LABELS` functions can stay in the JS as they may still be used elsewhere (e.g., stats or future features).

Replace the existing meal item template inside `renderMealList()` with the asymmetric row layout:

```js
// Each entry
`<div class="meal-item-row">
  <div class="mir-time">${formatTime(e.logged_at)}</div>
  <div class="mir-body">
    <div class="mir-name">${e.food_name || ''}</div>
    <div class="mir-macros">ח ${Math.round(e.protein_g||0)} · פ ${Math.round(e.carbs_g||0)} · ש ${Math.round(e.fat_g||0)} · ס ${Math.round(e.fiber_g||0)}</div>
  </div>
  <div class="mir-right">
    <div class="mir-kcal">${Math.round(e.calories || 0)}</div>
    <button class="mir-delete" onclick="deleteEntry(${e.id})" aria-label="מחק">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
      </svg>
    </button>
  </div>
</div>`
```

- [ ] **Step 3: Add CSS for asymmetric meal rows**

```css
.meal-item-row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  column-gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}
.meal-item-row:last-child { border-bottom: none; }

.mir-time {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  padding-top: 3px;
}
.mir-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.3;
}
.mir-macros {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--text2);
  margin-top: 3px;
}
.mir-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.mir-kcal {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 300;
  font-size: 20px;
  color: var(--text);
  line-height: 1;
}
.mir-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 4px;
  transition: color var(--dur-fast);
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mir-delete:hover { color: #f87171; }
```

- [ ] **Step 4: Verify**

Add 2–3 food items. Expected: Rows have timestamp in mono at right (RTL), food name in DM Sans, Fraunces italic kcal at left, macro summary below name. Delete SVG icon replaces emoji trash.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: home screen — asymmetric meal entry rows with SVG delete icon"
```

---

## Chunk 6: Remotion — AmbientSteam

**Files:**
- Create: `food-logger/remotion/src/AmbientSteam.tsx`
- Modify: `food-logger/remotion/src/Root.tsx`
- Modify: `food-logger/remotion/package.json`
- Modify: `food-logger/public/index.html` — add `<video>` to dashboard

---

### Task 11: Create AmbientSteam Remotion composition

- [ ] **Step 1: Read existing SaladLogo.tsx for reference**

```bash
cat food-logger/remotion/src/SaladLogo.tsx
```

Understand the structure: imports, `useCurrentFrame`, `useVideoConfig`, spring/interpolate usage.

- [ ] **Step 2: Create `AmbientSteam.tsx`**

```tsx
// food-logger/remotion/src/AmbientSteam.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const WISPS = [
  { x: 80,  phase: 0,   swayAmp: 8,  speed: 1.0 },
  { x: 160, phase: 40,  swayAmp: 6,  speed: 0.85 },
  { x: 240, phase: 80,  swayAmp: 10, speed: 1.15 },
] as const;

function Wisp({ x, phase, swayAmp, speed, frame, totalFrames }: {
  x: number; phase: number; swayAmp: number; speed: number;
  frame: number; totalFrames: number;
}) {
  const f = ((frame + phase) * speed) % totalFrames;
  const progress = f / totalFrames; // 0..1 looping

  // Rise: y goes from 280 → 20 over one loop
  const y = interpolate(progress, [0, 1], [280, 20]);

  // Sway: sinusoidal horizontal movement
  const sway = Math.sin(progress * Math.PI * 4) * swayAmp;

  // Fade: appears at bottom, fades near top
  const opacity = interpolate(progress, [0, 0.15, 0.75, 1], [0, 0.6, 0.4, 0]);

  // Scale: wisp widens as it rises
  const scaleX = interpolate(progress, [0, 1], [0.6, 1.4]);

  return (
    <path
      d={`M${x + sway},${y} C${x + sway - 8},${y - 20} ${x + sway + 8},${y - 40} ${x + sway},${y - 60}`}
      stroke={`rgba(240, 232, 220, ${opacity})`}
      strokeWidth={3 * scaleX}
      fill="none"
      strokeLinecap="round"
    />
  );
}

export const AmbientSteam: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <svg
      width="400"
      height="300"
      viewBox="0 0 400 300"
      style={{ background: 'transparent' }}
    >
      {WISPS.map((w, i) => (
        <Wisp key={i} {...w} frame={frame} totalFrames={durationInFrames} />
      ))}
    </svg>
  );
};
```

- [ ] **Step 3: Register in Root.tsx**

Open `food-logger/remotion/src/Root.tsx`. Add the new composition alongside `SaladLogo`:

```tsx
import { AmbientSteam } from './AmbientSteam';

// Inside the registerRoot component, add:
<Composition
  id="AmbientSteam"
  component={AmbientSteam}
  durationInFrames={120}
  fps={30}
  width={400}
  height={300}
/>
```

- [ ] **Step 4: Add render script to package.json**

Open `food-logger/remotion/package.json`. Add to `"scripts"`:
```json
"render:steam": "npx remotion render AmbientSteam --output ../public/ambient-steam.mp4"
```

- [ ] **Step 5: Render the video**

```bash
cd food-logger/remotion
npm run render:steam
```

Expected: `food-logger/public/ambient-steam.mp4` created (~100KB for a 4-second 400×300 clip).

- [ ] **Step 6: Embed in dashboard**

In `food-logger/public/index.html`, inside `.dash-hero-cal` (added in Task 4), add the video element as the first child:

```html
<video class="dash-ambient-steam"
  src="/ambient-steam.mp4"
  autoplay muted loop playsinline
  aria-hidden="true"></video>
```

Add CSS:
```css
.dash-hero-cal {
  position: relative; /* already set or add it */
}
.dash-ambient-steam {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 400px;
  opacity: 0.05;
  pointer-events: none;
  z-index: 0;
}
```

Make sure `.dash-cal-remaining` and `.dash-cal-label-row` have `position: relative; z-index: 1;` so they sit above the video.

- [ ] **Step 7: Verify**

Open Dashboard. Expected: Faint rising steam wisps visible behind the calorie number at very low opacity. Number and labels readable. No interaction blocked.

- [ ] **Step 8: Commit**

```bash
cd ..  # back to food-logger root
git add public/index.html public/ambient-steam.mp4 remotion/src/AmbientSteam.tsx remotion/src/Root.tsx remotion/package.json
git commit -m "feat: AmbientSteam Remotion composition + dashboard ambient overlay"
```

---

## Chunk 7: Final Polish + Verification

**Files:**
- Modify: `food-logger/public/index.html` — Auth/Welcome screens minor polish

---

### Task 12: Apply token system to remaining screens

- [ ] **Step 1: Auth / Welcome — wavy dividers**

In `#screen-auth` and `#screen-welcome`, find `<hr>` elements or section breaks between the logo and the form card. Replace with the wavy divider SVG from Task 3.

- [ ] **Step 2: Scan for remaining `18px` radius values**

```bash
grep -n "18px" food-logger/public/index.html | grep -i radius
```

Replace any remaining hardcoded `18px` border-radius with the appropriate token (`var(--radius-sharp)`, `var(--radius-pill)`, or `var(--radius-input)`).

- [ ] **Step 3: Scan for remaining emoji icons in functional UI**

```bash
grep -n "🗑\|📋\|📷\|✨\|✍\|🔥\|☀\|🌤\|🌙\|🍎\|⚖\|🍽\|🎉\|💪\|✅\|🔄\|⚙\|🌅\|📸\|＋" food-logger/public/index.html
```

For each remaining emoji in **buttons, labels, or nav items** (functional UI), replace with appropriate SVG or plain text. Acceptable to leave:
- Emojis in toasts/notifications (e.g. `🎉` in success messages)
- Emojis in the `FOOD_EMOJI_MAP` array (user-facing food icons in entries — these are content, not UI chrome)
- Emojis in `MEAL_LABELS` (meal type labels — these can be replaced with plain Hebrew text per the spec: "בוקר", "צהריים", "ערב", "חטיף")
- The greeting emoji in `loadDashboard` line ~2274 (`☀️` etc.) should be removed; the greeting becomes plain italic Fraunces text without emoji

- [ ] **Step 4: Full regression test**

Go through every screen manually:
1. Welcome → Register new account → Dashboard loads ✓
2. Dashboard: ring animates, plate shows, streak line visible ✓
3. Navigate to Home: entry rows show correct layout ✓
4. Camera: corners pulse, capture button has outer ring, placeholder types ✓
5. Analyze an image or text → Analysis receipt shows with stagger ✓
6. Edit a value in the receipt → Save → verify entry appears in diary ✓
7. Stats weekly: Hebrew day letters, draw-on polyline, gold avg line ✓
8. Stats monthly and yearly: charts load without error ✓
9. Weight screen: loads and logs ✓
10. Settings: loads without error ✓
11. All screens: no console errors ✓

- [ ] **Step 5: Final commit**

```bash
git add public/index.html
git commit -m "style: final polish — wavy dividers on auth/welcome, remove remaining emoji icons"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: CSS Foundation | 1–3 | Tokens, animations, reduced-motion, SVG icons, wavy dividers |
| 2: Dashboard | 4–5 | Hero calorie number, ring animation, log preview rows |
| 3: Macro Plate | 6 | `renderPlate()` with 4 macros, tap tooltip, edge cases |
| 4: Camera + Analysis | 7–8 | Corner markers, receipt layout with stagger |
| 5: Stats + Home | 9–10 | Refined line chart, asymmetric meal rows |
| 6: Remotion | 11 | AmbientSteam video + dashboard overlay |
| 7: Polish | 12 | Remaining screens, regression test |
