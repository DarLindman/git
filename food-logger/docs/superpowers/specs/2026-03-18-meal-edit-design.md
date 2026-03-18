# Meal Edit Feature — Design Spec
**Date:** 2026-03-18
**Status:** Approved

## Overview
Allow users to edit previously logged meals from the diary screen. Editing opens a modal pre-filled with the meal's existing values. The user can change any field manually, rename the meal and save without recalculating, or rename and trigger an AI recalculation.

## Trigger
Tapping a meal row in the diary (`screen-home`) opens the edit modal. The existing delete button remains unchanged.

## Modal Layout
- **Header:** "עריכת מנה" (RTL) + X close button
- **Fields (pre-filled from existing entry):**
  - Food name (text input)
  - Calories (number input)
  - Protein g (number input)
  - Carbs g (number input)
  - Fat g (number input)
  - Fiber g (number input)
  - Meal type selector (בוקר / צהריים / ערב / חטיף) — same pill buttons as analysis screen
  - Time (time input)
- **Footer buttons** — dynamic based on whether the name has changed:

| Name changed? | Buttons shown |
|---|---|
| No | `[שמור]` |
| Yes | `[חשב מחדש]` `[שמור מבלי לחשב מחדש]` |

## Button Behaviour

### "שמור" / "שמור מבלי לחשב מחדש"
Calls `PUT /api/food/:id` with all current field values. Closes modal on success, refreshes diary list.

### "חשב מחדש"
1. Calls `POST /api/analyze-text` with the new food name.
2. On response: fills number fields (calories, protein, carbs, fat, fiber) with AI values.
3. User may further edit the auto-filled values.
4. Button row changes to `[שמור]` — user must explicitly save.

## Server — New Endpoint
```
PUT /api/food/:id
Auth: required (JWT)
Body: { food_name, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, logged_at }
Validation: same numeric guards as POST /api/food
Ownership: WHERE id=$1 AND user_id=$2 (returns 404 if not found)
Response: updated row
```

## Frontend Changes

### `renderMealList`
Each meal row becomes clickable (cursor pointer). Clicking calls `openEditModal(entry)`.

### Edit Modal
- New `<div id="edit-modal">` added to HTML (hidden by default, `position: fixed`, full-screen overlay with centered content panel).
- Reuses existing CSS variables and input styles from the analysis screen.
- `openEditModal(entry)` — populates all fields, stores `originalName`, shows modal.
- Name input `oninput` — compares to `originalName`; toggles button visibility.
- Modal closes on X button, backdrop click, or successful save.

### State Tracking
- `_editEntryId` — id of the entry being edited.
- `_editOriginalName` — original food name to detect changes.

## Error Handling
- "חשב מחדש" shows a loading state on the button; reverts on API error with Hebrew toast.
- Save failure shows Hebrew toast, keeps modal open.
- Network/auth errors surface via existing `showToast`.

## Out of Scope
- Bulk editing
- Edit history / undo
- Editing entries from other screens (dashboard log preview)
