import { describe, it, expect } from 'vitest';
import { createConfettiBurst, updateConfetti } from '@/game/Confetti';

describe('Confetti', () => {
  it('creates a visible burst from a tile position', () => {
    const burst = createConfettiBurst({ x: 3, y: 4 });

    expect(burst.length).toBeGreaterThan(10);
    expect(burst.every((piece) => piece.life > 0)).toBe(true);
  });

  it('updates pieces over time and eventually removes them', () => {
    const burst = createConfettiBurst({ x: 3, y: 4 });
    const updated = updateConfetti(burst, 100);
    const cleared = updateConfetti(updated, 2_000);

    expect(updated.length).toBe(burst.length);
    expect(cleared).toHaveLength(0);
  });
});
