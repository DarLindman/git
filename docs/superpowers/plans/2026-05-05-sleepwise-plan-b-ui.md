# SleepWise — Plan B: UI Screens

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans

**Goal:** Build all 4 tab screens with the Aurora design system — animated gradient background, Gloock typography, sleep graph, and full Hebrew/English support.

**Architecture:** Expo Router tabs. Shared `AuroraBackground` + `SleepGraph` components. All screens read from services built in Plan A. State managed with React hooks + AsyncStorage.

**Tech Stack:** expo-router, expo-linear-gradient, react-native-reanimated, @expo-google-fonts/*, expo-font

---

## Tasks
1. Fonts + design components (AuroraBackground, SleepGraph)
2. Tab navigation rebuild
3. Tonight screen (3 states)
4. History screen
5. Statistics screen
6. Settings screen
7. Background alarm task wiring
