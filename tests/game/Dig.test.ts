import { describe, it, expect } from 'vitest';
import { canDig, createHole, updateHoles } from '@/game/Dig';
import { TileType, Direction } from '@/types';
import { GRID_COLS, GRID_ROWS, HOLE_REGEN_TIME } from '@/constants';

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

  it('cannot dig when hanging on rope', () => {
    const grid = floorGrid();
    grid[10][5] = TileType.Rope;
    expect(canDig(grid, { x: 5, y: 10 }, Direction.Left, true)).toBe(false);
  });

  it('createHole removes tile and returns Hole', () => {
    const grid = floorGrid();
    const hole = createHole(grid, { x: 5, y: 14 });
    expect(grid[14][5]).toBe(TileType.Empty);
    expect(hole.x).toBe(5);
    expect(hole.y).toBe(14);
    expect(hole.timer).toBe(HOLE_REGEN_TIME);
    expect(hole.phase).toBe('open');
  });

  it('updateHoles regenerates tile when timer expires', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Empty;
    const holes = [{ x: 5, y: 14, timer: 100, phase: 'open' as const }];
    const remaining = updateHoles(holes, grid, 200);
    expect(remaining.length).toBe(0);
    expect(grid[14][5]).toBe(TileType.Sand);
  });

  it('updateHoles decrements timer when not expired', () => {
    const grid = floorGrid();
    grid[14][5] = TileType.Empty;
    const holes = [{ x: 5, y: 14, timer: 5000, phase: 'open' as const }];
    const remaining = updateHoles(holes, grid, 100);
    expect(remaining.length).toBe(1);
    expect(remaining[0].timer).toBe(4900);
  });
});
