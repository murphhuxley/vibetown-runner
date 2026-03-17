# Procedural Level Generation — Design Document

**Goal:** Generate unique, solvable, interesting Lode Runner levels for every playthrough. Levels 1-5 stay hand-crafted (tutorial). Levels 6-25 are procedurally generated with difficulty scaling per district.

**Architecture:** Hybrid Spelunky-path + Lode-Runner-2099-verification approach. A room-grid guarantees structural connectivity, then a dig-aware BFS verifies full solvability before accepting the level.

---

## Core Algorithm: 15-Step Pipeline

```
1.  createGround()              — Solid bottom 2 rows
2.  generateRoomPath()          — Spelunky-style guaranteed path through 4x4 room grid
3.  applyRoomTemplates()        — Fill each room from template library (difficulty-scaled)
4.  addSpineLadder()            — One full-height ladder for connectivity insurance
5.  addBranchLadders()          — 1-3 additional ladders connecting specific floor pairs
6.  addRopeBridges()            — Connect platforms across gaps within rooms
7.  addCoral()                  — Replace some sand with indestructible blocks (difficulty-scaled)
8.  addTrapSand()               — Hidden fall-through tiles (difficulty-scaled)
9.  ensureLadderAccess()        — Remove any solid tiles blocking ladder entry/exit
10. placePlayer()               — Ground floor, left side
11. placeBadges()               — BFS-verified reachable positions, distributed across all floors
12. placeDucks()                — Distance > 8 from player, spread across platforms, min spacing 3
13. addHiddenExitLadder()       — Exit column rows 0-3, on a ladder column
14. verifySolvability()         — Full BFS with dig-path simulation
15. if !solvable: goto 2        — Retry (up to 50 attempts, then safe fallback)
```

---

## Room Grid System (Spelunky-Style)

Divide the 28x20 playable area into a **4-column × 4-row grid of 7×5 tile rooms**.

- Rows 0-1: top zone (exit area, row 0 is escape target)
- Room rows occupy: rows 2-6, 7-11, 12-16, 17-19 (ground area compressed)

### Guaranteed Path

Random-walk from a room in the top row to the ground:

```
Start at random column in row 0
While not at bottom row:
    Roll: 40% down, 30% left, 30% right
    If moving off-grid: force down
    Mark each visited room as "on-path"
```

### Room Types (based on connections needed)

| Type | Connections | Description |
|------|------------|-------------|
| 0 | None required | Off-path — optional content, accessible via ladders |
| 1 | Left ↔ Right | Horizontal path segment |
| 2 | Left ↔ Right + Down | Path descends through this room |
| 3 | Left ↔ Right + Up | Path arrives from below |
| 4 | Up + Down | Vertical shaft |

### Room Templates (5-10 per type)

Each template is a 7×5 tile pattern. Templates are pre-authored micro-levels with:

- **Fixed structural elements** matching the connection type (platforms with gaps, ladder positions)
- **Variation zones** where tiles have a probability of being sand, empty, or rope
- Templates are tagged with a difficulty range (0.0-1.0) so harder templates appear later

Example templates for Type 2 (horizontal + descends):

```
Template 2A (easy):        Template 2B (medium):       Template 2C (hard):
.......                    .......                     .......
.......                    ..SSS..                     .SCSS..
SSSSLSS                    SSLSSSS                     SSLSCSS
.......                    .......                     .......
.......                    ...RRR.                     .......
```
(S=Sand, L=Ladder, C=Coral, R=Rope, .=Empty)

---

## Difficulty Scaling

Parameters scale linearly with level number (6-25 maps to difficulty 0.0-1.0):

| Parameter | Level 6 (d=0.0) | Level 15 (d=0.5) | Level 25 (d=1.0) |
|-----------|-----------------|-------------------|-------------------|
| Badges | 5 | 10 | 16 |
| Ducks | 1 | 3 | 5 |
| Ladder density | High (0.8) | Medium (0.5) | Low (0.25) |
| Coral % of sand | 0% | 10% | 20% |
| Trap sand % | 0% | 5% | 12% |
| Platform gap size | Small (2-3) | Medium (3-5) | Large (4-7) |
| Room template pool | Easy only | Easy + Medium | All |

### What Each Parameter Does to Difficulty

- **Fewer ladders** = longer routes, more dig planning (biggest lever)
- **More coral** = fewer dig shortcuts, forced routing
- **More ducks** = time pressure, blocks paths
- **More badges** = forces full traversal
- **Trap sand** = surprise falls, punishes careless movement
- **Larger gaps** = fewer safe platforms, more commitment to paths

---

## Solvability Verification (Dig-Aware BFS)

This is the most critical component. Naive flood-fill misses dig-reachable areas.

### BFS Movement Rules

From any position, the player can:

1. **Walk left/right** — if target tile is not solid
2. **Climb up** — if current tile OR tile above is a ladder
3. **Climb down** — if current tile OR tile below is a ladder
4. **Traverse rope** — walk left/right on rope tiles (supported without ground below)
5. **Fall** — if unsupported (no solid below, no ladder, no rope), simulate falling until landing
6. **DIG** — if tile at (x±1, y+1) is Sand (not Coral, not Ladder), add the fall-destination from that position to reachable set

### The Dig Rule (Critical)

```
// Standing at (x, y), can dig tile at (x+1, y+1) if:
// 1. That tile is Sand (diggable)
// 2. Player is supported at (x, y)
// 3. Tile at (x+1, y) is not solid (player needs to walk there after digging)
//
// This opens a path: player walks to (x+1, y), falls through dug hole to landing point
```

The BFS treats each dig opportunity as an additional reachable neighbor, creating a full graph of all positions the player can possibly reach.

### Two-Phase Verification

1. **Phase 1 — Without exit ladders:** Can the player reach every badge?
2. **Phase 2 — With exit ladders revealed:** Can the player reach row 0?

Both must pass for the level to be accepted.

### Edge Cases

- **Dig chains:** Player digs, falls, digs again. BFS handles naturally — each landed position gets its own dig neighbors
- **Rope-to-dig:** Player drops from rope into dig position. BFS supports this since rope positions are in reachable set
- **TrapSand:** Treated same as Sand for dig reachability
- **One-way drops:** Falling into a pit without a ladder is a one-way trip. BFS captures this correctly

---

## Badge Placement Strategy

Badges must be:
1. **Reachable** (verified by BFS)
2. **Distributed** across all floors (not clustered)
3. **Spaced** at least 3 tiles apart horizontally within the same floor

### Algorithm

```
1. Run BFS from player spawn → get reachable set
2. Filter reachable set to empty tiles above solid ground
3. Group spots by floor (which platform row they're above)
4. Shuffle each floor's spots
5. Round-robin place badges across floors (ensures vertical spread)
6. Enforce minimum horizontal spacing of 3 tiles per floor
```

---

## Duck Placement Strategy

Ducks must be:
1. On reachable tiles (so they can reach the player)
2. At least **8 Manhattan distance** from player spawn
3. At least **3 Manhattan distance** from each other
4. Preferably on **upper floors** (creates downward chase pressure)

---

## Theme Integration

Each generated level gets its theme from the district blueprint:

| Level Range | District | Theme Keys |
|-------------|----------|------------|
| 6-8 | Beach (remaining) / City | beach-3, city-1, city-2 |
| 9-12 | City / Rainbow | city-3, rainbow-1, rainbow-2, rainbow-3 |
| 13-15 | Grayscale | gray-1, gray-2, gray-3 |
| 16-18 | Flower | flower-1, flower-2, flower-3 |
| 19-21 | Futuristic | future-1, future-2, future-3 |
| 22-23 | Chateau de Gold | gold-1, gold-2 |
| 24-25 | Cosmic | cosmic-1, cosmic-2 |

Weather is assigned per the district design doc.

---

## Retry Strategy

```
attempts = 0
while attempts < 50:
    level = generateCandidate(difficulty)
    if verifySolvability(level):
        return level
    attempts++

// Fallback: use a hand-crafted level from the master set with randomized items
return randomizeItems(MASTER_LEVELS[levelIndex % MASTER_LEVELS.length])
```

The fallback ensures the game NEVER gets stuck — it always has a playable level.

---

## What We Keep vs. What We Replace

| Component | Approach |
|-----------|----------|
| Levels 1-5 | Hand-crafted, item positions randomized within segments (current system) |
| Levels 6-25 | Fully procedural with room-grid + solvability verification |
| Platform layouts | Generated per room template library |
| Ladder placement | Spine + branch algorithm |
| Rope placement | Gap-bridging within rooms |
| Badge positions | BFS-verified, floor-distributed |
| Duck positions | Distance-based, spread across floors |
| Theme/district | Fixed per level number (from blueprint table) |

---

## Implementation Phases

### Phase 1: Room Template Library
- Define 30-40 room templates (7×5 tiles each) across 5 types and 3 difficulty tiers
- Templates stored as simple 2D arrays in a TypeScript module

### Phase 2: Generation Pipeline
- Implement the 15-step pipeline in `LevelGenerator.ts`
- Room grid, path generation, template application, ladder/rope placement

### Phase 3: Solvability Checker
- Dig-aware BFS flood-fill
- Two-phase verification (badges + exit)
- Retry loop with fallback

### Phase 4: Integration
- Wire generated levels into catalog for levels 6-25
- Keep hand-crafted 1-5 with current randomized-items system
- Call `randomizeLevels()` on restart to regenerate

---

## References

- **Lode Runner 2099** (jgbrwn/loderunner2099) — 12-step pipeline, 500-attempt solvability loop
- **Spelunky** — Room grid with guaranteed-path random walk
- **Original Lode Runner** — 150 levels analyzed for design patterns
- **Lode Enhancer** (Bhaumik 2023) — Neural upscaling of level sketches
- **Autoencoder + EA** (Thakkar 2019) — Evolved levels from original dataset
