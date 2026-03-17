# Design: Image Analysis Token Efficiency

**Date:** 2026-03-17
**Status:** Approved

## Problem

Each image analysis request makes 2 API calls, both sending the full image:
- Call 1 (nutrition): ~2100 tokens
- Call 2 (naming): ~1550 tokens (image sent again)

Total: ~3650 tokens per request. ~1200 of those are wasted on sending the same image twice.

## Solution

Two changes, combined:

### 1. Merge both API calls into one (server.js)

Call 1 returns a single JSON object with **both** the dish name and the items array:

```json
{
  "dish_name": "שניצל עם שעועית ירוקה",
  "items": [
    {"name": "שניצל", "weight_g": 150, "calories": 350, ...},
    {"name": "שעועית ירוקה", "weight_g": 100, "calories": 30, ...}
  ]
}
```

The system prompt instructs the model to:
- Include `dish_name`: everyday Hebrew, up to 10 words, use full dish context for identification, no "בצלחת יש"
- Include `items[]`: same nutrition breakdown as before

Call 2 is removed entirely. Saves ~1550 tokens per request.

### 2. Resize image client-side before upload (index.html)

Before `analyzeFood()` sends the image, resize it to max 1024px on the longest side using the Canvas API. Images already smaller than 1024px are untouched.

```javascript
async function resizeImageForUpload(dataUrl, mimeType) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      if (scale === 1) return resolve(dataUrl); // already small enough
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}
```

Saves ~40% of image tokens in Call 1.

## Files Changed

- `food-logger/server.js` — `/api/analyze` endpoint
  - Remove Call 2 entirely
  - Update Call 1 system prompt to include `dish_name` instructions
  - Update user message JSON schema to include `dish_name` at top level
  - Parse `dish_name` from response JSON
  - Update response: `res.json({ foodName: data.dish_name, ...totals })`

- `food-logger/public/index.html` — `analyzeFood()` function
  - Add `resizeImageForUpload()` helper
  - Call it before sending `capturedImageBase64` to server

## Expected Token Savings

| Before | After | Saved |
|--------|-------|-------|
| Call 1: ~2100 | Call 1: ~1300 | ~800 (image resize) |
| Call 2: ~1550 | Eliminated | ~1550 |
| **Total: ~3650** | **~1300** | **~64%** |

## Verification

1. Upload an image → verify dish name appears
2. Verify nutritional values are still correct
3. Check Railway logs for token counts — should be ~1200-1400 per request
