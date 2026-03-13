import { describe, it, expect } from 'vitest';
import { createDuck, moveDuckToward, trapDuck, updateTrappedDuck } from '@/game/Duck';
import { TileType, Direction } from '@/types';
import { GRID_COLS, GRID_ROWS, DUCK_TRAP_ESCAPE_TIME } from '@/constants';

function floorGrid(): TileType[][] {
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
  grid[GRID_ROWS - 1] = Array(GRID_COLS).fill(TileType.Sand);
  return grid;
}

describe('Duck', () => {
  it('creates duck at spawn position', () => {
    const duck = createDuck(0, { x: 10, y: 14 });
    expect(duck.id).toBe(0);
    expect(duck.pos).toEqual({ x: 10, y: 14 });
    expect(duck.isTrapped).toBe(false);
    expect(duck.carryingBadge).toBe(false);
  });

  it('moves toward player horizontally on same row', () => {
    const grid = floorGrid();
    const duck = createDuck(0, { x: 10, y: 14 });
    const playerPos = { x: 5, y: 14 };
    const moved = moveDuckToward(duck, grid, playerPos, []);
    expect(moved.pos.x).toBeLessThan(10);
  });

  it('does not move when trapped', () => {
    const grid = floorGrid();
    const duck = createDuck(0, { x: 10, y: 14 });
    duck.isTrapped = true;
    const playerPos = { x: 5, y: 14 };
    const moved = moveDuckToward(duck, grid, playerPos, []);
    expect(moved.pos.x).toBe(10);
  });

  it('trapping sets isTrapped and starts timer', () => {
    const duck = createDuck(0, { x: 10, y: 14 });
    trapDuck(duck);
    expect(duck.isTrapped).toBe(true);
    expect(duck.trapTimer).toBe(DUCK_TRAP_ESCAPE_TIME);
  });

  it('trapped duck escapes after timer expires', () => {
    const duck = createDuck(0, { x: 10, y: 14 });
    trapDuck(duck);
    const escaped = updateTrappedDuck(duck, DUCK_TRAP_ESCAPE_TIME + 100);
    expect(escaped).toBe(true);
    expect(duck.isTrapped).toBe(false);
  });

  it('trapped duck drops badge', () => {
    const duck = createDuck(0, { x: 10, y: 14 });
    duck.carryingBadge = true;
    trapDuck(duck);
    expect(duck.carryingBadge).toBe(false);
  });
});
