# Design: Image Analysis Token Efficiency

**Date:** 2026-03-17
**Status:** Approved

## Problem

Each image analysis request makes 2 API calls, both sending the full image:
- Call 1 (nutrition): ~2100 tokens (estimate)
- Call 2 (naming): ~1550 tokens — image sent again (estimate)

Total: ~3650 tokens per request. ~1200 of those are wasted sending the same image twice.

## Solution

### 1. Merge both API calls into one (server.js)

Call 1 returns a single JSON **object** instead of a bare array:

```json
{
  "dish_name": "שניצל עם שעועית ירוקה",
  "items": [
    {"name": "שניצל", "weight_g": 150, "calories": 350, "protein_g": 25, "carbs_g": 20, "fat_g": 18, "fiber_g": 0},
    {"name": "שעועית ירוקה", "weight_g": 100, "calories": 30, "protein_g": 2, "carbs_g": 5, "fat_g": 0, "fiber_g": 3}
  ]
}
```

**System prompt addition:** `dish_name` in everyday spoken Hebrew, up to 10 words, use full dish context for identification (e.g. red meat + seaweed + avocado = tuna, not beef), no "בצלחת יש", no cooking doneness descriptions.

**Parsing change:** The current parser uses `raw.match(/\[[\s\S]*\]/)` to extract a JSON array. The new parser:
1. Tries `raw.match(/\{[\s\S]*\}/)` and `JSON.parse()` on the full object
2. Extracts `parsed.items` as the items array
3. Extracts `parsed.dish_name` as the food name (fallback: `'מנה'`)
4. Keeps existing `cleanHebrew` sanitization on item names only — `dish_name` is not passed through `cleanHebrew` since it may legitimately contain spaces and punctuation that `cleanHebrew` would strip

**Call 2 removed entirely.** `ensureHebrewFoodName` is unaffected — it is only used by `/api/analyze-text`, not by `/api/analyze`.

### 2. Reduce client-side resize threshold (index.html)

A resize already exists in `onImageSelected()` at line 3107: `const MAX = 1200` at JPEG quality 0.8. Change `MAX` from `1200` to `1024`. No new function needed. Images ≤1024px on the longest side are untouched. Post-resize images are always JPEG regardless of input format (this is already the case — `capturedMime` is hardcoded to `'image/jpeg'`).

## Files Changed

- `food-logger/server.js` — `/api/analyze` endpoint only
  - Update system prompt: add `dish_name` instructions
  - Update user message JSON template to include `dish_name` at top level
  - Update parser: match `{...}` instead of `[...]`, extract `items` and `dish_name`
  - Remove Call 2 entirely (lines ~307–320)
  - Response: `res.json({ foodName: dishName, ...totals })`

- `food-logger/public/index.html` — `onImageSelected()` only
  - Change `const MAX = 1200` → `const MAX = 1024`

## Expected Token Savings (estimates)

| | Before | After | Saved |
|---|---|---|---|
| Image tokens (per call) | ~1000 | ~650 (smaller image) | ~350 |
| Call 1 total | ~2100 | ~1350 | ~750 |
| Call 2 total | ~1550 | eliminated | ~1550 |
| **Per request** | **~3650** | **~1350** | **~63%** |

Numbers are estimates based on reported token counts. Actual savings depend on image content and size.

## UX Impact

Single call instead of two sequential calls. Response latency profile changes: one slightly longer wait instead of two shorter ones. Total wait time is shorter overall. No change to UI flow.

## Verification

1. Upload a food image → verify dish name appears correctly
2. Verify nutritional values are correct
3. Check Railway logs — token count should be ~1200-1500 per request (down from ~3650)
