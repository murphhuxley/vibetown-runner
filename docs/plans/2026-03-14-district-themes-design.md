# Vibetown Runner — District Theme System Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand from 5 themed levels to 25 levels across 9 districts, each with distinct animated gradient backgrounds, brick palettes, and visual identity.

**Architecture:** Each district is a named group of 2-3 levels sharing a brick color family and animation style, but with hard-shifted gradient color pairs per level. The `LevelTheme` interface gains an `animStyle` field that the Renderer uses to select animation behavior in `clear()`.

---

## District Overview

| # | District | Levels | Animation Style |
|---|----------|--------|-----------------|
| 1 | Vibetown Nature | 1-3 | Slow gentle rotation |
| 2 | Beach | 4-6 | Wave-like horizontal oscillation |
| 3 | City | 7-9 | Slow vertical drift |
| 4 | Rainbow District | 10-12 | Full hue-cycling rainbow |
| 5 | Grayscale District | 13-15 | Subtle pulse/breathe |
| 6 | Flower District | 16-18 | Radial bloom expand/contract |
| 7 | Futuristic District | 19-21 | Fast diagonal sweep |
| 8 | Chateau de Gold | 22-23 | Shimmering gold, slow regal rotation |
| 9 | Cosmic District | 24-25 | Slow swirl with twinkling dots |

---

## Per-Level Gradient Colors

### 1. Vibetown Nature (Levels 1-3)
Earth tones meet sky. Organic, fresh.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 1 | `nature-1` | Forest green `#5AAA60` | Sky blue `#88CCF0` |
| 2 | `nature-2` | Emerald `#40C870` | Warm yellow `#F0D868` |
| 3 | `nature-3` | Teal `#48B8A0` | Mint `#A8F0D0` |

**Bricks:** Dark earth brown `#6B4830` / `#5A3820`
**Coral:** Darker brown `#4A3018` / `#3A2010`

### 2. Beach (Levels 4-6)
Tropical ocean vibes. Warm + cool contrast.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 4 | `beach-1` | Sky blue `#A8D8F0` | Peach `#FFD0A0` |
| 5 | `beach-2` | Turquoise `#60D8C8` | Coral `#FF9080` |
| 6 | `beach-3` | Seafoam `#80E8C0` | Hot pink `#FF80A8` |

**Bricks:** Warm brown `#A0724A` / `#8A5E38`
**Coral:** Darker brown `#8A5E38` / `#604020`

### 3. City (Levels 7-9)
Urban atmosphere. Cool neutrals with warm accents.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 7 | `city-1` | Steel gray `#A0A8B8` | Dusty rose `#E0A0A0` |
| 8 | `city-2` | Slate blue `#7888A8` | Amber `#F0C060` |
| 9 | `city-3` | Charcoal `#808890` | Soft violet `#C8A0E0` |

**Bricks:** Dark concrete `#505860` / `#404850`
**Coral:** Near-black concrete `#383840` / `#282830`

### 4. Rainbow District (Levels 10-12)
Full spectrum energy. Animated hue-cycling overrides static gradient.

| Level | Theme Key | bgTop | bgBottom | Notes |
|-------|-----------|-------|----------|-------|
| 10 | `rainbow-1` | Red `#FF6060` | Orange `#FFB040` | Warm end of spectrum |
| 11 | `rainbow-2` | Green `#60D060` | Blue `#6080FF` | Cool end of spectrum |
| 12 | `rainbow-3` | Purple `#B060FF` | Pink `#FF60B0` | Full rapid cycle |

**Animation:** Colors continuously shift through the rainbow. Level 12 cycles fastest.
**Bricks:** Dark charcoal `#383838` / `#282828` — neutral to let rainbow pop
**Coral:** Near-black `#202020` / `#181818`

### 5. Grayscale District (Levels 13-15)
Monochrome, moody, atmospheric.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 13 | `gray-1` | White `#E8E8E8` | Medium gray `#989898` |
| 14 | `gray-2` | Silver `#C0C0C0` | Charcoal `#505050` |
| 15 | `gray-3` | Blue-gray `#A0B0C0` | Near-black `#303030` |

**Animation:** Slow pulse/breathe — gradient subtly brightens and darkens.
**Bricks:** Near-black `#282828` / `#1A1A1A`
**Coral:** Pure black `#141414` / `#0A0A0A`

### 6. Flower District (Levels 16-18)
Garden pastels. Bright, springy, alive.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 16 | `flower-1` | Hot pink `#FF70A0` | Soft yellow `#F8E870` |
| 17 | `flower-2` | Lavender `#C088F0` | Peach `#FFB888` |
| 18 | `flower-3` | Magenta `#E060C0` | Mint green `#80F0B0` |

**Animation:** Radial bloom — a soft glow expands from center and contracts rhythmically.
**Bricks:** Deep plum `#603848` / `#502838`
**Coral:** Dark wine `#402028` / `#301018`

### 7. Futuristic District (Levels 19-21)
Neon synthwave. High energy, electric.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 19 | `future-1` | Cyan `#40E8F0` | Electric purple `#A040F0` |
| 20 | `future-2` | Neon green `#60F080` | Hot pink `#F060A0` |
| 21 | `future-3` | Electric blue `#4080FF` | Orange `#FF8840` |

**Animation:** Fast diagonal sweep — gradient angle rotates 2-3x faster than normal.
**Bricks:** Dark teal `#283840` / `#182830`
**Coral:** Chrome dark `#202830` / `#101820`

### 8. Chateau de Gold (Levels 22-23)
Luxurious, regal, warm.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 22 | `gold-1` | Rich gold `#F0C040` | Deep burgundy `#802040` |
| 23 | `gold-2` | Amber `#E8A030` | Dark plum `#602050` |

**Animation:** Shimmering — scattered bright points that fade in/out over the gradient, slow regal rotation.
**Bricks:** Dark mahogany `#5A2818` / `#4A1810`
**Coral:** Deep walnut `#3A1808` / `#2A1000`

### 9. Cosmic District (Levels 24-25)
Deep space. Mysterious, vast.

| Level | Theme Key | bgTop | bgBottom |
|-------|-----------|-------|----------|
| 24 | `cosmic-1` | Deep purple `#7030A0` | Teal `#40B8B0` |
| 25 | `cosmic-2` | Midnight blue `#2840A0` | Hot magenta `#E040A0` |

**Animation:** Slow swirl with twinkling dot overlay — tiny white dots fade in/out randomly across the background like stars.
**Bricks:** Deep indigo `#282048` / `#1A1038`
**Coral:** Space black `#141028` / `#0A0818`

---

## Animation Style Definitions

Added to `LevelTheme` interface as `animStyle`:

```typescript
type AnimStyle = 'rotate' | 'wave' | 'drift' | 'rainbow' | 'pulse' | 'bloom' | 'sweep' | 'shimmer' | 'cosmic';
```

| Style | Behavior |
|-------|----------|
| `rotate` | Gradient angle rotates slowly (current default behavior) |
| `wave` | Gradient oscillates horizontally like ocean waves |
| `drift` | Gradient drifts vertically, slow and atmospheric |
| `rainbow` | bgTop/bgBottom ignored — hue cycles through full spectrum |
| `pulse` | Gradient brightens and darkens rhythmically |
| `bloom` | Radial glow expands from center, contracts, repeats |
| `sweep` | Fast diagonal rotation (3x normal speed) |
| `shimmer` | Slow rotation + random bright points that twinkle |
| `cosmic` | Slow swirl + random white dots that fade in/out |

---

## Brick Rendering

All districts use the 4×3 staggered mortar pattern (small bricks). Sand bricks are diggable, coral bricks are indestructible. Coral bricks have horizontal score lines only (no mortar stagger) to visually distinguish them.

---

## Ladder & Rope Colors

Each district gets ladder/rope colors that read clearly against both the gradient and the bricks:

| District | Ladder | Rope |
|----------|--------|------|
| Nature | Warm wood `#C8A060` | Vine green `#688848` |
| Beach | Sandy `#C8A060` | Olive `#7A8850` |
| City | Light gray `#C0C0C8` | Cable gray `#909098` |
| Rainbow | White `#F0F0F0` | White `#E0E0E0` |
| Grayscale | Light gray `#A0A0A0` | Medium gray `#808080` |
| Flower | Cream `#F0E0C8` | Vine `#80A060` |
| Futuristic | Cyan `#60D0E0` | Neon `#A0F0B0` |
| Gold | Ornate gold `#D0A040` | Silk rope `#C8A080` |
| Cosmic | Pale blue `#8090C0` | Silver `#9098B0` |

---

## Level Data

Each level JSON needs:
- `"theme"` — the theme key (e.g., `"nature-1"`, `"beach-2"`)
- `"exitColumn"` — column for hidden escape ladder
- `"weather"` — weather type (most are `"none"`)
- `"grid"` — 20×28 tile grid

Weather suggestions by district:
- Nature: none, none, rain
- Beach: sunshine, none, trade winds
- City: none, rain, none
- Rainbow: sunshine, sunshine, sunshine
- Grayscale: rain, rain, none
- Flower: sunshine, none, none
- Futuristic: none, none, trade winds
- Gold: none, sunshine
- Cosmic: none, none
