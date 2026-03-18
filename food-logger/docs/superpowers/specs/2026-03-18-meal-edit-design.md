# Meal Edit Feature — Design Spec
**Date:** 2026-03-18
**Status:** Approved

## Overview
Allow users to edit previously logged meals from the diary screen. Editing opens a modal pre-filled with the meal's existing values. The user can change any field manually, rename the meal and save without recalculating, or rename and trigger an AI recalculation.

## Trigger
Tapping anywhere on a meal row in the diary (`screen-home`) opens the edit modal. The existing delete button gets `event.stopPropagation()` so it does not trigger the modal.

## Modal Layout
- **Header:** "עריכת מנה" (RTL) + X close button
- **Fields (pre-filled from existing entry):**
  - Food name (text input)
  - Calories (number input)
  - Protein g, Carbs g, Fat g, Fiber g (number inputs)
  - Meal type — pill buttons with Hebrew labels; each button carries `data-meal` with one of the four English DB values: `breakfast`, `lunch`, `dinner`, `snack`
  - Time (time input, HH:MM) — pre-filled with `entry.logged_at.slice(11, 16)` (the stored HH:MM portion, same pattern the diary already uses for display)
- **`notes`:** Not displayed. Populated into `_editNotes` at modal-open from the existing entry (may be `null`). Sent verbatim in every PUT request; server accepts `null`.

## Button Logic

| Name changed vs `_editOriginalName`? | Buttons |
|---|---|
| No | `[שמור]` |
| Yes | `[חשב מחדש]` + `[שמור מבלי לחשב מחדש]` |

Name comparison: strict string equality (`===`), case-sensitive, no trimming. `_editOriginalName` is set once at modal-open and never reset during the session.

## "חשב מחדש" Flow

1. Set `_editAnalyzing = true`. Show loading spinner on button. Disable X button (visually grayed out, non-interactive).
2. Call `POST /api/analyze-text` with the current food name input value.
3. **Success:** Fill number fields (calories, protein_g, carbs_g, fat_g, fiber_g) and the food name input with the AI-returned `foodName`. Set `_editAnalyzing = false`, re-enable X. Button row becomes `[שמור]` (user must explicitly save). `_editOriginalName` is NOT reset.
4. **429 (rate limit):** Show Hebrew toast: `"הגעת למגבלת הניתוחים לשעה זו"`. Set `_editAnalyzing = false`, re-enable X. No field changes.
5. **Other error:** Show Hebrew toast with error message. Set `_editAnalyzing = false`, re-enable X. No field changes.

Note: "חשב מחדש" consumes from the same shared `analyzeLimiter` quota (20 req/hour per user) as image and text analysis.

## "שמור" / "שמור מבלי לחשב מחדש"

Frontend assembles `logged_at` as:
`_editOriginalDate + 'T' + timeInputValue + ':00'`

`_editOriginalDate` is populated at modal-open using `entry.logged_at.slice(0, 10)` — the same naive slice the existing POST flow uses (via `todayStr()`). This is intentionally consistent with the existing timezone behaviour of the app: the stored timestamp string is used as-is, without additional timezone conversion, so the date is preserved exactly as stored. Only the time of day portion is editable.

Calls `PUT /api/food/:id` (see below). On success: close modal, refresh diary list and daily summary. On non-2xx response: show Hebrew toast `"שגיאה בשמירה"`, keep modal open. Numeric validation is server-side only (consistent with existing POST behavior).

## Close Behaviour
- X button click or backdrop click: closes immediately **unless** `_editAnalyzing` is true, in which case X is disabled and backdrop click does nothing.
- Unsaved changes are silently discarded (consistent with existing app UX — no confirmation dialogs anywhere in the app).
- Focus management (trap, initial focus): out of scope — app is touch-primary PWA.

## Server — New Endpoint

```
PUT /api/food/:id
Auth: required (JWT)
Body JSON: {
  food_name: string,           // trimmed, max 200 chars
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
  fiber_g: number,
  meal_type: string,           // must be one of: breakfast, lunch, dinner, snack
  logged_at: ISO timestamp string,
  notes: string | null
}
Validation:
  - food_name: trimmed, max 200 chars (return 400 if empty or too long)
  - meal_type: validated against ['breakfast','lunch','dinner','snack']; return 400 if invalid
  - Numeric fields: same clamp/safety guards as POST /api/food
  - logged_at: parsed as timestamptz; if invalid or missing, fallback to existing DB value
Ownership: WHERE id=$1 AND user_id=$2
  - Returns 404 if not found or not owned (consistent with DELETE /api/food/:id)
Response: updated row JSON (same shape as GET /api/food response)
```

## Frontend State Variables

| Variable | Type | Purpose |
|---|---|---|
| `_editEntryId` | number | ID of entry being edited |
| `_editOriginalName` | string | Food name at modal-open; baseline for change detection |
| `_editOriginalDate` | string | `entry.logged_at.slice(0, 10)` — date portion of stored timestamp, used to reconstruct `logged_at` on save |
| `_editNotes` | string\|null | Existing notes value; passed through unchanged in PUT body |
| `_editAnalyzing` | boolean | True while analyze-text is in-flight; blocks close and disables X |

## `renderMealList` Changes
- Each meal row: add `style="cursor:pointer"` and `onclick="openEditModal(<serialized entry>)"`.
- Delete button: add `event.stopPropagation()` before `deleteEntry(id)`.

## Edit Modal HTML
New `<div id="edit-modal">` in body (outside all screens, similar to `#capy-popup`):
```
.edit-modal-overlay  — position:fixed, full-screen, semi-transparent backdrop
  .edit-modal-sheet  — centered card (max-width ~400px), onclick stopPropagation
    header
    form fields
    footer buttons
```

## Out of Scope
- Unsaved-changes confirmation dialog
- Editing the `notes` field
- Keyboard focus trap / accessibility
- Bulk editing
- Edit history / undo
- Editing entries from dashboard log preview
