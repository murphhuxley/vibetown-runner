# Vibetown Runner

## Project Overview
GVC-themed Lode Runner browser game. 25 levels across 9 districts, PixelLab pixel art assets, Convex-backed leaderboard/auth. Vanilla TypeScript + Canvas 2D.

**Live:** https://vibetownrunner.com | **GitHub:** murphhuxley/vibetown-runner | **Dev port:** 3337

## Stack
- **Language:** TypeScript 5.9.3
- **Build:** Vite 8.0.0 (port 3337, path alias @/)
- **Runtime:** Vanilla JS + Canvas 2D (no game engine)
- **Backend:** Convex (leaderboard, auth)
- **Testing:** Vitest 4.1.0
- **PWA:** Service worker, manifest for offline/install

## Architecture

### Game Loop (`src/engine/GameLoop.ts`)
`requestAnimationFrame` with capped delta (50ms max). Two-phase: update(dt) -> render() -> repeat.

### GameManager (`src/game/GameManager.ts`)
Owns GameState: player, ducks, grid, score, level, holes. Phases: Menu, Playing, Paused, LevelComplete, Dead, GameOver, Victory. Tick-based movement with render interpolation.

### Entity System (pure data, no classes)
- **Player** -- grid pos, facing, digging, climbing, falling, LFV state
- **Ducks** -- per-duck ID, pos, facing, trapped, badge carrying
- **Holes** -- pos, phase (opening/open/closing), timer, fill tile
- **Projectiles** -- power helmet shots, sub-grid positioning
- **Effects** -- confetti, death anims, landing dust, score popups

### Rendering (`src/engine/Renderer.ts`)
Two-pass: background (gradient + weather) -> grid (tiles with hue shifting) -> entities. Sprite frame-based animation with interpolation. `shiftColor()` for rainbow district HSL rotation.

### Input (`src/engine/Input.ts`)
WASD/Arrows for movement, Z/C for dig, Space for LFV/Power. Touch controls exist in HTML but show "MOBILE COMING SOON".

## Key Directories
```
src/
  main.ts              -- Entry, wires SFX/menu/game loop
  types.ts             -- TileType enum, GameState interfaces
  constants.ts         -- Grid 28x20, tile 32px, speeds, scores, colors
  leaderboard.ts       -- Convex client (register, login, submit)
  engine/
    GameLoop.ts        -- RAF loop, delta capping
    Renderer.ts        -- Canvas draw, sprites, effects
    Input.ts           -- Keyboard/touch state
    Audio.ts           -- SFX pooling, music, procedural error tone
    SpriteSheet.ts     -- Sprite loading, frame extraction
    Themes.ts          -- 9 district themes (colors, anim styles)
  game/
    GameManager.ts     -- Main game loop, level loading, state
    Level.ts           -- Grid parse, spawn finding, hidden exit
    Player.ts          -- Movement, climbing, rope traversal
    Duck.ts            -- AI (chase, ladder/rope, trapping)
    Physics.ts         -- Collision, support, bounds (28x20 grid)
    Dig.ts             -- Hole creation/animation/regen
    VibeMeter.ts       -- LFV charge (0-100 vibe points)
    Projectile.ts      -- Power helmet shots
    Scoring.ts         -- Badge/duck/level bonuses
    Weather.ts         -- Speed multipliers, particles
    LevelGenerator.ts  -- Procedural gen (spine-and-branch)
  levels/
    catalog.ts         -- LEVELS array, levels 1-5 handwritten, 6-25 procedural
    level-01.json..05  -- Handwritten levels

convex/
  auth.ts              -- register, login, checkName
  leaderboard.ts       -- submit, listAll, getTop25
  schema.ts            -- players & leaderboard tables

public/assets/
  sprites/             -- Player anims (16 sheets), duck, badge, shakas, UI
  tilesets/            -- 9 district tilesets (per PixelLab)
  backgrounds/         -- 9 scenic (400x200), menu bg, modal frames
  audio/               -- SFX (64kbps mono), music (96kbps mono), originals/
  fonts/               -- BriceBold.otf, BriceBlack.otf
```

## Game Structure

### 9 Districts, 25 Levels
1. **Vibetown Nature** (1-3) -- rotate, green/brown
2. **Beach** (4-6) -- wave, sandy
3. **City** (7-9) -- drift, urban grays
4. **Rainbow** (10-12) -- rainbow HSL hue shifting
5. **Grayscale** (13-15) -- pulse, monochrome
6. **Flower** (16-18) -- bloom, magenta/rose
7. **Futuristic** (19-21) -- sweep, neon cyberpunk
8. **Chateau de Gold** (22-23) -- shimmer, gold/amber
9. **Cosmic** (24-25) -- cosmic, deep space purples

Levels 1-5 handwritten JSON, 6-25 procedurally generated. Randomized per session.

### TileType Enum
Empty=0, Sand=1, Coral=2, Ladder=3, Rope=4, TrapSand=5, HiddenLadder=6, Badge=7, DuckSpawn=8, PlayerSpawn=9

## Key Game Mechanics

### Movement & Actions
- Move: 6 tiles/sec grid-based
- Dig (Z/C): creates hole, 3-phase lifecycle (opening 520ms, open 4.5s, closing 300ms)
- Fall: gravity 10 tiles/sec
- LFV (Space): 5s enhanced mode when vibe meter hits 100, 1.5x speed, orbiting shakas

### Duck AI
- Chase player via Manhattan distance, prefer horizontal
- 5% hesitation chance (avoid predictability)
- Trapped in holes 3s, carry/drop badges
- Base 4 tiles/sec, weather-modified

### Scoring
- Badge: 500pts +20 vibe | Trap duck: 100pts +10 vibe | Kill duck: 150pts
- Level complete: 2,000pts (+1,000 bonus if LFV unused)

### Power Helmet / Shadow Funk
- Pickup spawns at level-specific position
- 3 projectiles at 18px/frame, TTL 900ms
- Duck dies instantly on hit

## Asset Pipeline

### PixelLab Integration
- **Tilesets:** 9 district tilesets via `create_tiles_pro` (25 tiles each, 5x5 grid)
- **Backgrounds:** 400x200 scenic at 60% opacity over animated gradients
- **Assets expire after 8h** -- regenerate for deploys

### Sprites
- Player: 16 sprite sheets, scaled by PLAYER_SPRITE_SOURCE_SCALE (1.75)
- Duck: 4 static views + death animation
- Badge: multi-frame money-bag.png
- LFV: 6 colored shaka PNGs orbiting with gold glow

### Audio
- Music: 96kbps mono (viberunner-theme ~2.1MB, vibegaming ~2.1MB)
- SFX: 64kbps mono, pooled (4 instances per SFX for zero-latency)
- Total ~5.4MB compressed (originals in audio/originals/)

## Known Gotchas

### Rainbow District HSL Bug (FIXED)
HSL colors can't use hex alpha suffix (#RRGGBBAA). Fixed: pure RGB hex only in `shiftColor()`.

### PixelLab Asset Expiration
Assets expire 8h. Regenerate tilesets/backgrounds for fresh deploys.

### Player Scale
Player sprite ~42px in 32px tiles (overscan). Renderer scales by PLAYER_SPRITE_SOURCE_SCALE.

### Procedural Level Generation
Retries up to 80x to ensure solvability. Never silently produces unsolvable levels.

### Leaderboard Auth
Simple password hash (non-crypto, 100 rounds). Name squatting prevention, not security.

## Known Issues / TODOs
- **Mobile controls:** Touch D-pad exists in HTML but not wired to game logic. Shows "MOBILE COMING SOON".
- **Autotiling (Approach B):** AI-generated corner-aware tiling. Design phase.
- **Level editor:** In-browser grid painter with solvability checker. Not started.
- **Audio enhancements:** Dynamic music transitions, positional audio, master volume.

## Dev Workflow
```bash
npm run dev     # Vite on localhost:3337
npm run build   # TypeScript + Vite -> dist/
npm run test    # Vitest
```
Deployed to vibetownrunner.com via Vercel (auto-deploy on push to main).
