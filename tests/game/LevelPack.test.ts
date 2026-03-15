import { describe, it, expect } from 'vitest';
import { LEVELS } from '@/levels/catalog';
import { parseLevel, countBadges, findSpawnPosition } from '@/game/Level';
import { TileType } from '@/types';

describe('Level pack', () => {
  it('contains at least 25 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(25);
  });

  it('has unique level ids', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every level parseable and playable', () => {
    for (const rawLevel of LEVELS) {
      const level = parseLevel(rawLevel);
      expect(findSpawnPosition(level.grid, TileType.PlayerSpawn), `player spawn missing in level ${level.id}`).not.toBeNull();
      expect(countBadges(level.grid), `badges missing in level ${level.id}`).toBeGreaterThan(0);
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
});
