import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '@/game/GameManager';
import { InputManager } from '@/engine/Input';

describe('GameManager', () => {
  let input: InputManager;
  let game: GameManager;

  beforeEach(() => {
    input = new InputManager();
    game = new GameManager(input);
    game.startGame();
  });

  it('treats digging as the committed action instead of moving in the same tick', () => {
    const startPos = { ...game.state.player.pos };

    input.handleKeyDown('ArrowRight');
    input.handleKeyDown('x');
    game.update(16);

    expect(game.state.player.pos).toEqual(startPos);
    expect(game.state.player.isDigging).toBe(true);
    expect(game.state.holes.some((hole) => (
      hole.x === startPos.x + 1 && hole.y === startPos.y + 1
    ))).toBe(true);
  });

  it('does not buffer movement during the dig action', () => {
    const startPos = { ...game.state.player.pos };

    input.handleKeyDown('ArrowRight');
    input.handleKeyDown('x');
    game.update(16);

    input.handleKeyUp('x');
    game.update(520);

    expect(game.state.player.pos).toEqual(startPos);
    expect(game.state.player.isDigging).toBe(false);

    game.update(200);
    expect(game.state.player.pos.x).toBe(startPos.x + 1);
  });
});
