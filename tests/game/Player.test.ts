import { describe, it, expect } from 'vitest';
import { createPlayer, movePlayer, canClimb, canTraverseRope } from '@/game/Player';
import { TileType, Direction } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

function emptyGrid(): TileType[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
}

function floorGrid(): TileType[][] {
  const grid = emptyGrid();
  grid[GRID_ROWS - 1] = Array(GRID_COLS).fill(TileType.Sand);
  return grid;
}

describe('Player', () => {
  const groundedY = GRID_ROWS - 2;

  it('creates player at spawn position', () => {
    const player = createPlayer({ x: 5, y: groundedY });
    expect(player.pos).toEqual({ x: 5, y: groundedY });
    expect(player.alive).toBe(true);
    expect(player.facing).toBe(Direction.Right);
  });

  it('moves left on solid ground', () => {
    const grid = floorGrid();
    const player = createPlayer({ x: 5, y: groundedY });
    const moved = movePlayer(player, grid, Direction.Left);
    expect(moved.pos.x).toBe(4);
    expect(moved.facing).toBe(Direction.Left);
  });

  it('moves right on solid ground', () => {
    const grid = floorGrid();
    const player = createPlayer({ x: 5, y: groundedY });
    const moved = movePlayer(player, grid, Direction.Right);
    expect(moved.pos.x).toBe(6);
  });

  it('cannot move into solid tile', () => {
    const grid = floorGrid();
    grid[groundedY][4] = TileType.Coral;
    const player = createPlayer({ x: 5, y: groundedY });
    const moved = movePlayer(player, grid, Direction.Left);
    expect(moved.pos.x).toBe(5);
  });

  it('cannot move out of bounds', () => {
    const grid = floorGrid();
    const player = createPlayer({ x: 0, y: groundedY });
    const moved = movePlayer(player, grid, Direction.Left);
    expect(moved.pos.x).toBe(0);
  });

  it('can climb ladder', () => {
    const grid = floorGrid();
    grid[groundedY][5] = TileType.Ladder;
    grid[groundedY - 1][5] = TileType.Ladder;
    expect(canClimb(grid, { x: 5, y: groundedY })).toBe(true);
  });

  it('moves up on ladder', () => {
    const grid = floorGrid();
    grid[groundedY][5] = TileType.Ladder;
    grid[groundedY - 1][5] = TileType.Ladder;
    const player = createPlayer({ x: 5, y: groundedY });
    player.isOnLadder = true;
    const moved = movePlayer(player, grid, Direction.Up);
    expect(moved.pos.y).toBe(groundedY - 1);
  });

  it('can traverse rope', () => {
    const grid = floorGrid();
    grid[10][5] = TileType.Rope;
    expect(canTraverseRope(grid, { x: 5, y: 10 })).toBe(true);
  });
});
