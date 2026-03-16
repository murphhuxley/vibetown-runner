import { Position } from '@/types';

export interface DuckDeathEffect {
  pos: Position;
  elapsed: number;
}

export const DUCK_DEATH_FRAME_MS = 90;
export const DUCK_DEATH_FRAME_COUNT = 8;
const DUCK_DEATH_TOTAL_MS = DUCK_DEATH_FRAME_MS * DUCK_DEATH_FRAME_COUNT;

export function createDuckDeathEffect(pos: Position): DuckDeathEffect {
  return {
    pos: { ...pos },
    elapsed: 0,
  };
}

export function updateDuckDeathEffects(effects: DuckDeathEffect[], dt: number): DuckDeathEffect[] {
  return effects
    .map((effect) => ({
      ...effect,
      elapsed: effect.elapsed + dt,
    }))
    .filter((effect) => effect.elapsed < DUCK_DEATH_TOTAL_MS);
}
