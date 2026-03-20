# Vibetown Runner — Gameplay Improvements Design

**Date:** 2026-03-20
**Status:** Approved

## Goal

Make Vibetown Runner not just fun to look at but challenging, addictive, and rewarding to play. Three phases, each independently shippable.

---

## Phase 1: Balance & Feel

Changes to numbers and AI that affect how the game plays.

### Score Rebalance

| Action | Current | New |
|---|---|---|
| SCORE_BADGE | 250 | 500 |
| SCORE_TRAP_DUCK | 75 | 100 |
| SCORE_KILL_DUCK | 75 | 100 |
| SCORE_LEVEL_COMPLETE | 1,500 | 2,000 |
| SCORE_LFV_BONUS | 2,000 | 1,000 |
| Shadow funk kill (SCORE_KILL_DUCK during power) | 75 | 150 |

### Power Helmet Spawn

- Current: 35% chance after level 3
- New: 25% chance after level 5

### Weather Speed Modifiers

Wire up `getSpeedMultiplier()` which currently returns 1 for everything.

| Weather | Player | Duck | Feel |
|---|---|---|---|
| None | 1.0x | 1.0x | Default |
| Sunshine | 1.15x | 1.15x | Frantic |
| Rain | 0.8x | 0.8x | Methodical |
| TradeWinds | 1.0x | 0.75x | Player advantage |
| HighTide | 1.0x | 1.0x | Future: flood bottom rows |

### Duck AI Improvements

- **Chase acceleration:** When on same row as player and within 8 tiles, move 20% faster (200ms tick instead of 250ms)
- **Random hesitation:** 15% chance each move tick to pause for one extra tick
- **Smarter ladder choice:** When two ladders equidistant, prefer the one closer to player horizontally

### LFV — No Changes

LFV stays as-is: speed 1.5x, ducks frozen, still lethal on contact, once per level. The tension of being fast but mortal is the point.

---

## Phase 2: Juice & Feedback

Visual and audio feedback that makes every action feel impactful. Zero gameplay changes.

### Floating Score Popups

"+500" / "+100" text floats up from action point, fades over ~1s. Green for badges, red for kills. Rendered on canvas.

### Trap Timer on Ducks

Visual countdown above trapped ducks — shrinking bar or color shift (green → yellow → red). Gives player critical timing info and builds tension.

### Duck Escape Animation

2-3 frames of struggling/climbing before duck pops out of hole. Visual warning that escape is imminent.

### Screen Shake

Brief 3-4 frame shake on player death only. Don't overdo it.

### Vibe Meter Pulse

When meter is full and LFV ready, pulse the HUD bar with a glow. Visual cue that power is available.

### Landing Dust

Small particle burst (3-4 pixels) when player lands from 2+ tile fall. Gives gravity weight.

---

## Phase 3: Depth

### Difficulty Curve (Levels 8-10)

Steepen the transition from learning to challenging. Move badges behind duck patrol paths, reduce safe ladder count.

### Movement Momentum

- 1 extra tile slide when releasing direction after 2+ ticks of movement
- 80ms input pause on landing from 3+ tile fall

### Procedural Level Generation

Full design exists in `2026-03-16-procedural-level-generation-design.md`. 15-step pipeline, room templates, BFS solvability, difficulty scaling. Unlocks infinite mode and daily challenges.
