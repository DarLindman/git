# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Two things live here:

1. **Standalone Hebrew HTML files** — single-file apps opened directly in a browser (no build step).
2. **`food-logger/`** — a Node.js/Express PWA with a PostgreSQL backend and Claude AI nutritional analysis.

## food-logger

### Running

```bash
cd food-logger
npm run dev          # node --watch server.js (auto-restarts on change)
npm start            # node server.js (production)
```

### Required environment variables (`.env` in `food-logger/`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `ANTHROPIC_API_KEY` | Claude API key for food analysis |
| `ORIGIN` | Allowed CORS origin (defaults to `http://localhost:3000`) |
| `PORT` | Server port (defaults to `3000`) |

### Architecture

- **`server.js`** — single-file Express server: auth (JWT + bcrypt), food log CRUD, weight log CRUD, AI analysis endpoints, weekly/monthly/yearly stats, streak calculation, and PWA icon generation via `@napi-rs/canvas`.
- **`public/index.html`** — single-file SPA frontend (Hebrew RTL, dark theme). All CSS and JS are inline.
- **Database** — PostgreSQL, schema auto-created on startup via `initDB()`. Tables: `users`, `food_logs`, `weight_logs`, `user_profiles`.
- **AI** — `POST /api/analyze` (image) and `POST /api/analyze-text` (free text) call `claude-haiku-4-5-20251001` and return a JSON nutritional estimate. Rate limited to 20 requests/hour per user.

### Remotion logo (food-logger/remotion/)

Standalone Remotion project that renders the animated salad logo to `public/salad-logo.mp4`.

```bash
cd food-logger/remotion
npm run render    # renders to ../public/salad-logo.mp4
npm run studio    # opens Remotion Studio for preview
```

## Standalone HTML files

- **travel-presentation.html** — Slide-based travel presentation (East Asia/Ethiopia). Keyboard/click navigation, CSS transitions.
- **savings-dashboard.html** — Personal savings portfolio dashboard with a newspaper/parchment aesthetic.
- **recycling-game.html** — Drag-and-drop recycling sorting game with scoring.

No build step — edit and open directly in a browser. All CSS and JS are inline.

## Style conventions (all files)

- All UI text is in Hebrew; `dir="rtl"` and `lang="he"` on `<html>`
- CSS variables defined in `:root` for theming
- Error messages from the server are in Hebrew
