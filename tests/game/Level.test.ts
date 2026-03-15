import { describe, it, expect } from 'vitest';
import { parseLevel, countBadges, findSpawnPosition, ensureHiddenExit } from '@/game/Level';
import { TileType, WeatherType } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

const MINIMAL_LEVEL = {
  id: 1,
  name: 'Test Level',
  weather: 'none',
  npcs: [],
  grid: Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => {
      if (y === GRID_ROWS - 1) return TileType.Sand;
      if (x === 0 && y === 0) return TileType.PlayerSpawn;
      if (x === 5 && y === 0) return TileType.Badge;
      if (x === 10 && y === 0) return TileType.DuckSpawn;
      return TileType.Empty;
    })
  ),
};

describe('Level', () => {
  it('parses a valid level JSON into LevelData', () => {
    const level = parseLevel(MINIMAL_LEVEL);
    expect(level.id).toBe(1);
    expect(level.name).toBe('Test Level');
    expect(level.grid.length).toBe(GRID_ROWS);
    expect(level.grid[0].length).toBe(GRID_COLS);
    expect(level.weather).toBe(WeatherType.None);
  });

  it('parses authored exit metadata', () => {
    const level = parseLevel({ ...MINIMAL_LEVEL, exitColumn: 7 });
    expect(level.exitColumn).toBe(7);
  });

  it('rejects levels with wrong grid dimensions', () => {
    const bad = { ...MINIMAL_LEVEL, grid: [[0, 1]] };
    expect(() => parseLevel(bad)).toThrow();
  });

  it('counts badges in a level', () => {
    const level = parseLevel(MINIMAL_LEVEL);
    expect(countBadges(level.grid)).toBe(1);
  });

  it('finds player spawn position', () => {
    const level = parseLevel(MINIMAL_LEVEL);
    const spawn = findSpawnPosition(level.grid, TileType.PlayerSpawn);
    expect(spawn).toEqual({ x: 0, y: 0 });
  });

  it('finds duck spawn position', () => {
    const level = parseLevel(MINIMAL_LEVEL);
    const spawn = findSpawnPosition(level.grid, TileType.DuckSpawn);
    expect(spawn).toEqual({ x: 10, y: 0 });
  });

  it('builds a deterministic hidden exit when the level has no authored ladder tiles', () => {
    const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
    grid[2] = Array(GRID_COLS).fill(TileType.Sand);

    const exitColumn = ensureHiddenExit(grid, 6);

    expect(exitColumn).toBe(6);
    expect(grid[0][6]).toBe(TileType.HiddenLadder);
    expect(grid[1][6]).toBe(TileType.HiddenLadder);
  });

  it('keeps authored hidden ladder tiles intact', () => {
    const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TileType.Empty));
    grid[2] = Array(GRID_COLS).fill(TileType.Sand);
    grid[0][4] = TileType.HiddenLadder;
    grid[1][4] = TileType.HiddenLadder;

    const exitColumn = ensureHiddenExit(grid, 6);

    expect(exitColumn).toBeNull();
    expect(grid[0][4]).toBe(TileType.HiddenLadder);
    expect(grid[0][6]).toBe(TileType.Empty);
  });
});
