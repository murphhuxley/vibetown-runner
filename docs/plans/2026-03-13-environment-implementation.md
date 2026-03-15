# Environment Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace flat single-palette tile rendering with per-level themed environments using GVC brand colors.

**Architecture:** New `Themes.ts` module defines 5 level palettes. Renderer gains a `theme` property and all draw methods use it. Level JSONs gain a `theme` field. PNG tile sprites are loaded when available, with enhanced Canvas 2D as fallback.

**Tech Stack:** TypeScript, HTML5 Canvas 2D, Vite (existing stack — no new dependencies)

---

### Task 1: Create Themes module

**Files:**
- Create: `src/engine/Themes.ts`

**Step 1: Create the LevelTheme interface and 5 theme palettes**

```typescript
import { COLORS } from '@/constants';

export interface LevelTheme {
  name: string;
  // Background
  bgTop: string;
  bgBottom: string;
  // Sand (diggable brick)
  sandFill: string;
  sandLine: string;
  sandHighlight: string;
  sandShadow: string;
  // Coral (solid brick)
  coralFill: string;
  coralHighlight: string;
  coralShadow: string;
  // Accents
  ladder: string;
  rope: string;
  badgeFill: string;
  badgeGlow: string;
  badgeText: string;
}

export const THEMES: Record<string, LevelTheme> = {
  beach: {
    name: 'Beach Boardwalk',
    bgTop: COLORS.cream,
    bgBottom: COLORS.sand,
    sandFill: COLORS.sand,
    sandLine: COLORS.darkSand,
    sandHighlight: '#E0D4BA',
    sandShadow: COLORS.bamboo,
    coralFill: COLORS.bamboo,
    coralHighlight: COLORS.darkSand,
    coralShadow: '#8A7548',
    ladder: COLORS.bamboo,
    rope: COLORS.olive,
    badgeFill: COLORS.gold,
    badgeGlow: COLORS.vibestrGold,
    badgeText: COLORS.black,
  },
  reef: {
    name: 'Coral Reef',
    bgTop: COLORS.skyBlue,
    bgBottom: COLORS.oceanBlue,
    sandFill: COLORS.dustyRose,
    sandLine: COLORS.coral,
    sandHighlight: '#C99A8F',
    sandShadow: '#9A6B60',
    coralFill: COLORS.coral,
    coralHighlight: COLORS.dustyRose,
    coralShadow: '#A5625A',
    ladder: COLORS.cream,
    rope: COLORS.silver,
    badgeFill: COLORS.vibestrGold,
    badgeGlow: COLORS.cream,
    badgeText: COLORS.black,
  },
  jungle: {
    name: 'Palm Jungle',
    bgTop: COLORS.palmGreen,
    bgBottom: COLORS.olive,
    sandFill: COLORS.green,
    sandLine: COLORS.olive,
    sandHighlight: '#6B8E50',
    sandShadow: '#2E2E1F',
    coralFill: COLORS.olive,
    coralHighlight: COLORS.green,
    coralShadow: '#1F1F15',
    ladder: COLORS.bamboo,
    rope: COLORS.palmGreen,
    badgeFill: COLORS.gold,
    badgeGlow: COLORS.palmGreen,
    badgeText: COLORS.black,
  },
  sunset: {
    name: 'Sunset Pier',
    bgTop: COLORS.vibestrGold,
    bgBottom: COLORS.coral,
    sandFill: COLORS.darkSand,
    sandLine: COLORS.bamboo,
    sandHighlight: COLORS.sand,
    sandShadow: COLORS.coral,
    coralFill: COLORS.dustyRose,
    coralHighlight: COLORS.coral,
    coralShadow: '#8A5F55',
    ladder: COLORS.cream,
    rope: COLORS.silver,
    badgeFill: COLORS.cream,
    badgeGlow: COLORS.vibestrGold,
    badgeText: COLORS.black,
  },
  deep: {
    name: 'Deep Ocean',
    bgTop: COLORS.oceanBlue,
    bgBottom: COLORS.black,
    sandFill: COLORS.silver,
    sandLine: COLORS.oceanBlue,
    sandHighlight: '#B0B5BD',
    sandShadow: '#6A7078',
    coralFill: COLORS.oceanBlue,
    coralHighlight: COLORS.skyBlue,
    coralShadow: '#2D5563',
    ladder: COLORS.silver,
    rope: COLORS.skyBlue,
    badgeFill: COLORS.vibestrGold,
    badgeGlow: COLORS.skyBlue,
    badgeText: COLORS.black,
  },
};

export function getTheme(name: string): LevelTheme {
  return THEMES[name] ?? THEMES.beach;
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/murphhuxley/.openclaw/workspace/projects/vibetown-runner && npx tsc --noEmit`
Expected: No errors

---

### Task 2: Add theme field to level data

**Files:**
- Modify: `src/types.ts:82-89` — add `theme` to `LevelData`
- Modify: `src/game/Level.ts:24-31` — pass through theme in `parseLevel`
- Modify: `src/levels/level-01.json` — add `"theme": "beach"`
- Modify: `src/levels/level-02.json` — add `"theme": "reef"`
- Modify: `src/levels/level-03.json` — add `"theme": "jungle"`
- Modify: `src/levels/level-04.json` — add `"theme": "sunset"`
- Modify: `src/levels/level-05.json` — add `"theme": "deep"`

**Step 1: Add theme to LevelData interface**

In `src/types.ts`, add `theme?: string;` to the `LevelData` interface after `par`.

**Step 2: Pass theme through parseLevel**

In `src/game/Level.ts`, destructure `theme` from `raw` and include `theme: theme ?? 'beach'` in the return object.

**Step 3: Add theme field to each level JSON**

Add `"theme": "<name>"` to each JSON file at the top level.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

---

### Task 3: Wire theme into Renderer

**Files:**
- Modify: `src/engine/Renderer.ts:1-25` — import theme, add property + setter
- Modify: `src/main.ts` — import getTheme, call setTheme on level load

**Step 1: Add theme property to Renderer**

Add import for `LevelTheme` and `getTheme` from `@/engine/Themes`. Add property:
```typescript
private theme: LevelTheme = getTheme('beach');
```

Add setter method:
```typescript
setTheme(theme: LevelTheme): void {
  this.theme = theme;
}
```

**Step 2: Call setTheme from main.ts on level transitions**

In `main.ts`, import `getTheme` from `@/engine/Themes`. After every `game.loadLevel()` call and `game.restart()`, add:
```typescript
renderer.setTheme(getTheme(game.state.level.theme ?? 'beach'));
```

There are 4 places: initial constructor (after GameManager creation), Dead retry, LevelComplete next, GameOver/Victory restart.

Also set it once after `const renderer = new Renderer(ctx)`:
```typescript
renderer.setTheme(getTheme(game.state.level.theme ?? 'beach'));
```

**Step 3: Verify it compiles and game still runs**

Run: `npx tsc --noEmit`
Visual check: open http://localhost:3337 — should look identical (theme defaults match current colors).

---

### Task 4: Theme the background

**Files:**
- Modify: `src/engine/Renderer.ts` — refactor `clear()` method

**Step 1: Replace flat fill with gradient**

Replace the `clear()` method:

```typescript
clear(): void {
  const ctx = this.ctx;
  const h = (GRID_ROWS + 1) * TILE_SIZE;
  const grad = ctx.createLinearGradient(0, 0, 0, GRID_ROWS * TILE_SIZE);
  grad.addColorStop(0, this.theme.bgTop);
  grad.addColorStop(1, this.theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, GRID_ROWS * TILE_SIZE);
  // HUD area stays black
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(0, GRID_ROWS * TILE_SIZE, CANVAS_WIDTH, TILE_SIZE);
}
```

**Step 2: Visual check**

Level 1 should show cream→sand gradient. Navigate to later levels (via debug `__game.loadLevel(1)` etc.) to verify each theme's background.

---

### Task 5: Theme the Sand tiles

**Files:**
- Modify: `src/engine/Renderer.ts` — refactor `drawSand()` method

**Step 1: Enhanced sand rendering with theme colors**

Replace `drawSand()`:

```typescript
private drawSand(px: number, py: number): void {
  const ctx = this.ctx;
  const t = this.theme;

  // Main fill
  ctx.fillStyle = t.sandFill;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  // Top highlight strip
  ctx.fillStyle = t.sandHighlight;
  ctx.fillRect(px, py, TILE_SIZE, 3);

  // Bottom shadow strip
  ctx.fillStyle = t.sandShadow;
  ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);

  // Brick-line pattern
  ctx.strokeStyle = t.sandLine;
  ctx.lineWidth = 1;

  // Horizontal line at middle
  ctx.beginPath();
  ctx.moveTo(px, py + TILE_SIZE / 2);
  ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
  ctx.stroke();

  // Vertical lines offset for brick pattern
  ctx.beginPath();
  ctx.moveTo(px + TILE_SIZE / 2, py);
  ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px + TILE_SIZE / 4, py + TILE_SIZE / 2);
  ctx.lineTo(px + TILE_SIZE / 4, py + TILE_SIZE);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px + (TILE_SIZE * 3) / 4, py + TILE_SIZE / 2);
  ctx.lineTo(px + (TILE_SIZE * 3) / 4, py + TILE_SIZE);
  ctx.stroke();
}
```

**Step 2: Visual check** — bricks should have highlight/shadow depth per theme.

---

### Task 6: Theme the Coral, Ladder, Rope, and Badge tiles

**Files:**
- Modify: `src/engine/Renderer.ts` — refactor `drawCoral()`, `drawLadder()`, `drawRope()`, `drawBadge()`

**Step 1: Enhanced coral rendering**

```typescript
private drawCoral(px: number, py: number): void {
  const ctx = this.ctx;
  const t = this.theme;

  ctx.fillStyle = t.coralFill;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  // Top highlight
  ctx.fillStyle = t.coralHighlight;
  ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, 4);

  // Bottom shadow
  ctx.fillStyle = t.coralShadow;
  ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
}
```

**Step 2: Themed ladder**

Replace `COLORS.bamboo` with `this.theme.ladder` in `drawLadder()`.

**Step 3: Themed rope**

Replace `COLORS.olive` with `this.theme.rope` in `drawRope()`.

**Step 4: Enhanced badge with glow**

```typescript
private drawBadge(px: number, py: number): void {
  const ctx = this.ctx;
  const t = this.theme;
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;
  const radius = TILE_SIZE / 3;

  // Glow ring
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = t.badgeGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Badge circle
  ctx.fillStyle = t.badgeFill;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Letter
  ctx.fillStyle = t.badgeText;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', cx, cy + 1);
}
```

**Step 5: Visual check** — verify all tile types pick up theme colors across all 5 levels.

---

### Task 7: PNG tile sprite support (optional upgrade path)

**Files:**
- Modify: `src/engine/Renderer.ts` — add tile sprite loading + fallback logic

**Step 1: Add tile sprite properties**

```typescript
private sandTile: HTMLImageElement | null = null;
private coralTile: HTMLImageElement | null = null;
```

**Step 2: Add loadTileSprites method**

```typescript
loadTileSprites(theme: string): void {
  const base = '/assets/tiles/';
  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null as any); // silent fallback
      img.src = src;
    });

  loadImg(base + theme + '-sand.png').then(img => { this.sandTile = img; });
  loadImg(base + theme + '-coral.png').then(img => { this.coralTile = img; });
}
```

**Step 3: Use tile sprites in drawSand/drawCoral when available**

At the top of `drawSand()`:
```typescript
if (this.sandTile) {
  this.ctx.drawImage(this.sandTile, px, py, TILE_SIZE, TILE_SIZE);
  return;
}
```

Same pattern for `drawCoral()` with `this.coralTile`.

**Step 4: Call loadTileSprites in setTheme**

```typescript
setTheme(theme: LevelTheme, themeKey: string): void {
  this.theme = theme;
  this.sandTile = null;
  this.coralTile = null;
  this.loadTileSprites(themeKey);
}
```

Update all `setTheme` call sites to pass the theme key string.

**Step 5: Create empty tiles directory**

```bash
mkdir -p public/assets/tiles
```

**Step 6: Visual check** — game should work identically (no PNGs exist yet, fallback to Canvas).

---

### Task 8: Final visual pass and commit

**Step 1: Playtest all 5 levels**

Navigate through all levels via gameplay or debug console (`__game.loadLevel(0)` through `__game.loadLevel(4)`). Verify:
- Each level has a distinct background gradient
- Sand/coral tiles match the zone's mood
- Ladders, ropes, badges pick up theme accents
- HUD still reads clearly
- Death/LevelComplete overlays look good over each background

**Step 2: Tweak any colors that don't look right**

Adjust hex values in `THEMES` as needed.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: per-level themed environments with GVC brand palette

- 5 distinct zones: Beach, Coral Reef, Jungle, Sunset, Deep Ocean
- Background gradients, themed brick textures, accent-colored tiles
- PNG tile sprite support (loads when available, Canvas 2D fallback)
- Badge glow effect per theme"
```
