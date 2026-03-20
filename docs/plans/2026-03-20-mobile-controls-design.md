# Mobile Controls — Design Doc

**Date:** 2026-03-20
**Status:** Approved

## Goal

Make Vibetown Runner playable on mobile phones in landscape orientation with touch controls on either side of the canvas.

## Detection & Orientation

- Detect mobile: `'ontouchstart' in window || navigator.maxTouchPoints > 0`
- Portrait → full-screen "Rotate your phone" prompt, game hidden
- Landscape → 3-column layout with controls flanking the canvas
- Listen to `orientationchange` + `resize` to toggle between states
- Desktop → no changes, controls hidden

## Layout (Landscape)

```
┌──────┬───────────────────────────┬──────┐
│      │                           │      │
│ [↑]  │                           │[DIG] │
│[←][→]│      GAME CANVAS          │[LFV] │
│ [↓]  │      (centered)           │[DIG] │
│      │                           │      │
└──────┴───────────────────────────┴──────┘
  D-pad         fills middle         Actions
  ~15%            ~70%                ~15%
```

- CSS flexbox: 3-column row, `height: 100vh`
- Left column: D-pad centered vertically and horizontally
- Center: canvas scales to fill height, maintains aspect ratio, centered
- Right column: action buttons centered vertically
- Controls background: `#0a0a0a` (matches body)
- Only visible on mobile in landscape

## Touch Controls

### D-pad (Left Side)
- 4 directional buttons in cross layout
- Pixel art sprites (provided by Taylor)
- Minimum 48px touch targets
- Semi-transparent styling

### Action Buttons (Right Side)
- Dig Left (top)
- LFV / Shoot (middle) — context-dependent, same button
- Dig Right (bottom)
- Pixel art sprites (provided by Taylor)
- Semi-transparent styling

## Input Integration

Touch controls feed directly into the existing `InputManager`:
- `touchstart` → `inputManager.handleKeyDown(key)`
- `touchend` / `touchcancel` → `inputManager.handleKeyUp(key)`

Key mapping:
- D-pad Up → `ArrowUp`
- D-pad Down → `ArrowDown`
- D-pad Left → `ArrowLeft`
- D-pad Right → `ArrowRight`
- Dig Left → `z`
- Dig Right → `c`
- LFV/Shoot → ` ` (space)

Zero changes to GameManager or any game logic.

## Rotation Prompt

- Full-screen overlay, z-index 100
- Dark background with centered phone icon + "Rotate your phone" text
- Shown when mobile + portrait detected
- Hidden when landscape detected
- Pixel art styled text (Brice font, gold color)

## Menu on Mobile

- Menu buttons already work with touch (HTML click handlers)
- HUD MENU button already handles click/touch
- Score submission works with mobile keyboard
- No menu changes needed

## Files Changed

- `index.html` — rotation prompt HTML/CSS, touch control HTML, mobile layout CSS
- `src/main.ts` — mobile detection, touch event wiring, orientation handling
- No game logic changes (Input.ts, GameManager.ts, etc. untouched)

## Pixel Art Assets Needed

- D-pad sprite (or individual arrow buttons)
- Dig Left button sprite
- Dig Right button sprite
- LFV/Shoot button sprite
- Taylor is creating these
