import { describe, it, expect } from 'vitest';
import {
  createDuckDeathEffect,
  updateDuckDeathEffects,
  DUCK_DEATH_FRAME_COUNT,
  DUCK_DEATH_FRAME_MS,
} from '@/game/DuckDeath';

describe('DuckDeath', () => {
  it('starts at the duck tile with zero elapsed time', () => {
    const effect = createDuckDeathEffect({ x: 5, y: 7 });

    expect(effect.pos).toEqual({ x: 5, y: 7 });
    expect(effect.elapsed).toBe(0);
  });

  it('advances and clears after the animation has finished', () => {
    const initial = [createDuckDeathEffect({ x: 1, y: 2 })];
    const updated = updateDuckDeathEffects(initial, DUCK_DEATH_FRAME_MS);
    const cleared = updateDuckDeathEffects(updated, DUCK_DEATH_FRAME_COUNT * DUCK_DEATH_FRAME_MS);

    expect(updated[0]?.elapsed).toBe(DUCK_DEATH_FRAME_MS);
    expect(cleared).toHaveLength(0);
  });
});
