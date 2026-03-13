import { describe, it, expect } from 'vitest';
import { isSupported, isSolid, canMoveTo } from '@/game/Physics';
import { TileType } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

function emptyGrid(): TileType[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array(GRID_COLS).fill(TileType.Empty)
  );
}

describe('Physics', () => {
  describe('isSolid', () => {
    it('Sand is solid', () => expect(isSolid(TileType.Sand)).toBe(true));
    it('Coral is solid', () => expect(isSolid(TileType.Coral)).toBe(true));
    it('Empty is not solid', () => expect(isSolid(TileType.Empty)).toBe(false));
    it('Ladder is not solid', () => expect(isSolid(TileType.Ladder)).toBe(false));
    it('TrapSand is not solid', () => expect(isSolid(TileType.TrapSand)).toBe(false));
  });

  describe('isSupported', () => {
    it('supported when tile below is solid', () => {
      const grid = emptyGrid();
      grid[10][5] = TileType.Sand;
      expect(isSupported(grid, { x: 5, y: 9 })).toBe(true);
    });

    it('supported at bottom row', () => {
      const grid = emptyGrid();
      expect(isSupported(grid, { x: 5, y: GRID_ROWS - 1 })).toBe(true);
    });

    it('not supported over empty space', () => {
      const grid = emptyGrid();
      expect(isSupported(grid, { x: 5, y: 5 })).toBe(false);
    });

    it('supported when on a ladder', () => {
      const grid = emptyGrid();
      grid[5][5] = TileType.Ladder;
      expect(isSupported(grid, { x: 5, y: 5 }, true)).toBe(true);
    });

    it('supported when on a rope', () => {
      const grid = emptyGrid();
      grid[5][5] = TileType.Rope;
      expect(isSupported(grid, { x: 5, y: 5 }, false, true)).toBe(true);
    });
  });

  describe('canMoveTo', () => {
    it('can move to empty space', () => {
      const grid = emptyGrid();
      expect(canMoveTo(grid, { x: 5, y: 5 })).toBe(true);
    });

    it('cannot move into solid tile', () => {
      const grid = emptyGrid();
      grid[5][5] = TileType.Coral;
      expect(canMoveTo(grid, { x: 5, y: 5 })).toBe(false);
    });

    it('can move into ladder', () => {
      const grid = emptyGrid();
      grid[5][5] = TileType.Ladder;
      expect(canMoveTo(grid, { x: 5, y: 5 })).toBe(true);
    });

    it('cannot move out of bounds', () => {
      const grid = emptyGrid();
      expect(canMoveTo(grid, { x: -1, y: 5 })).toBe(false);
      expect(canMoveTo(grid, { x: GRID_COLS, y: 5 })).toBe(false);
      expect(canMoveTo(grid, { x: 5, y: -1 })).toBe(false);
      expect(canMoveTo(grid, { x: 5, y: GRID_ROWS })).toBe(false);
    });
  });
});
