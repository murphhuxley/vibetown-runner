import { GRID_COLS, GRID_ROWS } from '@/constants';
import { cloneGrid, ensureHiddenExit, findSpawnPosition } from '@/game/Level';
import { Position, TileType } from '@/types';

export type LevelIssueSeverity = 'error' | 'warning';

export interface LevelValidationIssue {
  code: string;
  message: string;
  severity: LevelIssueSeverity;
  x?: number;
  y?: number;
}

export interface LevelLayout {
  id: number;
  grid: number[][];
  exitColumn?: number;
  powerHelmet?: Position;
}

const SOLID_TILES = new Set<TileType>([TileType.Sand, TileType.Coral, TileType.TrapSand]);
const NON_LANE_TILES = new Set<TileType>([TileType.Ladder, TileType.Rope, TileType.HiddenLadder]);

export function validateLevelLayout(level: LevelLayout): LevelValidationIssue[] {
  const issues: LevelValidationIssue[] = [];

  if (level.grid.length !== GRID_ROWS) {
    issues.push(error('bad-grid-height', `Level ${level.id} has ${level.grid.length} rows, expected ${GRID_ROWS}`));
    return issues;
  }

  for (let y = 0; y < GRID_ROWS; y++) {
    if (level.grid[y].length !== GRID_COLS) {
      issues.push(error('bad-grid-width', `Level ${level.id} row ${y} has ${level.grid[y].length} cols, expected ${GRID_COLS}`, undefined, y));
      return issues;
    }
  }

  const grid = level.grid.map((row) => row.map((tile) => tile as TileType));
  validateCounts(level.id, grid, issues);
  validateGeometry(level.id, grid, issues);
  validatePickupPlacement(level.id, grid, level.powerHelmet, issues);
  validateReachability(level, grid, issues);

  return issues;
}

export function assertValidLevelLayout(level: LevelLayout): void {
  const issues = validateLevelLayout(level).filter((issue) => issue.severity === 'error');
  if (issues.length === 0) return;

  const summary = issues
    .slice(0, 8)
    .map((issue) => {
      const at = typeof issue.x === 'number' && typeof issue.y === 'number'
        ? ` at (${issue.x}, ${issue.y})`
        : '';
      return `${issue.code}${at}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(`Level ${level.id} failed validation:\n${summary}`);
}

function validateCounts(levelId: number, grid: TileType[][], issues: LevelValidationIssue[]): void {
  let playerCount = 0;
  let badgeCount = 0;
  let duckCount = 0;

  forEachTile(grid, (tile) => {
    if (tile === TileType.PlayerSpawn) playerCount++;
    if (tile === TileType.Badge) badgeCount++;
    if (tile === TileType.DuckSpawn) duckCount++;
  });

  if (playerCount !== 1) {
    issues.push(error('player-spawn-count', `Level ${levelId} must have exactly one player spawn`));
  }

  if (badgeCount === 0) {
    issues.push(error('missing-badges', `Level ${levelId} must contain at least one money bag`));
  }

  if (levelId <= 5 && duckCount !== 1) {
    issues.push(error('onboarding-duck-count', `Level ${levelId} should teach one duck at a time`));
  }

  if (levelId >= 6 && duckCount < 2) {
    issues.push(error('midgame-duck-count', `Level ${levelId} should sustain mid-game pressure with at least two ducks`));
  }
}

function validateGeometry(levelId: number, grid: TileType[][], issues: LevelValidationIssue[]): void {
  forEachTile(grid, (tile, x, y) => {
    if (tile === TileType.Rope) {
      if (isSolid(grid[y + 1]?.[x])) {
        issues.push(error('rope-too-low', `Level ${levelId} rope is too close to the platform below`, x, y));
      }

      if (isSolid(grid[y - 1]?.[x]) || isSolid(grid[y - 2]?.[x])) {
        issues.push(error('rope-headroom', `Level ${levelId} rope needs two clear cells above it`, x, y));
      }
    }

    if (y > 0 && y < GRID_ROWS - 1 && !NON_LANE_TILES.has(tile) && isSolid(grid[y + 1]?.[x]) && isSolid(grid[y - 1]?.[x])) {
      issues.push(error('low-ceiling-lane', `Level ${levelId} has a supported running lane with no headroom`, x, y));
    }
  });
}

function validatePickupPlacement(
  levelId: number,
  grid: TileType[][],
  powerHelmet: Position | undefined,
  issues: LevelValidationIssue[],
): void {
  forEachTile(grid, (tile, x, y) => {
    if (tile !== TileType.Badge && tile !== TileType.DuckSpawn) return;

    if (NON_LANE_TILES.has(tileAt(grid, x, y))) {
      issues.push(error('pickup-on-traversal-tile', `Level ${levelId} pickup/spawn cannot sit inside traversal geometry`, x, y));
    }
  });

  if (!powerHelmet) return;

  const tile = tileAt(grid, powerHelmet.x, powerHelmet.y);
  if (tile !== TileType.Empty) {
    issues.push(error('powerup-not-empty', `Level ${levelId} power helmet must sit on an empty cell`, powerHelmet.x, powerHelmet.y));
  }

  if (!isSolid(grid[powerHelmet.y + 1]?.[powerHelmet.x])) {
    issues.push(error('powerup-not-supported', `Level ${levelId} power helmet must sit on a real platform`, powerHelmet.x, powerHelmet.y));
  }
}

function validateReachability(level: LevelLayout, rawGrid: TileType[][], issues: LevelValidationIssue[]): void {
  const runtimeGrid = cloneGrid(rawGrid);
  const spawn = findSpawnPosition(runtimeGrid, TileType.PlayerSpawn);
  if (!spawn) return;

  runtimeGrid[spawn.y][spawn.x] = TileType.Empty;
  forEachTile(runtimeGrid, (tile, x, y) => {
    if (tile === TileType.DuckSpawn) runtimeGrid[y][x] = TileType.Empty;
  });
  ensureHiddenExit(runtimeGrid, level.exitColumn);

  const normalReachable = floodFill(runtimeGrid, spawn, false);
  forEachTile(runtimeGrid, (tile, x, y) => {
    if (tile === TileType.Badge && !normalReachable.has(key(x, y))) {
      issues.push(error('unreachable-badge', `Level ${level.id} has an unreachable money bag`, x, y));
    }
  });

  const exitGrid = runtimeGrid.map((row) => row.map((tile) => tile === TileType.HiddenLadder ? TileType.Ladder : tile));
  const exitReachable = floodFill(exitGrid, spawn, true);
  const canEscape = Array.from(exitReachable).some((coord) => coord.endsWith(',0'));
  if (!canEscape) {
    issues.push(error('unreachable-exit', `Level ${level.id} has no reachable escape path after all money bags are collected`));
  }
}

function floodFill(grid: TileType[][], start: Position, hiddenLaddersRevealed: boolean): Set<string> {
  const reachable = new Set<string>();
  const queue: Position[] = [start];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const posKey = key(pos.x, pos.y);
    if (reachable.has(posKey)) continue;
    if (!inBounds(pos.x, pos.y) || isBlocked(grid, pos.x, pos.y, hiddenLaddersRevealed)) continue;

    reachable.add(posKey);

    const below = { x: pos.x, y: pos.y + 1 };
    if (inBounds(below.x, below.y) && !isSupported(grid, pos, hiddenLaddersRevealed)) {
      if (!isBlocked(grid, below.x, below.y, hiddenLaddersRevealed)) queue.push(below);
      continue;
    }

    for (const dx of [-1, 1]) {
      const next = { x: pos.x + dx, y: pos.y };
      if (inBounds(next.x, next.y) && !isBlocked(grid, next.x, next.y, hiddenLaddersRevealed)) {
        queue.push(next);
      }
    }

    if (isLadder(grid[pos.y][pos.x], hiddenLaddersRevealed) || isLadder(grid[pos.y - 1]?.[pos.x], hiddenLaddersRevealed)) {
      const up = { x: pos.x, y: pos.y - 1 };
      if (inBounds(up.x, up.y) && !isBlocked(grid, up.x, up.y, hiddenLaddersRevealed)) queue.push(up);
    }

    if (isLadder(grid[pos.y][pos.x], hiddenLaddersRevealed) || isLadder(grid[pos.y + 1]?.[pos.x], hiddenLaddersRevealed)) {
      const down = { x: pos.x, y: pos.y + 1 };
      if (inBounds(down.x, down.y) && !isBlocked(grid, down.x, down.y, hiddenLaddersRevealed)) queue.push(down);
    }

    if (grid[pos.y][pos.x] === TileType.Rope) {
      const drop = { x: pos.x, y: pos.y + 1 };
      if (inBounds(drop.x, drop.y) && !isBlocked(grid, drop.x, drop.y, hiddenLaddersRevealed)) queue.push(drop);
    }

    // Digging can create one-cell drops beside the player, which is essential Lode Runner routing.
    for (const dx of [-1, 1]) {
      const digX = pos.x + dx;
      const digY = pos.y + 1;
      const landingY = pos.y + 2;
      if (!inBounds(digX, landingY)) continue;
      if (!isDiggable(grid[digY]?.[digX])) continue;
      if (!isBlocked(grid, digX, landingY, hiddenLaddersRevealed)) {
        queue.push({ x: digX, y: landingY });
      }
    }
  }

  return reachable;
}

function forEachTile(grid: TileType[][], fn: (tile: TileType, x: number, y: number) => void): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      fn(grid[y][x], x, y);
    }
  }
}

function error(code: string, message: string, x?: number, y?: number): LevelValidationIssue {
  return { code, message, severity: 'error', x, y };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function tileAt(grid: TileType[][], x: number, y: number): TileType {
  if (!inBounds(x, y)) return TileType.Empty;
  return grid[y][x];
}

function isSolid(tile: TileType | undefined): boolean {
  return tile !== undefined && SOLID_TILES.has(tile);
}

function isDiggable(tile: TileType | undefined): boolean {
  return tile === TileType.Sand || tile === TileType.TrapSand;
}

function isLadder(tile: TileType | undefined, hiddenLaddersRevealed: boolean): boolean {
  return tile === TileType.Ladder || (hiddenLaddersRevealed && tile === TileType.HiddenLadder);
}

function isBlocked(grid: TileType[][], x: number, y: number, hiddenLaddersRevealed: boolean): boolean {
  const tile = tileAt(grid, x, y);
  if (tile === TileType.HiddenLadder) return false;
  return isSolid(tile);
}

function isSupported(grid: TileType[][], pos: Position, hiddenLaddersRevealed: boolean): boolean {
  if (pos.y >= GRID_ROWS - 1) return true;
  const here = tileAt(grid, pos.x, pos.y);
  if (isLadder(here, hiddenLaddersRevealed) || here === TileType.Rope) return true;
  const below = tileAt(grid, pos.x, pos.y + 1);
  return isSolid(below) || isLadder(below, hiddenLaddersRevealed);
}
