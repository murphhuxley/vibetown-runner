# Environment Redesign — Vibetown Runner

**Date:** 2026-03-13
**Approach:** Hybrid (PNG tile sprites + enhanced Canvas 2D)
**Inspiration:** Dark Light atmosphere (retro-tropical translation), GVC brand palette

---

## Goal

Replace flat, single-palette tile rendering with per-level themed environments. Each level is a distinct zone of Vibetown with its own color mood, background gradient, brick textures, and accent colors — all drawn from the GVC brand palette.

---

## Per-Level Themes

### Level 1 — Beach Boardwalk
- **Mood:** Bright, welcoming, tutorial vibes
- **Background:** Cream `#F2EDE8` → Sand `#D4C5A9` top-to-bottom gradient
- **Sand tiles:** Sand `#D4C5A9` fill, Dark Sand `#B8A88A` brick lines, Bamboo `#A68B5B` shadow
- **Coral tiles:** Bamboo `#A68B5B` fill, Dark Sand `#B8A88A` highlight
- **Ladders:** Bamboo `#A68B5B`
- **Ropes:** Olive `#3D3D2B`
- **Badges:** Gold `#E8C547` with Vibestr Gold `#F5D76E` glow

### Level 2 — Coral Reef
- **Mood:** Cool underwater feel
- **Background:** Sky Blue `#87BACC` → Ocean Blue `#4A7B8C` gradient
- **Sand tiles:** Dusty Rose `#B8867B` fill, Coral `#C47A6C` brick lines, darker shadow
- **Coral tiles:** Coral `#C47A6C` fill, Dusty Rose `#B8867B` highlight
- **Ladders:** Cream `#F2EDE8`
- **Ropes:** Silver `#9BA0A8`
- **Badges:** Vibestr Gold `#F5D76E` with Cream `#F2EDE8` glow

### Level 3 — Palm Jungle
- **Mood:** Dense, green, mysterious
- **Background:** Palm Green `#6B8E50` → Olive `#3D3D2B` gradient
- **Sand tiles:** Green `#5A7247` fill, Olive `#3D3D2B` brick lines, dark shadow
- **Coral tiles:** Olive `#3D3D2B` fill, Green `#5A7247` highlight
- **Ladders:** Bamboo `#A68B5B`
- **Ropes:** Palm Green `#6B8E50`
- **Badges:** Gold `#E8C547` with Palm Green `#6B8E50` glow

### Level 4 — Sunset Pier
- **Mood:** Warm golden hour glow
- **Background:** Vibestr Gold `#F5D76E` → Coral `#C47A6C` gradient
- **Sand tiles:** Dark Sand `#B8A88A` fill, Bamboo `#A68B5B` brick lines, Coral shadow
- **Coral tiles:** Dusty Rose `#B8867B` fill, Coral `#C47A6C` highlight
- **Ladders:** Cream `#F2EDE8`
- **Ropes:** Silver `#9BA0A8`
- **Badges:** Cream `#F2EDE8` with Vibestr Gold `#F5D76E` glow

### Level 5 — Deep Ocean
- **Mood:** Deep, atmospheric, final boss energy
- **Background:** Ocean Blue `#4A7B8C` → Black `#141414` gradient
- **Sand tiles:** Silver `#9BA0A8` fill, Ocean Blue `#4A7B8C` brick lines, dark shadow
- **Coral tiles:** Ocean Blue `#4A7B8C` fill, Sky Blue `#87BACC` highlight
- **Ladders:** Silver `#9BA0A8`
- **Ropes:** Sky Blue `#87BACC`
- **Badges:** Vibestr Gold `#F5D76E` with Sky Blue `#87BACC` glow

---

## Rendering Strategy

### PNG Tile Sprites (when available)
- Location: `public/assets/tiles/{theme}-sand.png`, `{theme}-coral.png`
- 32x32 pixel art, generated via Retro Diffusion
- Renderer checks for sprite existence, falls back to Canvas 2D

### Enhanced Canvas 2D (fallback + default)
- **Bricks (Sand):** Fill + highlight stripe (top 4px) + shadow stripe (bottom 2px) + brick-line pattern with theme colors
- **Solid (Coral):** Fill + highlight stripe + subtle edge shadow
- **Background:** Vertical linear gradient using theme's two background colors
- **Ladders:** Theme-colored rails + rungs
- **Ropes:** Theme-colored horizontal line
- **Badges:** Circle fill + glow ring (theme badge glow color) + "B" text

### HUD
- Stays as-is (black bar, cream text, vibe meter)
- Vibe meter fill color adapts to theme accent

---

## Data Changes

Add `theme` field to level JSON files:

```json
{ "id": 1, "name": "Welcome to Vibetown", "theme": "beach", ... }
{ "id": 2, "name": "...", "theme": "reef", ... }
{ "id": 3, "name": "...", "theme": "jungle", ... }
{ "id": 4, "name": "...", "theme": "sunset", ... }
{ "id": 5, "name": "...", "theme": "deep", ... }
```

---

## Code Changes

### New: `src/engine/Themes.ts`
- `LevelTheme` interface with all color slots
- `THEMES` map: `Record<string, LevelTheme>`
- `getTheme(name: string): LevelTheme` helper

### Modified: `src/engine/Renderer.ts`
- Add `theme: LevelTheme` property
- Add `setTheme(theme: LevelTheme)` method
- Refactor `clear()` to draw background gradient
- Refactor `drawSand()`, `drawCoral()`, `drawLadder()`, `drawRope()`, `drawBadge()` to use `this.theme`
- Add PNG tile sprite loading with Canvas fallback

### Modified: `src/types.ts`
- Add `theme?: string` to `LevelData` interface

### Modified: `src/game/GameManager.ts`
- Pass theme to renderer on `loadLevel()`

### Modified: `src/main.ts`
- Call `renderer.setTheme()` when level loads

### Modified: `src/levels/level-01.json` through `level-05.json`
- Add `theme` field
