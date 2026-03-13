import { describe, it, expect } from 'vitest';
import { createDrop, collectDrop, updateDrops } from '@/game/Vibestr';

describe('Vibestr', () => {
  it('creates a drop at position', () => {
    const drop = createDrop({ x: 5, y: 10 });
    expect(drop.pos).toEqual({ x: 5, y: 10 });
    expect(drop.collected).toBe(false);
  });

  it('collects a drop when player is at same position', () => {
    const drops = [createDrop({ x: 5, y: 10 })];
    const collected = collectDrop(drops, { x: 5, y: 10 });
    expect(collected).toBe(true);
    expect(drops[0].collected).toBe(true);
  });

  it('does not collect when player is elsewhere', () => {
    const drops = [createDrop({ x: 5, y: 10 })];
    const collected = collectDrop(drops, { x: 6, y: 10 });
    expect(collected).toBe(false);
  });

  it('updateDrops removes collected drops', () => {
    const drops = [createDrop({ x: 5, y: 10 }), createDrop({ x: 8, y: 10 })];
    drops[0].collected = true;
    const remaining = updateDrops(drops);
    expect(remaining.length).toBe(1);
    expect(remaining[0].pos.x).toBe(8);
  });
});
