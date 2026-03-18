# Capybara Animations & Logo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the salad video logo with an inline SVG capybara holding a salad bowl, add the capybara to the camera/analysis and diary screens, and improve all existing capybara animations.

**Architecture:** All changes are in two files: `public/index.html` (inline CSS + JS + HTML) and a new `public/favicon.svg`. No new dependencies. CSS keyframes + transform/opacity only, prefers-reduced-motion honoured via existing global rule + JS matchMedia guard.

**Tech Stack:** Vanilla JS, inline CSS keyframes, SVG, single-file SPA.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `public/index.html` | Modify | CSS (lines 55–144): improved breathe, new keyframes (tail wag, ear twitch, state pop, hop, capy-think, capy-think-q, logo enter animations) |
| `public/index.html` | Modify | CSS: new `.pet--surprised` state rules, `.pet--thinking` modifier rules, `.pet-wagging`, `.pet-ear-twitching`, `.pet-state-pop`, `.pet-hopping` |
| `public/index.html` | Modify | CSS: `#daily-summary-card { position: relative }` |
| `public/index.html` | Modify | HTML `#capy-tpl` (line 4365): add `<g class="pet-ear-left">` / `<g class="pet-ear-right">` wrappers, tail path, surprised mouth ellipse, think-q text |
| `public/index.html` | Modify | HTML dashboard (line 2146): replace `<video id="dash-logo-vid">` with logo SVG |
| `public/index.html` | Modify | HTML welcome (line 2023): replace `<video>` inside `.welcome-icon` with logo SVG |
| `public/index.html` | Modify | HTML analysis (line 2274): insert `<div id="pet-camera-wrap">` as first child of `.page` |
| `public/index.html` | Modify | HTML home (line 2210): insert `<div id="pet-diary-wrap">` as last child of `#daily-summary-card` |
| `public/index.html` | Modify | JS `setPetState` (line 3025): extend array with `'surprised'` |
| `public/index.html` | Modify | JS `navigate()` (line 3031): add idle stop calls + `_cameraCapyState('neutral')` on `'analysis'` |
| `public/index.html` | Modify | JS stats walk (line 3803): speed 0.85, bob ±3deg -3px, hop on turn |
| `public/index.html` | Modify | JS: add module-level refs `_dashPetWrap`, `_diaryPetWrap`, `_cameraPetWrap` |
| `public/index.html` | Modify | JS: add `startIdleAnimations()`, `stopIdleAnimations()` |
| `public/index.html` | Modify | JS: add `_cameraCapyState()`, `getDiaryPetState()` |
| `public/index.html` | Modify | JS `renderDailySummary` (line 3358): add diary pet logic at end |
| `public/index.html` | Modify | JS `analyzeText` / `analyzeFood`: call `_cameraCapyState` before fetch, on success, on error |
| `public/index.html` | Modify | JS: remove auto-restart IIFE (lines 4357–4363) |
| `public/favicon.svg` | Create | Standalone 44×44 favicon SVG |

---

## Task 1: Extend `#capy-tpl` with New SVG Elements

**Files:**
- Modify: `public/index.html:4365–4451` (`<template id="capy-tpl">`)

- [ ] **Step 1: Wrap the left ear circles in `<g class="pet-ear-left">`**

Find in `#capy-tpl` (around line 4375–4376):
```html
    <!-- ears -->
    <circle cx="30" cy="28" r="9" fill="#C4956A"/>
    <circle cx="30" cy="28" r="5" fill="#e0a87a"/>
    <circle cx="80" cy="28" r="9" fill="#C4956A"/>
    <circle cx="80" cy="28" r="5" fill="#e0a87a"/>
```

Replace with:
```html
    <!-- ears -->
    <g class="pet-ear-left" style="transform-box:fill-box;transform-origin:center bottom">
      <circle cx="30" cy="28" r="9" fill="#C4956A"/>
      <circle cx="30" cy="28" r="5" fill="#e0a87a"/>
    </g>
    <g class="pet-ear-right" style="transform-box:fill-box;transform-origin:center bottom">
      <circle cx="80" cy="28" r="9" fill="#C4956A"/>
      <circle cx="80" cy="28" r="5" fill="#e0a87a"/>
    </g>
```

- [ ] **Step 2: Add tail, surprised mouth, and think-q text**

Find the closing `</svg>` in `#capy-tpl` (after the ZZZ texts, line ~4450). Insert before `</svg>`:
```html
    <!-- tail -->
    <g class="pet-tail" style="transform-box:fill-box;transform-origin:center">
      <path d="M 88 72 Q 96 68 94 78" stroke="#b07d50" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>

    <!-- SURPRISED mouth -->
    <ellipse class="pet-mouth-surprised" cx="55" cy="62" rx="5" ry="4" fill="#8B5E35"/>

    <!-- thinking question mark -->
    <text class="pet-think-q" x="82" y="18" font-size="14" fill="#E8703A" font-family="sans-serif" font-weight="bold" opacity="0">?</text>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`, log in, check that the capybara on the dashboard still renders correctly (no visual breakage from the ear wrappers).

- [ ] **Step 4: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: extend capy-tpl with ear wrappers, tail, surprised mouth, think-q"
```

---

## Task 2: New CSS — Animations & States

**Files:**
- Modify: `public/index.html:55–144` (pet CSS block)
- Modify: `public/index.html:104–143` (pet state rules block)

- [ ] **Step 1: Improve breathe + add new idle keyframes**

Find (line 57–63):
```css
@keyframes pet-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.025); }
}
.pet-wrap {
  animation: pet-breathe 3s ease-in-out infinite;
  transform-origin: center bottom;
}
```

Replace with:
```css
@keyframes pet-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.04); }
}
.pet-wrap {
  animation: pet-breathe 4s cubic-bezier(0.45,0,0.55,1) infinite;
  transform-origin: center bottom;
}
/* Tail wag */
@keyframes pet-tail-wag {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(18deg); }
  75%       { transform: rotate(-10deg); }
}
.pet-wagging .pet-tail { animation: pet-tail-wag 0.6s ease-in-out; }
/* Ear twitch */
@keyframes pet-ear-twitch {
  0%, 100% { transform: scaleY(1); }
  40%       { transform: scaleY(1.35); }
}
.pet-ear-twitching .pet-ear-left { animation: pet-ear-twitch 150ms ease-in-out; }
/* State pop */
@keyframes pet-state-pop {
  0%   { transform: scale(0.92); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
.pet-state-pop { animation: pet-state-pop 0.25s cubic-bezier(0.22,1,0.36,1) both; }
/* Walk hop (used on direction turn) */
@keyframes pet-hop {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
.pet-hopping { animation: pet-hop 150ms cubic-bezier(0.25,1,0.5,1); }
/* Thinking modifier */
.pet--thinking {
  animation: capy-think 1.2s ease-in-out infinite !important;
  transform-origin: center bottom;
}
@keyframes capy-think {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  30%       { transform: rotate(-8deg) translateY(-3px); }
  60%       { transform: rotate(4deg) translateY(-1px); }
}
.pet--thinking .pet-think-q { animation: capy-think-q 1.2s ease-in-out infinite; }
@keyframes capy-think-q {
  0%, 100% { opacity: 0; transform: translateY(0); }
  30%, 70%  { opacity: 1; transform: translateY(-3px); }
}
```

- [ ] **Step 2: Add `pet-mouth-surprised` to the default-hidden list and add `pet--surprised` state rules**

Find (line ~104–113):
```css
/* default (neutral) state — flat eyes, flat mouth */
.pet-eyes-arc,
.pet-eyes-closed,
.pet-eyes-happy,
.pet-mouth-grin,
.pet-mouth-frown,
.pet-blush,
.pet-brow-sad,
.pet-tear,
.pet-zzz { display: none; }
```

Replace with:
```css
/* default (neutral) state — flat eyes, flat mouth */
.pet-eyes-arc,
.pet-eyes-closed,
.pet-eyes-happy,
.pet-mouth-grin,
.pet-mouth-frown,
.pet-mouth-surprised,
.pet-blush,
.pet-brow-sad,
.pet-tear,
.pet-zzz { display: none; }
```

Then find the `/* sleeping */` block (line ~139–143) and add after it:
```css
/* surprised — uses display:inline consistent with all other state rules in this file */
.pet--surprised .pet-eyes-neutral    { display: none; }
.pet--surprised .pet-mouth-neutral   { display: none; }
.pet--surprised .pet-eyes-happy      { display: inline; }
.pet--surprised .pet-mouth-surprised { display: inline; }
.pet--surprised .pet-mouth-grin      { display: none; }
.pet--surprised .pet-mouth-frown     { display: none; }
```

- [ ] **Step 3: Add logo entry keyframes (needed for Task 3)**

Add after the `.pet-hopping` block:
```css
/* Logo SVG enter animations */
@keyframes capy-logo-bg-enter {
  from { transform: scale(0); }
  to   { transform: scale(1); }
}
@keyframes capy-logo-bowl-drop {
  from { transform: translateY(-40px); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}
@keyframes capy-logo-ing-fall {
  from { transform: translateY(-30px) rotate(var(--ing-rot, 30deg)); opacity: 0; }
  to   { transform: translateY(0)     rotate(0deg);                  opacity: 1; }
}
.capy-logo-bg {
  transform-origin: center;
  animation: capy-logo-bg-enter 300ms cubic-bezier(0.22,1,0.36,1) both;
}
.capy-logo-bowl {
  animation: capy-logo-bowl-drop 400ms cubic-bezier(0.22,1,0.36,1) 100ms both;
}
.capy-logo-ing {
  animation: capy-logo-ing-fall 450ms cubic-bezier(0.22,1,0.36,1) calc(500ms + var(--delay, 0ms)) both;
}
.capy-logo-body { animation: pet-breathe 4s cubic-bezier(0.45,0,0.55,1) infinite; transform-origin: center bottom; }
@media (prefers-reduced-motion: reduce) {
  .capy-logo-bg, .capy-logo-bowl, .capy-logo-ing { animation: none; }
  .capy-logo-body { animation: none; }
}
```

- [ ] **Step 4: Add `#daily-summary-card { position: relative }` CSS**

Find the CSS rule for `#daily-summary-card` or add after the card rules:
```css
#daily-summary-card { position: relative; }
```

- [ ] **Step 5: Verify in browser**

Check capybara breathe animation feels smoother (slower, 4s). No visual regressions.

- [ ] **Step 6: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: add capybara animation CSS (tail wag, ear twitch, state pop, hop, thinking, surprised)"
```

---

## Task 3: Logo SVG — Replace Video Elements + Favicon

**Files:**
- Modify: `public/index.html:2023` (welcome video)
- Modify: `public/index.html:2146` (dashboard video)
- Modify: `public/index.html:13` (favicon link, change `/icon.svg` → `/favicon.svg`)
- Modify: `public/index.html:4357–4363` (remove auto-restart IIFE)
- Create: `public/favicon.svg`

The logo SVG is a 120×120 inline SVG: orange rect background, capybara body/head/ears holding a salad bowl, 11 staggered falling ingredients.

- [ ] **Step 1: Replace dashboard video (line 2146)**

Find:
```html
      <video id="dash-logo-vid" class="dash-logo-vid" src="/salad-logo.webm" muted playsinline autoplay loop></video>
```

Replace with (the full logo SVG):
```html
      <svg class="capy-logo" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="80" height="80" aria-label="לוגו יומן">
        <!-- background -->
        <rect class="capy-logo-bg" x="0" y="0" width="120" height="120" rx="24" fill="#E8703A"/>
        <!-- capybara body group (breathes) -->
        <g class="capy-logo-body">
          <!-- body -->
          <ellipse cx="60" cy="78" rx="30" ry="18" fill="#C4956A"/>
          <ellipse cx="60" cy="81" rx="20" ry="11" fill="#e8c89a"/>
          <!-- head -->
          <rect x="32" y="38" width="56" height="38" rx="14" fill="#C4956A"/>
          <!-- snout -->
          <rect x="39" y="52" width="42" height="18" rx="10" fill="#b07d50"/>
          <!-- ears -->
          <circle cx="37" cy="40" r="8" fill="#C4956A"/>
          <circle cx="37" cy="40" r="4.5" fill="#e0a87a"/>
          <circle cx="83" cy="40" r="8" fill="#C4956A"/>
          <circle cx="83" cy="40" r="4.5" fill="#e0a87a"/>
          <!-- eyes (happy) -->
          <circle cx="44" cy="46" r="4.5" fill="#2d1a0a"/>
          <circle cx="44" cy="46" r="3" fill="#1a1a1a"/>
          <circle cx="43" cy="45" r="1" fill="white"/>
          <circle cx="76" cy="46" r="4.5" fill="#2d1a0a"/>
          <circle cx="76" cy="46" r="3" fill="#1a1a1a"/>
          <circle cx="75" cy="45" r="1" fill="white"/>
          <!-- nostrils -->
          <ellipse cx="51" cy="62" rx="2.5" ry="1.8" fill="#8B5E35"/>
          <ellipse cx="69" cy="62" rx="2.5" ry="1.8" fill="#8B5E35"/>
          <!-- mouth (grin) -->
          <path d="M 47 68 Q 60 76 73 68" stroke="#8B5E35" stroke-width="2" fill="none" stroke-linecap="round"/>
          <!-- blush -->
          <ellipse cx="38" cy="54" rx="6" ry="3.5" fill="#E8703A" opacity="0.3"/>
          <ellipse cx="82" cy="54" rx="6" ry="3.5" fill="#E8703A" opacity="0.3"/>
          <!-- arms -->
          <path d="M 36 74 Q 28 84 28 93" stroke="#b07d50" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M 84 74 Q 92 84 92 93" stroke="#b07d50" stroke-width="5" fill="none" stroke-linecap="round"/>
          <!-- paws -->
          <ellipse cx="28" cy="95" rx="5" ry="3" fill="#b07d50"/>
          <ellipse cx="92" cy="95" rx="5" ry="3" fill="#b07d50"/>
        </g>
        <!-- bowl (animated separately) -->
        <g class="capy-logo-bowl">
          <!-- bowl body -->
          <path d="M 20 93 Q 20 113 60 113 Q 100 113 100 93 Z" fill="white" opacity="0.92"/>
          <!-- bowl rim -->
          <ellipse cx="60" cy="93" rx="40" ry="8" fill="white" opacity="0.92"/>
          <!-- ingredients — 11 circles, staggered -->
          <!-- bottom layer, spread wide -->
          <g class="capy-logo-ing" style="--delay:0ms;--ing-rot:25deg"><circle cx="28" cy="104" r="5" fill="#2E7D32"/></g>
          <g class="capy-logo-ing" style="--delay:120ms;--ing-rot:-20deg"><circle cx="38" cy="107" r="4.5" fill="#EF5350"/></g>
          <g class="capy-logo-ing" style="--delay:240ms;--ing-rot:30deg"><circle cx="50" cy="108" r="4" fill="#FFD54F"/></g>
          <g class="capy-logo-ing" style="--delay:360ms;--ing-rot:-15deg"><circle cx="62" cy="109" r="4.5" fill="#A5D6A7"/></g>
          <g class="capy-logo-ing" style="--delay:480ms;--ing-rot:20deg"><circle cx="74" cy="107" r="4" fill="#E53935"/></g>
          <g class="capy-logo-ing" style="--delay:600ms;--ing-rot:-25deg"><circle cx="85" cy="104" r="4.5" fill="#2E7D32"/></g>
          <g class="capy-logo-ing" style="--delay:720ms;--ing-rot:18deg"><circle cx="92" cy="103" r="4" fill="#A5D6A7"/></g>
          <!-- mid layer -->
          <g class="capy-logo-ing" style="--delay:840ms;--ing-rot:-22deg"><circle cx="35" cy="97" r="4" fill="#FFD54F"/></g>
          <g class="capy-logo-ing" style="--delay:960ms;--ing-rot:28deg"><circle cx="48" cy="98" r="4.5" fill="#EF5350"/></g>
          <g class="capy-logo-ing" style="--delay:1080ms;--ing-rot:-18deg"><circle cx="72" cy="98" r="4" fill="#2E7D32"/></g>
          <!-- top peek above rim -->
          <g class="capy-logo-ing" style="--delay:1200ms;--ing-rot:15deg"><circle cx="60" cy="90" r="4" fill="#A5D6A7"/></g>
        </g>
      </svg>
```

- [ ] **Step 2: Replace welcome video (line 2023)**

Find:
```html
      <video src="/salad-logo.webm" autoplay muted playsinline style="border-radius:24px"></video>
```

Replace with the same SVG markup (identical to Step 1, just no `id`):
```html
      <svg class="capy-logo" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="80" height="80" aria-label="לוגו יומן">
        <!-- background -->
        <rect class="capy-logo-bg" x="0" y="0" width="120" height="120" rx="24" fill="#E8703A"/>
        <!-- capybara body group (breathes) -->
        <g class="capy-logo-body">
          <!-- body -->
          <ellipse cx="60" cy="78" rx="30" ry="18" fill="#C4956A"/>
          <ellipse cx="60" cy="81" rx="20" ry="11" fill="#e8c89a"/>
          <!-- head -->
          <rect x="32" y="38" width="56" height="38" rx="14" fill="#C4956A"/>
          <!-- snout -->
          <rect x="39" y="52" width="42" height="18" rx="10" fill="#b07d50"/>
          <!-- ears -->
          <circle cx="37" cy="40" r="8" fill="#C4956A"/>
          <circle cx="37" cy="40" r="4.5" fill="#e0a87a"/>
          <circle cx="83" cy="40" r="8" fill="#C4956A"/>
          <circle cx="83" cy="40" r="4.5" fill="#e0a87a"/>
          <!-- eyes (happy) -->
          <circle cx="44" cy="46" r="4.5" fill="#2d1a0a"/>
          <circle cx="44" cy="46" r="3" fill="#1a1a1a"/>
          <circle cx="43" cy="45" r="1" fill="white"/>
          <circle cx="76" cy="46" r="4.5" fill="#2d1a0a"/>
          <circle cx="76" cy="46" r="3" fill="#1a1a1a"/>
          <circle cx="75" cy="45" r="1" fill="white"/>
          <!-- nostrils -->
          <ellipse cx="51" cy="62" rx="2.5" ry="1.8" fill="#8B5E35"/>
          <ellipse cx="69" cy="62" rx="2.5" ry="1.8" fill="#8B5E35"/>
          <!-- mouth (grin) -->
          <path d="M 47 68 Q 60 76 73 68" stroke="#8B5E35" stroke-width="2" fill="none" stroke-linecap="round"/>
          <!-- blush -->
          <ellipse cx="38" cy="54" rx="6" ry="3.5" fill="#E8703A" opacity="0.3"/>
          <ellipse cx="82" cy="54" rx="6" ry="3.5" fill="#E8703A" opacity="0.3"/>
          <!-- arms -->
          <path d="M 36 74 Q 28 84 28 93" stroke="#b07d50" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M 84 74 Q 92 84 92 93" stroke="#b07d50" stroke-width="5" fill="none" stroke-linecap="round"/>
          <!-- paws -->
          <ellipse cx="28" cy="95" rx="5" ry="3" fill="#b07d50"/>
          <ellipse cx="92" cy="95" rx="5" ry="3" fill="#b07d50"/>
        </g>
        <!-- bowl (animated separately) -->
        <g class="capy-logo-bowl">
          <path d="M 20 93 Q 20 113 60 113 Q 100 113 100 93 Z" fill="white" opacity="0.92"/>
          <ellipse cx="60" cy="93" rx="40" ry="8" fill="white" opacity="0.92"/>
          <g class="capy-logo-ing" style="--delay:0ms;--ing-rot:25deg"><circle cx="28" cy="104" r="5" fill="#2E7D32"/></g>
          <g class="capy-logo-ing" style="--delay:120ms;--ing-rot:-20deg"><circle cx="38" cy="107" r="4.5" fill="#EF5350"/></g>
          <g class="capy-logo-ing" style="--delay:240ms;--ing-rot:30deg"><circle cx="50" cy="108" r="4" fill="#FFD54F"/></g>
          <g class="capy-logo-ing" style="--delay:360ms;--ing-rot:-15deg"><circle cx="62" cy="109" r="4.5" fill="#A5D6A7"/></g>
          <g class="capy-logo-ing" style="--delay:480ms;--ing-rot:20deg"><circle cx="74" cy="107" r="4" fill="#E53935"/></g>
          <g class="capy-logo-ing" style="--delay:600ms;--ing-rot:-25deg"><circle cx="85" cy="104" r="4.5" fill="#2E7D32"/></g>
          <g class="capy-logo-ing" style="--delay:720ms;--ing-rot:18deg"><circle cx="92" cy="103" r="4" fill="#A5D6A7"/></g>
          <g class="capy-logo-ing" style="--delay:840ms;--ing-rot:-22deg"><circle cx="35" cy="97" r="4" fill="#FFD54F"/></g>
          <g class="capy-logo-ing" style="--delay:960ms;--ing-rot:28deg"><circle cx="48" cy="98" r="4.5" fill="#EF5350"/></g>
          <g class="capy-logo-ing" style="--delay:1080ms;--ing-rot:-18deg"><circle cx="72" cy="98" r="4" fill="#2E7D32"/></g>
          <g class="capy-logo-ing" style="--delay:1200ms;--ing-rot:15deg"><circle cx="60" cy="90" r="4" fill="#A5D6A7"/></g>
        </g>
      </svg>
```

- [ ] **Step 3: Update favicon link (line 13)**

Find:
```html
<link rel="icon" type="image/svg+xml" href="/icon.svg">
```

Replace with:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
```

- [ ] **Step 4: Remove auto-restart IIFE (lines ~4357–4363)**

Find and delete the entire block:
```javascript
(function () {
  const vid = document.getElementById('dash-logo-vid');
  if (!vid) return;
  const resume = () => { if (vid.paused) vid.play().catch(() => {}); };
  vid.addEventListener('pause', resume);
  document.addEventListener('visibilitychange', resume);
})();
```

- [ ] **Step 5: Create `public/favicon.svg`**

Create file `food-logger/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <!-- background -->
  <rect x="0" y="0" width="44" height="44" rx="10" fill="#E8703A"/>
  <!-- body -->
  <ellipse cx="22" cy="32" rx="12" ry="7" fill="#C4956A"/>
  <!-- head -->
  <rect x="11" y="14" width="22" height="16" rx="6" fill="#C4956A"/>
  <!-- snout -->
  <rect x="14" y="20" width="16" height="8" rx="4" fill="#b07d50"/>
  <!-- ears -->
  <circle cx="14" cy="15" r="4" fill="#C4956A"/>
  <circle cx="14" cy="15" r="2" fill="#e0a87a"/>
  <circle cx="30" cy="15" r="4" fill="#C4956A"/>
  <circle cx="30" cy="15" r="2" fill="#e0a87a"/>
  <!-- eyes -->
  <circle cx="17" cy="18" r="2.5" fill="#1a1a1a"/>
  <circle cx="16.5" cy="17.5" r="0.7" fill="white"/>
  <circle cx="27" cy="18" r="2.5" fill="#1a1a1a"/>
  <circle cx="26.5" cy="17.5" r="0.7" fill="white"/>
  <!-- arms -->
  <path d="M 13 30 Q 9 35 9 39" stroke="#b07d50" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M 31 30 Q 35 35 35 39" stroke="#b07d50" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- bowl -->
  <path d="M 6 37 Q 6 44 22 44 Q 38 44 38 37 Z" fill="white" opacity="0.9"/>
  <ellipse cx="22" cy="37" rx="16" ry="4" fill="white" opacity="0.9"/>
  <!-- 6 key ingredients -->
  <circle cx="10" cy="41" r="2.5" fill="#2E7D32"/>
  <circle cx="16" cy="42.5" r="2" fill="#EF5350"/>
  <circle cx="22" cy="43" r="2" fill="#FFD54F"/>
  <circle cx="28" cy="42.5" r="2" fill="#A5D6A7"/>
  <circle cx="34" cy="41" r="2" fill="#E53935"/>
  <circle cx="22" cy="36" r="2" fill="#2E7D32"/>
</svg>
```

- [ ] **Step 6: Verify in browser**

- Dashboard: SVG logo shows capybara holding bowl, ingredients animate in on page load
- Welcome screen: same logo shows
- Browser tab: favicon shows capybara logo
- No `<video>` elements remain in the page (check DevTools)

- [ ] **Step 7: Commit**

```bash
git add food-logger/public/index.html food-logger/public/favicon.svg
git commit -m "feat: replace salad video with capybara logo SVG, add favicon"
```

---

## Task 4: JS — Idle Animation System + Extended State

**Files:**
- Modify: `public/index.html` — JS section (around line 2993–3054)

- [ ] **Step 1: Add module-level refs and `startIdleAnimations`/`stopIdleAnimations`**

Find (line ~2993):
```javascript
function cloneCapybara(size) {
```

Insert before it:
```javascript
// ── Idle animation refs ──────────────────────────────────────────────────────
let _dashPetWrap   = null;
let _diaryPetWrap  = null;
let _cameraPetWrap = null;

function startIdleAnimations(petWrap) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopIdleAnimations(petWrap);
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

- [ ] **Step 2: Extend `setPetState` with `'surprised'` + add state-pop**

Find (line 3025):
```javascript
function setPetState(wrapEl, state) {
  ['ecstatic','happy','neutral','sad','sleeping'].forEach(s =>
    wrapEl.classList.toggle(`pet--${s}`, s === state)
  );
}
```

Replace with:
```javascript
function setPetState(wrapEl, state) {
  ['ecstatic','happy','neutral','sad','sleeping','surprised'].forEach(s =>
    wrapEl.classList.toggle(`pet--${s}`, s === state)
  );
  // brief pop animation on state change
  wrapEl.classList.remove('pet-state-pop');
  void wrapEl.offsetWidth; // force reflow to restart animation
  wrapEl.classList.add('pet-state-pop');
  setTimeout(() => wrapEl.classList.remove('pet-state-pop'), 250);
}
```

- [ ] **Step 3: Add idle stop calls to `navigate()` — first edit**

Find (line 3031–3033):
```javascript
function navigate(screen) {
  if (currentScreen === 'analysis') hideCapyPopup();
  document.querySelectorAll('.screen').forEach(s =>
```

Replace with:
```javascript
function navigate(screen) {
  if (currentScreen === 'analysis') hideCapyPopup();
  // stop all idle animations unconditionally on every navigation
  stopIdleAnimations(_dashPetWrap);
  stopIdleAnimations(_diaryPetWrap);
  stopIdleAnimations(_cameraPetWrap);
  document.querySelectorAll('.screen').forEach(s =>
```

- [ ] **Step 3b: Add `_cameraCapyState('neutral')` to `navigate()` — second edit**

Find (line 3053–3054):
```javascript
  if (screen === 'camera') animatePlaceholder();
}
```

Replace with:
```javascript
  if (screen === 'camera') animatePlaceholder();
  if (screen === 'analysis') _cameraCapyState('neutral');
}
```

- [ ] **Step 4: Wire up idle animations for the dashboard capybara**

The dashboard capybara is created in `loadDashboard`. Find where `setPetState(petWrap, state)` is called for the dashboard (around line 3237):
```javascript
    if (petWrap) setPetState(petWrap, state);
```

The capybara is stored in `pet-dashboard-wrap`. Find where it's cloned. Look for `cloneCapybara(80)` (around line 3234):
```javascript
      wrapEl.appendChild(cloneCapybara(80));
```

After this line, the `petWrap` is `wrapEl.querySelector('.pet-wrap')`. Find the pattern and add `_dashPetWrap` assignment + `startIdleAnimations`. The full context around line 3232:

Find:
```javascript
      wrapEl.appendChild(cloneCapybara(80));
```

Look at the surrounding context to find the block and add after `wrapEl.appendChild(cloneCapybara(80));`:
```javascript
      _dashPetWrap = wrapEl.querySelector('.pet-wrap');
      startIdleAnimations(_dashPetWrap);
```

- [ ] **Step 5: Verify in browser**

- Navigate to dashboard, wait 5–8s → capybara wags tail briefly
- Wait 8–12s → left ear twitches briefly
- Navigate away and back → intervals restart cleanly, no duplicate intervals
- Change capybara state (trigger different days) → brief pop animation visible

- [ ] **Step 6: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: add idle animation system, extend setPetState with surprised + state pop"
```

---

## Task 5: Stats Walk Improvements

**Files:**
- Modify: `public/index.html:3789–3821` (`startStatsCapyWalk` and CSS)

- [ ] **Step 1: Improve walk bob CSS**

Find (line 84–88):
```css
@keyframes capy-walk-bob {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  25%       { transform: rotate(-2deg) translateY(-2px); }
  75%       { transform: rotate(2deg) translateY(-2px); }
}
```

Replace with:
```css
@keyframes capy-walk-bob {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  25%       { transform: rotate(-3deg) translateY(-3px); }
  75%       { transform: rotate(3deg) translateY(-3px); }
}
```

- [ ] **Step 2: Increase walk speed from 0.5 to 0.85**

Find (line 3803):
```javascript
    _capyWalkX += _capyWalkDir * 0.5 * (dt / 16);
```

Replace with:
```javascript
    _capyWalkX += _capyWalkDir * 0.85 * (dt / 16);
```

- [ ] **Step 3: Add hop on turn (replace instant flip with hop + flip)**

Find the turn section in `startStatsCapyWalk` (lines ~3804–3811):
```javascript
    if (_capyWalkX >= maxX) {
      _capyWalkX = maxX;
      _capyWalkDir = -1;
      pet.style.transform = 'scaleX(-1)';
    } else if (_capyWalkX <= 0) {
      _capyWalkX = 0;
      _capyWalkDir = 1;
      pet.style.transform = 'scaleX(1)';
    }
```

Replace with:
```javascript
    if (_capyWalkX >= maxX) {
      _capyWalkX = maxX;
      _capyWalkDir = -1;
      pet.classList.add('pet-hopping');
      setTimeout(() => {
        pet.style.transform = 'scaleX(-1)';
        pet.classList.remove('pet-hopping');
      }, 75);
    } else if (_capyWalkX <= 0) {
      _capyWalkX = 0;
      _capyWalkDir = 1;
      pet.classList.add('pet-hopping');
      setTimeout(() => {
        pet.style.transform = 'scaleX(1)';
        pet.classList.remove('pet-hopping');
      }, 75);
    }
```

- [ ] **Step 4: Verify in browser**

Navigate to Stats → Weekly. Capybara walks faster, bobs more expressively, does a small hop when turning at walls.

- [ ] **Step 5: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: improve stats capybara walk speed, bob, and hop-on-turn"
```

---

## Task 6: Camera / Analysis Screen Capybara

**Files:**
- Modify: `public/index.html:2274` (analysis screen HTML)
- Modify: `public/index.html` JS (add `_cameraCapyState`, wire into `analyzeText`/`analyzeFood`)

- [ ] **Step 1: Add `#pet-camera-wrap` to analysis screen HTML**

Find (line 2274):
```html
  <div class="page">
    <img id="analysis-img" class="analysis-img" alt="">
```

Replace with:
```html
  <div class="page">
    <div id="pet-camera-wrap" style="display:flex;justify-content:center;padding:8px 0 4px"></div>
    <img id="analysis-img" class="analysis-img" alt="">
```

- [ ] **Step 2: Add `_cameraCapyState()` function**

Find (after `stopIdleAnimations` function, before `cloneCapybara`):
```javascript
function cloneCapybara(size) {
```

Insert before it:
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
  const baseState = state === 'thinking' ? 'neutral' : state;
  setPetState(pet, baseState);
  pet.classList.toggle('pet--thinking', state === 'thinking');
}

```

- [ ] **Step 3: Wire `_cameraCapyState` into `analyzeText()`**

Two verbatim find/replace edits.

**First edit** — add thinking + ecstatic. Find (line 3579–3586):
```javascript
  navigate('analysis');
  document.getElementById('analysis-img').style.display = 'none';
  document.getElementById('analysis-loading').style.display = 'block';
  document.getElementById('analysis-result').style.display = 'none';
  document.getElementById('analysis-error').textContent = '';
  try {
    const data = await apiFetch('/api/analyze-text', { method: 'POST', body: JSON.stringify({ text }) });
    const resName = document.getElementById('res-name');
```

Replace with:
```javascript
  navigate('analysis');
  _cameraCapyState('thinking');
  document.getElementById('analysis-img').style.display = 'none';
  document.getElementById('analysis-loading').style.display = 'block';
  document.getElementById('analysis-result').style.display = 'none';
  document.getElementById('analysis-error').textContent = '';
  try {
    const data = await apiFetch('/api/analyze-text', { method: 'POST', body: JSON.stringify({ text }) });
    _cameraCapyState('ecstatic');
    setTimeout(() => _cameraCapyState('happy'), 2000);
    const resName = document.getElementById('res-name');
```

**Second edit** — add sad in catch. Find (line 3606–3611):
```javascript
  } catch (e) {
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-error').textContent = e.message;
  }
  btn.disabled = false;
}
```

Replace with:
```javascript
  } catch (e) {
    _cameraCapyState('sad');
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-error').textContent = e.message;
  }
  btn.disabled = false;
}
```

- [ ] **Step 4: Wire `_cameraCapyState` into `analyzeFood()` — first edit (add thinking)**

Find (line 3613–3616):
```javascript
async function analyzeFood() {
  if (!capturedImageBase64) return;
  navigate('analysis');
  document.getElementById('analysis-img').src = `data:${capturedMime};base64,${capturedImageBase64}`;
```

Replace with:
```javascript
async function analyzeFood() {
  if (!capturedImageBase64) return;
  navigate('analysis');
  _cameraCapyState('thinking');
  document.getElementById('analysis-img').src = `data:${capturedMime};base64,${capturedImageBase64}`;
```

- [ ] **Step 4b: Wire `_cameraCapyState` into `analyzeFood()` — second edit (add ecstatic + sad)**

Find (line 3643–3651):
```javascript
    if (rb) { rb.querySelectorAll('.receipt-entry').forEach(r => { r.style.animation = 'none'; r.offsetHeight; r.style.animation = ''; }); }
    document.getElementById('analysis-result').style.display = 'block';
  } catch (e) {
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-error').textContent = e.message;
  }
}
```

Replace with:
```javascript
    if (rb) { rb.querySelectorAll('.receipt-entry').forEach(r => { r.style.animation = 'none'; r.offsetHeight; r.style.animation = ''; }); }
    _cameraCapyState('ecstatic');
    setTimeout(() => _cameraCapyState('happy'), 2000);
    document.getElementById('analysis-result').style.display = 'block';
  } catch (e) {
    _cameraCapyState('sad');
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-error').textContent = e.message;
  }
}
```

- [ ] **Step 5: Verify in browser**

- Navigate to camera screen, then type text and submit → analysis screen shows capybara at top, body rocks with `?` while thinking, then bounces ecstatically when done
- On network error → capybara shows sad face
- Navigating back to camera and re-analyzing → capybara resets correctly to neutral, then thinking again

- [ ] **Step 6: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: add capybara to analysis screen with thinking/ecstatic/sad states"
```

---

## Task 7: Diary Screen Capybara

**Files:**
- Modify: `public/index.html:2210` (daily-summary-card HTML)
- Modify: `public/index.html:3358–3397` (`renderDailySummary`)

- [ ] **Step 1: Add `#pet-diary-wrap` inside `#daily-summary-card`**

Find (line 2229):
```html
    </div>

    <div class="card">
      <div class="card-title">ארוחות</div>
```

(End of `#daily-summary-card`). Find the closing `</div>` of `#daily-summary-card`. It is the `</div>` after the `#cal-goal-section` div. Insert `<div id="pet-diary-wrap">` as last child:

Find:
```html
      </div>
    </div>

    <div class="card">
      <div class="card-title">ארוחות</div>
```

Replace with:
```html
      </div>
      <div id="pet-diary-wrap" style="position:absolute;bottom:8px;left:8px;z-index:1;pointer-events:none"></div>
    </div>

    <div class="card">
      <div class="card-title">ארוחות</div>
```

- [ ] **Step 2: Add `getDiaryPetState()` and diary pet logic to `renderDailySummary()`**

Add the helper function near other pet helpers. Find `function getDiaryPetState` doesn't exist yet. Add before `renderDailySummary`:

Find:
```javascript
function renderDailySummary(entries) {
```

Insert before it:
```javascript
function getDiaryPetState(cal, goal) {
  if (cal === 0)              return 'sleeping';
  if (goal > 0 && cal > goal) return 'surprised';
  if (cal > 0)                return 'happy';
  return 'neutral';
}

```

- [ ] **Step 3: Add diary pet update at end of `renderDailySummary()`**

Find (line ~3393–3397, end of `renderDailySummary`):
```javascript
  } else {
    goalSection.style.display = 'none';
  }

}
```

Replace with:
```javascript
  } else {
    goalSection.style.display = 'none';
  }

  // Diary capybara
  const diaryWrapEl = document.getElementById('pet-diary-wrap');
  if (diaryWrapEl) {
    if (!diaryWrapEl.querySelector('svg')) {
      const pet = cloneCapybara(48);
      diaryWrapEl.appendChild(pet);
      _diaryPetWrap = pet;
      startIdleAnimations(pet);
    }
    const pet = diaryWrapEl.querySelector('.pet-wrap');
    if (pet) setPetState(pet, getDiaryPetState(totals.cal, calcRecommendedCal()));
  }
}
```

- [ ] **Step 4: Verify in browser**

- Diary screen with no meals today → capybara shows sleeping face, bottom-left of summary card
- Add a meal → capybara shows happy face
- If over calorie goal → capybara shows surprised face (wide eyes, O mouth)
- Tail wags and ear twitches randomly while on the screen

- [ ] **Step 5: Commit**

```bash
git add food-logger/public/index.html
git commit -m "feat: add capybara to diary daily-summary card with state-based expressions"
```

---

## Task 8: Final Verification + Push

- [ ] **Step 1: Full manual smoke test**

1. Log out → Welcome screen: logo SVG animates in (background scales, bowl drops, ingredients fall)
2. Log in → Dashboard: logo SVG present, capybara breathing
3. Wait 5–8s on dashboard → tail wag fires
4. Wait 8–12s → ear twitches
5. Navigate to Home (diary) → capybara in bottom-left of summary card
6. Navigate to Stats → walk is faster, bobs more, hops on turn
7. Navigate to Camera → text input, submit → Analysis screen: capybara rocks with `?`
8. On success → capybara bounces ecstatically, transitions to happy after 2s
9. Test with `prefers-reduced-motion: reduce` (Chrome DevTools → Rendering → Emulate CSS media) → all animations disabled, capybara static
10. Tab favicon shows capybara logo

- [ ] **Step 2: Push**

```bash
git push
```

---

## Notes for Implementer

- **No test suite** — this project has no automated tests. Manual browser verification is the only check.
- **Single file** — all changes to `public/index.html`. Be careful with the large file; read before editing.
- **`pet--thinking` is a modifier** — never pass `'thinking'` to `setPetState`. Only `_cameraCapyState` toggles it directly on the `.pet-wrap` element.
- **State pop conflict** — `setPetState` adds `pet-state-pop` which uses `transform: scale`. This overrides the `pet-breathe` animation briefly (250ms) and then releases it. No conflict with `pet--thinking` which uses `!important` — but `pet--thinking` should never overlap with `pet-state-pop` since thinking goes on the `.pet-wrap` inside the camera wrap.
- **Favicon** — line 13 already has `<link rel="icon" type="image/svg+xml" href="/icon.svg">`. Change the href to `/favicon.svg`; don't add a duplicate line.
- **Dashboard pet ref** — the dashboard capybara is in `#pet-dashboard-wrap`. Check the `loadDashboard` function for the exact cloneCapybara call location to add `_dashPetWrap` assignment.
