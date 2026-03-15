import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from '@/engine/Input';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  it('registers key down', () => {
    input.handleKeyDown('ArrowLeft');
    expect(input.isDown('ArrowLeft')).toBe(true);
  });

  it('registers key up', () => {
    input.handleKeyDown('ArrowLeft');
    input.handleKeyUp('ArrowLeft');
    expect(input.isDown('ArrowLeft')).toBe(false);
  });

  it('maps WASD to directions', () => {
    input.handleKeyDown('a');
    expect(input.left).toBe(true);
    input.handleKeyDown('d');
    expect(input.right).toBe(true);
    input.handleKeyDown('w');
    expect(input.up).toBe(true);
    input.handleKeyDown('s');
    expect(input.down).toBe(true);
  });

  it('maps arrow keys to directions', () => {
    input.handleKeyDown('ArrowLeft');
    expect(input.left).toBe(true);
  });

  it('maps z/x/c to dig left/right', () => {
    input.handleKeyDown('z');
    expect(input.digLeft).toBe(true);
    input.handleKeyDown('x');
    expect(input.digRight).toBe(true);
    input.handleKeyDown('c');
    expect(input.digRight).toBe(true);
  });

  it('detects LFV activation on spacebar', () => {
    input.handleKeyDown(' ');
    expect(input.activateLFV).toBe(true);
  });

  it('justPressed returns true only once', () => {
    input.handleKeyDown('z');
    expect(input.justPressed('z')).toBe(true);
    expect(input.justPressed('z')).toBe(false);
  });
});
