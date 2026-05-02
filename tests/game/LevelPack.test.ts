import { describe, it, expect } from 'vitest';
import { LEVELS, LEVEL_VARIANT_SLOTS, MASTER_LEVELS, randomizeLevels } from '@/levels/catalog';
import { parseLevel, countBadges, findSpawnPosition } from '@/game/Level';
import { validateLevelLayout } from '@/game/LevelValidator';
import { TileType } from '@/types';
import { GameManager } from '@/game/GameManager';
import { InputManager } from '@/engine/Input';

const SOLID_TILES = new Set([TileType.Sand, TileType.Coral, TileType.TrapSand]);

function countTile(grid: number[][], tile: TileType): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === tile) count++;
    }
  }
  return count;
}

function getAllVariants() {
  return LEVEL_VARIANT_SLOTS.flatMap((slot) => slot);
}

function isSolid(cell: number | undefined): boolean {
  return cell !== undefined && SOLID_TILES.has(cell as TileType);
}

function hasPlatformBelow(grid: number[][], x: number, y: number): boolean {
  return isSolid(grid[y + 1]?.[x]);
}

const EXPECTED_BADGES = new Map([
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 7], [7, 7], [8, 7], [9, 8], [10, 8],
  [11, 8], [12, 8], [13, 8], [14, 9], [15, 9],
  [16, 9], [17, 9], [18, 9], [19, 9], [20, 10],
  [21, 10], [22, 10], [23, 10], [24, 11], [25, 12],
]);

const EXPECTED_DUCKS = new Map([
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
  [6, 2], [7, 2], [8, 2], [9, 2], [10, 2],
  [11, 2], [12, 2], [13, 2], [14, 3], [15, 3],
  [16, 3], [17, 3], [18, 3], [19, 3], [20, 4],
  [21, 3], [22, 3], [23, 3], [24, 4], [25, 4],
]);

describe('Level pack', () => {
  it('contains at least 25 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(25);
  });

  it('has unique level ids', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every level parseable and playable', () => {
    for (const rawLevel of getAllVariants()) {
      const level = parseLevel(rawLevel);
      expect(findSpawnPosition(level.grid, TileType.PlayerSpawn), `player spawn missing in level ${level.id}`).not.toBeNull();
      expect(countBadges(level.grid), `badges missing in level ${level.id}`).toBeGreaterThan(0);
    }
  });

  it('passes the campaign layout validator for every curated variant', () => {
    for (const rawLevel of getAllVariants()) {
      expect(validateLevelLayout(rawLevel), `layout issues in level ${rawLevel.id}`).toEqual([]);
    }
  });

  it('keeps at least two ducks in every post-onboarding level', () => {
    for (const rawLevel of LEVELS.filter((level) => level.id >= 6)) {
      let duckCount = 0;
      for (const row of rawLevel.grid) {
        for (const cell of row) {
          if (cell === TileType.DuckSpawn) duckCount++;
        }
      }
      expect(duckCount, `duck pressure too low in level ${rawLevel.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the onboarding levels at one duck each', () => {
    for (const rawLevel of LEVELS.filter((level) => level.id <= 5)) {
      let duckCount = 0;
      for (const row of rawLevel.grid) {
        for (const cell of row) {
          if (cell === TileType.DuckSpawn) duckCount++;
        }
      }
      expect(duckCount, `opening level ${rawLevel.id} should only teach one duck at a time`).toBe(1);
    }
  });

  it('draws each restart from the curated variant slots', () => {
    randomizeLevels(() => 0);

    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].grid).toEqual(MASTER_LEVELS[i].grid);
      expect(LEVELS[i].grid).not.toBe(MASTER_LEVELS[i].grid);
    }
  });

  it('can choose alternate curated variants for the early campaign slots', () => {
    randomizeLevels(() => 0.999999);

    for (let i = 0; i < 5; i++) {
      const slot = LEVEL_VARIANT_SLOTS[i];
      expect(slot.length, `level slot ${i + 1} should have multiple curated variants`).toBeGreaterThan(1);
      expect(LEVELS[i].grid).toEqual(slot[slot.length - 1].grid);
      expect(LEVELS[i].grid).not.toEqual(MASTER_LEVELS[i].grid);
    }
  });

  it('offers at least two variants for every campaign slot', () => {
    for (let i = 0; i < LEVEL_VARIANT_SLOTS.length; i++) {
      expect(LEVEL_VARIANT_SLOTS[i].length, `level slot ${i + 1} needs replay variety`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the curated badge and duck counts on every restart', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      randomizeLevels();

      for (const level of LEVELS) {
        expect(countTile(level.grid, TileType.Badge), `badge count drifted in level ${level.id}`).toBe(EXPECTED_BADGES.get(level.id));
        expect(countTile(level.grid, TileType.DuckSpawn), `duck count drifted in level ${level.id}`).toBe(EXPECTED_DUCKS.get(level.id));
      }
    }
  });

  it('keeps rope rows from sitting directly over standable platform tiles', () => {
    for (const level of getAllVariants()) {
      for (let y = 0; y < level.grid.length - 1; y++) {
        for (let x = 0; x < level.grid[y].length; x++) {
          if (level.grid[y][x] !== TileType.Rope) continue;
          expect(
            SOLID_TILES.has(level.grid[y + 1][x]),
            `rope at (${x}, ${y}) in level ${level.id} is too close to the platform below`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps at least two clear cells above every rope tile', () => {
    for (const level of getAllVariants()) {
      for (let y = 2; y < level.grid.length; y++) {
        for (let x = 0; x < level.grid[y].length; x++) {
          if (level.grid[y][x] !== TileType.Rope) continue;
          expect(
            isSolid(level.grid[y - 1]?.[x]) || isSolid(level.grid[y - 2]?.[x]),
            `rope at (${x}, ${y}) in level ${level.id} does not have enough headroom above it`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps supported running lanes free of direct ceiling collisions', () => {
    const nonLaneTiles = new Set([TileType.Ladder, TileType.Rope, TileType.HiddenLadder]);

    for (const level of getAllVariants()) {
      for (let y = 1; y < level.grid.length - 1; y++) {
        for (let x = 0; x < level.grid[y].length; x++) {
          const tile = level.grid[y][x] as TileType;
          if (nonLaneTiles.has(tile)) continue;
          if (!hasPlatformBelow(level.grid, x, y)) continue;

          expect(
            isSolid(level.grid[y - 1]?.[x]),
            `tile at (${x}, ${y}) in level ${level.id} is a low-ceiling running lane`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps authored power helmets on platform-supported empty tiles', () => {
    for (const level of getAllVariants()) {
      if (!level.powerHelmet) continue;

      const { x, y } = level.powerHelmet;
      expect(level.grid[y][x], `level ${level.id} power helmet must stay on an empty tile`).toBe(TileType.Empty);
      expect(level.grid[y][x] === TileType.Ladder || level.grid[y][x] === TileType.Rope, `level ${level.id} power helmet cannot sit on ladder/rope`).toBe(false);
      expect(hasPlatformBelow(level.grid, x, y), `level ${level.id} power helmet needs a real platform under it`).toBe(true);
    }
  });

  it('keeps the authored level 3 helmet tile free for the pickup', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      randomizeLevels();

      const levelThree = LEVELS.find((level) => level.id === 3);
      expect(levelThree).toBeDefined();
      expect(levelThree?.powerHelmet).toEqual({ x: 12, y: 4 });
      expect(levelThree?.grid[4][12]).not.toBe(TileType.Badge);
      expect(levelThree?.grid[4][12]).not.toBe(TileType.DuckSpawn);
    }
  });

  it('can load every campaign level in sequence through the game manager', () => {
    const game = new GameManager(new InputManager());

    for (let index = 0; index < LEVELS.length; index++) {
      expect(game.loadLevel(index), `failed to load campaign level ${index + 1}`).toBe(true);
      expect(game.state.currentLevel).toBe(index + 1);
      expect(game.state.badgesTotal, `level ${index + 1} should keep badges`).toBeGreaterThan(0);

      const solidTiles = game.state.grid.flat().filter((tile) => (
        tile === TileType.Sand || tile === TileType.Coral || tile === TileType.TrapSand
      ));
      expect(solidTiles.length, `level ${index + 1} should contain traversable geometry`).toBeGreaterThan(0);
    }

    expect(game.loadLevel(LEVELS.length)).toBe(false);
  });
});
