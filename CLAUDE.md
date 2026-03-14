# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A collection of standalone, self-contained Hebrew-language (RTL) HTML files. No build system, no dependencies, no package manager — open files directly in a browser.

## Files

- **travel-presentation.html** — Slide-based travel presentation about a trip to East Asia/Ethiopia. Uses keyboard/click navigation, CSS transitions between slides, and Hebrew RTL layout.
- **savings-dashboard.html** — Personal savings portfolio dashboard with a newspaper/parchment aesthetic. Hebrew RTL.
- **recycling-game.html** — Interactive recycling sorting game in Hebrew with drag-and-drop mechanics and a scoring system.
- **trip.json** — Raw trip data export (likely from a travel tracking service) for the "מזרח" (East) trip.

## Development

No build step. Edit HTML files directly and open in a browser to preview. All CSS and JavaScript are inline within each HTML file.

## Style Conventions

- All UI text is in Hebrew; `dir="rtl"` and `lang="he"` on `<html>`
- CSS variables defined in `:root` for theming
- Styles and scripts are embedded inline — no external JS files
