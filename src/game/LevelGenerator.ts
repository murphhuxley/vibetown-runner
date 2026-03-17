/**
 * Procedural level generator — Spine-and-Branch approach.
 *
 * Strategy (from Lode Runner 2099 research):
 * 1. Place full-width platform rows at regular intervals
 * 2. Cut gaps into platforms for variety
 * 3. Place 2-4 ladders that cut through ALL platforms (guaranteed connectivity)
 * 4. Add ropes bridging gaps between platforms
 * 5. Convert some sand to coral (difficulty-scaled)
 * 6. Place player, verify reachability, place badges + ducks
 * 7. Retry if solvability check fails
 */

import { TileType } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

export interface GeneratedLevel {
  grid: number[][];
  exitColumn: number;
}

const GROUND = GRID_ROWS - 2;
const MAX_ATTEMPTS = 80;

interface Config {
  badges: number;
  ducks: number;
  ladderCount: number;
  gapCount: number;
  gapMaxWidth: number;
  coralPercent: number;
  ropeChance: number;
}

function getConfig(difficulty: number): Config {
  return {
    badges: Math.round(4 + difficulty * 12),
    ducks: Math.round(1 + difficulty * 5),
    ladderCount: Math.max(2, 4 - Math.floor(difficulty * 2)),  // 4→2
    gapCount: 1 + Math.floor(difficulty * 2),                   // 1→3
    gapMaxWidth: 3 + Math.floor(difficulty * 3),                 // 3→6
    coralPercent: difficulty * 0.15,                              // 0→15%
    ropeChance: 0.3 + difficulty * 0.3,                          // 30→60%
  };
}

// ══════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════

export function generateLevel(difficulty: number): GeneratedLevel {
  const config = getConfig(difficulty);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = build(config, difficulty);
    if (result) return result;
  }

  return safeFallback(config);
}

// ══════════════════════════════════════
// BUILD PIPELINE
// ══════════════════════════════════════

function build(config: Config, difficulty: number): GeneratedLevel | null {
  const grid = emptyGrid();

  // Step 1: Ground
  fillRow(grid, GROUND, TileType.Sand);
  fillRow(grid, GROUND + 1, TileType.Sand);

  // Step 2: Platform segments — scattered at varied heights
  // Each segment has its own Y, creating an organic staggered layout.
  // Minimum 3 rows between any two platforms to prevent head clipping (character is 42px in 32px tiles).
  const MIN_PLATFORM_GAP = 3;
  const floorCount = 3 + Math.floor(difficulty * 2); // 3-5 "zones"
  const zoneH = Math.floor((GROUND - 3) / floorCount);
  const floors: number[] = [];
  const occupiedRows = new Set<number>();
  // Ground always occupied
  for (let r = GROUND - MIN_PLATFORM_GAP + 1; r <= GROUND + 1; r++) occupiedRows.add(r);

  const segmentsPerZone = 3 + Math.floor(Math.random() * 2); // 3-4 segments per zone

  for (let zone = 0; zone < floorCount; zone++) {
    const zoneTop = 2 + zone * zoneH;
    const zoneBottom = Math.min(zoneTop + zoneH - 1, GROUND - MIN_PLATFORM_GAP);

    for (let seg = 0; seg < segmentsPerZone; seg++) {
      // Try a few Y positions to find one with enough clearance
      let y = -1;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = zoneTop + Math.floor(Math.random() * Math.max(1, zoneBottom - zoneTop + 1));
        if (candidate < 2 || candidate >= GROUND - 1) continue;

        // Check minimum gap from ALL other platforms
        let tooClose = false;
        for (let check = candidate - MIN_PLATFORM_GAP + 1; check <= candidate + MIN_PLATFORM_GAP - 1; check++) {
          if (occupiedRows.has(check)) { tooClose = true; break; }
        }
        if (!tooClose) { y = candidate; break; }
      }
      if (y < 0) continue;

      // Random width and position
      const segW = 4 + Math.floor(Math.random() * 9); // 4-12 tiles wide
      const segX = Math.floor(Math.random() * (GRID_COLS - segW));

      for (let x = segX; x < segX + segW && x < GRID_COLS; x++) {
        if (grid[y][x] === TileType.Empty) {
          grid[y][x] = TileType.Sand;
        }
      }

      occupiedRows.add(y);
      if (!floors.includes(y)) floors.push(y);
    }
  }
  floors.sort((a, b) => a - b);
  floors.push(GROUND);

  // Step 4: Place ladders connecting nearby platforms (NOT full-height)
  // Each ladder connects a pair of adjacent floors, creating varied heights
  const ladderCols: number[] = [];
  const zoneWidth = Math.floor(GRID_COLS / config.ladderCount);

  for (let i = 0; i < config.ladderCount; i++) {
    const col = Math.max(1, Math.min(GRID_COLS - 2,
      i * zoneWidth + 1 + Math.floor(Math.random() * Math.max(1, zoneWidth - 2))
    ));
    ladderCols.push(col);

    // Find platform rows this column touches or is near
    const touchedFloors: number[] = [];
    for (const fy of floors) {
      // Check if there's a platform within 2 tiles of this column at this row
      for (let dx = -1; dx <= 1; dx++) {
        const cx = col + dx;
        if (cx >= 0 && cx < GRID_COLS && grid[fy][cx] === TileType.Sand) {
          if (!touchedFloors.includes(fy)) touchedFloors.push(fy);
          break;
        }
      }
    }

    // Ground counts as a floor for ladder connectivity
    if (!touchedFloors.includes(GROUND)) touchedFloors.push(GROUND);

    if (touchedFloors.length < 2) {
      // Can't connect 2 platforms — skip this ladder entirely
      continue;
    } else {
      // Connect from highest touched floor to lowest (through any in between)
      touchedFloors.sort((a, b) => a - b);
      const topY = touchedFloors[0];
      const bottomY = touchedFloors[touchedFloors.length - 1];
      for (let y = topY; y <= bottomY; y++) {
        if (grid[y][col] === TileType.Sand || grid[y][col] === TileType.Empty) {
          grid[y][col] = TileType.Ladder;
        }
      }
      // Extend a bit above the top platform so player can climb onto it
      // But NEVER go above row 2 — rows 0-1 are reserved for the hidden exit ladder only
      for (let y = Math.max(2, topY - 2); y < topY; y++) {
        if (grid[y][col] === TileType.Empty) {
          grid[y][col] = TileType.Ladder;
        }
      }
    }
  }

  // Step 5: Add ropes in gaps between platforms
  for (let fi = 0; fi < floors.length - 1; fi++) {
    if (Math.random() > config.ropeChance) continue;

    const upper = floors[fi];
    const lower = fi + 1 < floors.length ? floors[fi + 1] : GROUND;
    const ropeY = upper + Math.floor((lower - upper) * 0.5);

    if (ropeY <= upper + 1 || ropeY >= lower - 1) continue;

    // Find gap regions on the upper platform to bridge with rope
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[upper][x] === TileType.Empty && grid[ropeY][x] === TileType.Empty) {
        grid[ropeY][x] = TileType.Rope;
      }
    }
  }

  // Step 6: Convert some sand to coral (not on ground, not near ladders)
  if (config.coralPercent > 0) {
    const sandTiles: { x: number; y: number }[] = [];
    for (let y = 1; y < GROUND; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (grid[y][x] !== TileType.Sand) continue;
        if (ladderCols.some(lc => Math.abs(lc - x) < 2)) continue;
        sandTiles.push({ x, y });
      }
    }
    shuffle(sandTiles);
    const count = Math.floor(sandTiles.length * config.coralPercent);
    for (let i = 0; i < count; i++) {
      grid[sandTiles[i].y][sandTiles[i].x] = TileType.Coral;
    }
  }

  // Step 7: Place player on ground floor
  const spawn = placePlayer(grid);
  if (!spawn) return null;

  // Step 8: Verify reachability
  const reachable = bfs(grid, spawn);

  // Step 9: Place badges — only on reachable, supported tiles, spread across floors
  const placed = placeBadges(grid, reachable, config.badges, floors, spawn);
  if (placed < config.badges) return null;

  // Step 10: Place ducks
  placeDucks(grid, reachable, config.ducks, spawn);

  // Step 11: Exit ladder
  const exitCol = addExit(grid, ladderCols, reachable);

  // Step 12: Final check — can reach row 0 with exit ladders?
  const finalReachable = bfs(grid, spawn);
  let canEscape = false;
  for (let x = 0; x < GRID_COLS; x++) {
    if (finalReachable.has(k(x, 0))) { canEscape = true; break; }
  }
  if (!canEscape) return null;

  return { grid, exitColumn: exitCol };
}

// ══════════════════════════════════════
// PLACEMENT HELPERS
// ══════════════════════════════════════

function placePlayer(grid: number[][]): { x: number; y: number } | null {
  const y = GROUND - 1;
  // Try left side first
  for (let x = 0; x < 6; x++) {
    if (grid[y][x] === TileType.Empty) {
      grid[y][x] = TileType.PlayerSpawn;
      return { x, y };
    }
  }
  // Then anywhere
  for (let x = 0; x < GRID_COLS; x++) {
    if (grid[y][x] === TileType.Empty) {
      grid[y][x] = TileType.PlayerSpawn;
      return { x, y };
    }
  }
  return null;
}

function placeBadges(
  grid: number[][],
  reachable: Set<string>,
  count: number,
  floors: number[],
  spawn: { x: number; y: number },
): number {
  // Group reachable empty supported spots by floor
  const byFloor: Map<number, { x: number; y: number }[]> = new Map();

  for (let y = 0; y < GRID_ROWS - 1; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x] !== TileType.Empty) continue;
      if (!reachable.has(k(x, y))) continue;
      if (x === spawn.x && y === spawn.y) continue;
      if (!supported(grid, x, y)) continue;

      // Which floor does this belong to?
      let bestFloor = GROUND;
      for (const f of floors) {
        if (f > y && f <= bestFloor) bestFloor = f;
      }

      if (!byFloor.has(bestFloor)) byFloor.set(bestFloor, []);
      byFloor.get(bestFloor)!.push({ x, y });
    }
  }

  for (const spots of byFloor.values()) shuffle(spots);

  // Round-robin across floors
  const keys = [...byFloor.keys()];
  let placed = 0;
  let idx = 0;

  while (placed < count && keys.length > 0) {
    const fk = keys[idx % keys.length];
    const spots = byFloor.get(fk)!;

    if (spots.length > 0) {
      const spot = spots.pop()!;
      grid[spot.y][spot.x] = TileType.Badge;
      placed++;
    } else {
      keys.splice(idx % keys.length, 1);
      continue;
    }
    idx++;
  }

  return placed;
}

function placeDucks(
  grid: number[][],
  reachable: Set<string>,
  count: number,
  spawn: { x: number; y: number },
): void {
  const spots: { x: number; y: number }[] = [];
  for (let y = 0; y < GROUND - 2; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x] !== TileType.Empty) continue;
      if (!reachable.has(k(x, y))) continue;
      if (!supported(grid, x, y)) continue;
      if (Math.abs(x - spawn.x) + Math.abs(y - spawn.y) < 8) continue;
      spots.push({ x, y });
    }
  }

  shuffle(spots);
  const placed: { x: number; y: number }[] = [];

  for (const pos of spots) {
    if (placed.length >= count) break;
    if (placed.some(d => Math.abs(d.x - pos.x) + Math.abs(d.y - pos.y) < 3)) continue;
    grid[pos.y][pos.x] = TileType.DuckSpawn;
    placed.push(pos);
  }
}

function addExit(grid: number[][], ladderCols: number[], reachable: Set<string>): number {
  // Find a ladder column where the player can reach near the top
  for (const col of shuffle([...ladderCols])) {
    for (let y = 1; y <= 4; y++) {
      if (reachable.has(k(col, y))) {
        for (let hy = 0; hy < y; hy++) {
          if (grid[hy][col] === TileType.Empty) {
            grid[hy][col] = TileType.HiddenLadder;
          }
        }
        return col;
      }
    }
  }

  // Fallback: use first ladder col
  const col = ladderCols[0] ?? Math.floor(GRID_COLS / 2);
  for (let y = 0; y < 3; y++) {
    if (grid[y][col] === TileType.Empty || grid[y][col] === TileType.Sand) {
      grid[y][col] = TileType.HiddenLadder;
    }
  }
  return col;
}

// ══════════════════════════════════════
// DIG-AWARE BFS
// ══════════════════════════════════════

function bfs(grid: number[][], start: { x: number; y: number }): Set<string> {
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [start];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const pk = k(pos.x, pos.y);
    if (visited.has(pk)) continue;
    if (!inBounds(pos.x, pos.y)) continue;
    if (solid(grid, pos.x, pos.y)) continue;
    visited.add(pk);

    // Fall if unsupported
    if (!supported(grid, pos.x, pos.y)) {
      let fy = pos.y;
      while (fy + 1 < GRID_ROWS && !solid(grid, pos.x, fy + 1) && !supported(grid, pos.x, fy)) {
        fy++;
        visited.add(k(pos.x, fy));
      }
      if (fy !== pos.y) { queue.push({ x: pos.x, y: fy }); continue; }
    }

    // Walk left/right
    if (!solid(grid, pos.x - 1, pos.y)) queue.push({ x: pos.x - 1, y: pos.y });
    if (!solid(grid, pos.x + 1, pos.y)) queue.push({ x: pos.x + 1, y: pos.y });

    // Climb ladders
    const onLadder = isLadder(grid, pos.x, pos.y);
    if (onLadder || isLadder(grid, pos.x, pos.y - 1)) {
      if (pos.y > 0 && !solid(grid, pos.x, pos.y - 1)) queue.push({ x: pos.x, y: pos.y - 1 });
    }
    if (onLadder || isLadder(grid, pos.x, pos.y + 1)) {
      if (pos.y + 1 < GRID_ROWS && !solid(grid, pos.x, pos.y + 1)) queue.push({ x: pos.x, y: pos.y + 1 });
    }

    // Dig reachability
    if (supported(grid, pos.x, pos.y)) {
      // Dig left
      if (canDig(grid, pos.x - 1, pos.y + 1) && !solid(grid, pos.x - 1, pos.y)) {
        const dest = fall(grid, pos.x - 1, pos.y + 1);
        if (dest) queue.push(dest);
      }
      // Dig right
      if (canDig(grid, pos.x + 1, pos.y + 1) && !solid(grid, pos.x + 1, pos.y)) {
        const dest = fall(grid, pos.x + 1, pos.y + 1);
        if (dest) queue.push(dest);
      }
    }
  }

  return visited;
}

function canDig(grid: number[][], x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  return grid[y][x] === TileType.Sand || grid[y][x] === TileType.TrapSand;
}

function fall(grid: number[][], x: number, startY: number): { x: number; y: number } | null {
  let y = startY;
  while (y + 1 < GRID_ROWS) {
    if (solid(grid, x, y + 1)) return { x, y };
    if (isLadder(grid, x, y) || grid[y][x] === TileType.Rope) return { x, y };
    y++;
  }
  return { x, y: GRID_ROWS - 1 };
}

// ══════════════════════════════════════
// SAFE FALLBACK
// ══════════════════════════════════════

function safeFallback(config: Config): GeneratedLevel {
  const grid = emptyGrid();
  fillRow(grid, GROUND, TileType.Sand);
  fillRow(grid, GROUND + 1, TileType.Sand);
  fillRow(grid, 10, TileType.Sand);
  fillRow(grid, 4, TileType.Sand);

  for (let y = 4; y <= GROUND; y++) {
    grid[y][7] = TileType.Ladder;
    grid[y][20] = TileType.Ladder;
  }

  for (let x = 4; x < 24; x++) {
    if (grid[7][x] === TileType.Empty) grid[7][x] = TileType.Rope;
  }

  grid[GROUND - 1][1] = TileType.PlayerSpawn;

  const spots = [
    { x: 3, y: 3 }, { x: 13, y: 3 }, { x: 25, y: 3 },
    { x: 5, y: 9 }, { x: 15, y: 9 }, { x: 22, y: 9 },
    { x: 4, y: GROUND - 1 }, { x: 14, y: GROUND - 1 },
    { x: 24, y: GROUND - 1 }, { x: 10, y: 3 },
    { x: 18, y: 9 }, { x: 8, y: GROUND - 1 },
    { x: 20, y: 3 }, { x: 2, y: 9 },
    { x: 12, y: GROUND - 1 }, { x: 26, y: GROUND - 1 },
  ];
  for (let i = 0; i < Math.min(config.badges, spots.length); i++) {
    if (grid[spots[i].y][spots[i].x] === TileType.Empty) {
      grid[spots[i].y][spots[i].x] = TileType.Badge;
    }
  }

  const duckSpots = [
    { x: 12, y: 9 }, { x: 18, y: 3 }, { x: 5, y: 3 },
    { x: 22, y: 9 }, { x: 15, y: 3 }, { x: 10, y: 9 },
  ];
  for (let i = 0; i < Math.min(config.ducks, duckSpots.length); i++) {
    if (grid[duckSpots[i].y][duckSpots[i].x] === TileType.Empty) {
      grid[duckSpots[i].y][duckSpots[i].x] = TileType.DuckSpawn;
    }
  }

  grid[0][7] = TileType.HiddenLadder;
  grid[1][7] = TileType.HiddenLadder;
  grid[2][7] = TileType.HiddenLadder;
  grid[3][7] = TileType.HiddenLadder;

  return { grid, exitColumn: 7 };
}

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════

function emptyGrid(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
}

function fillRow(grid: number[][], y: number, tile: TileType): void {
  for (let x = 0; x < GRID_COLS; x++) grid[y][x] = tile;
}

function k(x: number, y: number): string { return `${x},${y}`; }

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function solid(grid: number[][], x: number, y: number): boolean {
  if (!inBounds(x, y)) return true;
  const t = grid[y][x];
  return t === TileType.Sand || t === TileType.Coral || t === TileType.TrapSand;
}

function isLadder(grid: number[][], x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const t = grid[y][x];
  return t === TileType.Ladder || t === TileType.HiddenLadder;
}

function supported(grid: number[][], x: number, y: number): boolean {
  if (y >= GRID_ROWS - 1) return true;
  if (solid(grid, x, y + 1)) return true;
  if (isLadder(grid, x, y)) return true;
  if (inBounds(x, y) && grid[y][x] === TileType.Rope) return true;
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
