import { describe, it, expect } from 'vitest';
import {
  GRID_COLS, GRID_ROWS, TILE_SIZE,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  HOLE_REGEN_TIME, LFV_DURATION,
  VIBE_MAX, VIBE_PER_BADGE,
  STARTING_LIVES, COLORS
} from '@/constants';

describe('Constants', () => {
  it('canvas dimensions match grid * tile size', () => {
    expect(CANVAS_WIDTH).toBe(GRID_COLS * TILE_SIZE);
    expect(CANVAS_HEIGHT).toBe((GRID_ROWS + 1) * TILE_SIZE);
  });

  it('grid is standard Lode Runner size', () => {
    expect(GRID_COLS).toBe(28);
    expect(GRID_ROWS).toBe(16);
  });

  it('vibe meter can be filled by collecting badges alone', () => {
    const badgesNeeded = VIBE_MAX / VIBE_PER_BADGE;
    expect(badgesNeeded).toBeLessThanOrEqual(15);
  });

  it('hole regen time is longer than LFV duration', () => {
    expect(HOLE_REGEN_TIME).toBeGreaterThan(LFV_DURATION);
  });

  it('player starts with multiple lives', () => {
    expect(STARTING_LIVES).toBeGreaterThanOrEqual(3);
  });

  it('GVC palette has required brand colors', () => {
    expect(COLORS.cream).toBeDefined();
    expect(COLORS.black).toBeDefined();
    expect(COLORS.silver).toBeDefined();
  });
});
