import { describe, it, expect } from 'vitest';
import { createDuck, moveDuckToward, trapDuck, updateTrappedDuck, respawnDuck } from '@/game/Duck';
import { TileType, Direction } from '@/types';
import { GRID_COLS, GRID_ROWS, DUCK_TRAP_ESCAPE_TIME } from '@/constants';

function floorGrid(): TileType[][] {
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
  grid[GRID_ROWS - 1] = Array(GRID_COLS).fill(TileType.Sand);
  return grid;
}

describe('Duck', () => {
  const groundedY = GRID_ROWS - 2;

  it('creates duck at spawn position', () => {
    const duck = createDuck(0, { x: 10, y: groundedY });
    expect(duck.id).toBe(0);
    expect(duck.pos).toEqual({ x: 10, y: groundedY });
    expect(duck.isTrapped).toBe(false);
    expect(duck.carryingBadge).toBe(false);
  });

  it('moves toward player horizontally on same row', () => {
    const grid = floorGrid();
    const duck = createDuck(0, { x: 10, y: groundedY });
    const playerPos = { x: 5, y: groundedY };
    const moved = moveDuckToward(duck, grid, playerPos, []);
    expect(moved.pos.x).toBeLessThan(10);
  });

  it('will step into an open hole when chasing the player', () => {
    const grid = floorGrid();
    grid[GRID_ROWS - 1][9] = TileType.Empty;

    const duck = createDuck(0, { x: 10, y: groundedY });
    const playerPos = { x: 5, y: groundedY };
    const moved = moveDuckToward(duck, grid, playerPos, []);

    expect(moved.pos).toEqual({ x: 9, y: groundedY });
  });

  it('moves toward a nearby ladder when the player is above', () => {
    const grid = floorGrid();
    for (let y = groundedY - 3; y <= groundedY; y++) {
      grid[y][9] = TileType.Ladder;
    }

    const duck = createDuck(0, { x: 11, y: groundedY });
    const playerPos = { x: 9, y: groundedY - 3 };
    const moved = moveDuckToward(duck, grid, playerPos, []);

    expect(moved.pos).toEqual({ x: 10, y: groundedY });
  });

  it('climbs upward when the player is above on the same ladder route', () => {
    const grid = floorGrid();
    for (let y = groundedY - 3; y <= groundedY; y++) {
      grid[y][10] = TileType.Ladder;
    }

    const duck = createDuck(0, { x: 10, y: groundedY });
    const moved = moveDuckToward(duck, grid, { x: 10, y: groundedY - 3 }, []);

    expect(moved.pos).toEqual({ x: 10, y: groundedY - 1 });
  });

  it('faces toward the player while descending a ladder', () => {
    const grid = floorGrid();
    for (let y = groundedY - 3; y <= groundedY; y++) {
      grid[y][10] = TileType.Ladder;
    }

    const duck = createDuck(0, { x: 10, y: groundedY - 2 });
    duck.isOnLadder = true;
    duck.facing = Direction.Left;

    const moved = moveDuckToward(duck, grid, { x: 14, y: groundedY }, []);

    expect(moved.pos).toEqual({ x: 10, y: groundedY - 1 });
    expect(moved.facing).toBe(Direction.Right);
  });

  it('does not move when trapped', () => {
    const grid = floorGrid();
    const duck = createDuck(0, { x: 10, y: groundedY });
    duck.isTrapped = true;
    const playerPos = { x: 5, y: groundedY };
    const moved = moveDuckToward(duck, grid, playerPos, []);
    expect(moved.pos.x).toBe(10);
  });

  it('trapping sets isTrapped and starts timer', () => {
    const duck = createDuck(0, { x: 10, y: groundedY });
    trapDuck(duck);
    expect(duck.isTrapped).toBe(true);
    expect(duck.trapTimer).toBe(DUCK_TRAP_ESCAPE_TIME);
  });

  it('trapped duck escapes after timer expires', () => {
    const duck = createDuck(0, { x: 10, y: groundedY });
    trapDuck(duck);
    const escaped = updateTrappedDuck(duck, DUCK_TRAP_ESCAPE_TIME + 100);
    expect(escaped).toBe(true);
    expect(duck.isTrapped).toBe(false);
  });

  it('trapped duck drops badge', () => {
    const duck = createDuck(0, { x: 10, y: groundedY });
    duck.carryingBadge = true;
    trapDuck(duck);
    expect(duck.carryingBadge).toBe(false);
  });

  it('respawns as far from the player as possible on the top row', () => {
    const grid = floorGrid();
    const duck = createDuck(0, { x: 10, y: groundedY });

    respawnDuck(duck, grid, { x: 13, y: groundedY });

    expect(duck.pos.y).toBe(0);
    expect([0, GRID_COLS - 1]).toContain(duck.pos.x);
  });
});
