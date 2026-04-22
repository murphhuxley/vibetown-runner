// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { detectTouch } from '@/engine/MobileBoot';

describe('detectTouch', () => {
  beforeEach(() => {
    delete (window as unknown as { ontouchstart?: unknown }).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });

  it('returns false when no touch capability', () => {
    expect(detectTouch()).toBe(false);
  });

  it('returns true when ontouchstart exists', () => {
    (window as unknown as { ontouchstart: unknown }).ontouchstart = null;
    expect(detectTouch()).toBe(true);
  });

  it('returns true when maxTouchPoints > 0', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    expect(detectTouch()).toBe(true);
  });
});
