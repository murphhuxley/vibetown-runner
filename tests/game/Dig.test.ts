import { describe, it, expect } from 'vitest';
import { canDig, createHole, updateHoles } from '@/game/Dig';
import { TileType, Direction } from '@/types';
import { GRID_COLS, GRID_ROWS, HOLE_REGEN_TIME, HOLE_OPEN_ANIM, HOLE_CLOSE_ANIM } from '@/constants';

function floorGrid(): TileType[][] {
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
  grid[GRID_ROWS - 1] = Array(GRID_COLS).fill(TileType.Sand);
  return grid;
}

describe('Dig', () => {
  it('can dig sand tile diagonally below', () => {
    const grid = floorGrid();
    grid[14][4] = TileType.Sand;
    expect(canDig(grid, { x: 5, y: 13 }, Direction.Left)).toBe(true);
  });

  it('cannot dig coral', () => {
    const grid = floorGrid();
    grid[14][4] = TileType.Coral;
    expect(canDig(grid, { x: 5, y: 13 }, Direction.Left)).toBe(false);
  });

  it('can dig when hanging on rope like the original hand-to-hand bar rules', () => {
    const grid = floorGrid();
    grid[10][5] = TileType.Rope;
    grid[11][4] = TileType.Sand;
    expect(canDig(grid, { x: 5, y: 10 }, Direction.Left, true)).toBe(true);
  });

  it('createHole starts in opening phase before the brick is actually removed', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Sand;
    const hole = createHole(grid, { x: 5, y: 14 }, Direction.Right);
    expect(grid[14][5]).toBe(TileType.Sand);
    expect(hole.x).toBe(5);
    expect(hole.y).toBe(14);
    expect(hole.timer).toBe(HOLE_OPEN_ANIM);
    expect(hole.phase).toBe('opening');
    expect(hole.fillTile).toBe(TileType.Sand);
    expect(hole.direction).toBe(Direction.Right);
  });

  it('updateHoles opens the hole after the opening animation', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Sand;
    const hole = createHole(grid, { x: 5, y: 14 }, Direction.Right);
    const update = updateHoles([hole], grid, HOLE_OPEN_ANIM + 10);
    expect(update.holes.length).toBe(1);
    expect(update.holes[0].phase).toBe('open');
    expect(update.holes[0].timer).toBe(HOLE_REGEN_TIME);
    expect(grid[14][5]).toBe(TileType.Empty);
  });

  it('updateHoles transitions from open to closing before restoring the brick', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Empty;
    const holes = [{ x: 5, y: 14, timer: 100, phase: 'open' as const, fillTile: TileType.Sand as const, direction: Direction.Right as const }];
    const update = updateHoles(holes, grid, 200);
    expect(update.holes.length).toBe(1);
    expect(update.holes[0].phase).toBe('closing');
    expect(update.holes[0].timer).toBe(HOLE_CLOSE_ANIM);
    expect(grid[14][5]).toBe(TileType.Empty);
  });

  it('updateHoles restores the brick when the closing animation finishes', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Empty;
    const holes = [{ x: 5, y: 14, timer: 50, phase: 'closing' as const, fillTile: TileType.Sand as const, direction: Direction.Right as const }];
    const update = updateHoles(holes, grid, 100);
    expect(update.holes.length).toBe(0);
    expect(update.closed).toEqual([{ x: 5, y: 14 }]);
    expect(grid[14][5]).toBe(TileType.Sand);
  });
});
