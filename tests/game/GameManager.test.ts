import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '@/game/GameManager';
import { InputManager } from '@/engine/Input';
import { Direction, TileType } from '@/types';
import { createProjectile } from '@/game/Projectile';
import { DUCK_HOLE_KILL_LEAD_MS } from '@/constants';

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

  it('does not spawn a money drop when a duck without a bag falls into a hole', () => {
    const hole = { x: 5, y: 5 };
    const grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));

    grid[hole.y][hole.x - 1] = TileType.Sand;
    grid[hole.y][hole.x + 1] = TileType.Sand;
    grid[hole.y + 1][hole.x] = TileType.Sand;

    game.state.grid = grid;
    game.state.player.pos = { x: 0, y: 0 };
    game.state.holes = [{
      x: hole.x,
      y: hole.y,
      timer: 1000,
      phase: 'open',
      fillTile: TileType.Sand,
      direction: Direction.Left,
    }];

    const duck = game.state.ducks[0];
    duck.pos = { ...hole };
    duck.carryingBadge = false;
    duck.isTrapped = false;
    duck.isFalling = false;
    duck.isOnLadder = false;
    duck.isOnRope = false;

    game.drops = [];

    (game as any).updateDucks();

    expect(game.state.ducks[0].isTrapped).toBe(true);
    expect(game.drops).toHaveLength(0);
  });

  it('auto-equips the level 3 helmet pickup and uses space to fire', () => {
    game.loadLevel(2);
    game.startGame();

    expect(game.state.powerHelmetPos).toEqual({ x: 13, y: 7 });

    game.state.player.pos = { x: 13, y: 7 };
    (game as any).checkPowerHelmetCollection();

    expect(game.state.powerHelmetCollected).toBe(true);
    expect(game.state.powerHelmetActive).toBe(true);
    expect(game.state.powerHelmetPos).toBeNull();
    expect(game.state.powerHelmetShots).toBe(3);

    input.handleKeyDown(' ');
    game.update(16);

    expect(game.state.powerHelmetActive).toBe(true);
    expect(game.state.powerHelmetShots).toBe(2);
    expect(game.projectiles).toHaveLength(1);
  });

  it('fires a helmet projectile that can kill a duck', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));
    game.state.player.pos = { x: 2, y: 5 };
    game.state.player.facing = Direction.Right;

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 5 };
    duck.isTrapped = false;
    duck.carryingBadge = false;

    game.projectiles = [createProjectile(game.state.player.pos, Direction.Right)];

    (game as any).updateProjectiles(220);

    expect(game.projectiles).toHaveLength(0);
    expect(game.duckDeaths).toHaveLength(1);
    expect(game.confetti.length).toBeGreaterThan(0);
    expect(game.getDuckRenderPos(duck.id)).toEqual(duck.pos);
  });

  it('registers a duck hit when the projectile clips the duck body before reaching center', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));
    game.state.player.pos = { x: 2, y: 5 };
    game.state.player.facing = Direction.Right;

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 5 };
    duck.isTrapped = false;
    duck.carryingBadge = false;

    game.projectiles = [createProjectile(game.state.player.pos, Direction.Right)];

    // This only reaches the duck's leading edge; the old center-point check missed it.
    (game as any).updateProjectiles(120);

    expect(game.projectiles).toHaveLength(0);
    expect(game.duckDeaths).toHaveLength(1);
  });

  it('kills a duck before a later platform tile can swallow the projectile on upper rows', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));
    game.state.player.pos = { x: 2, y: 1 };
    game.state.player.facing = Direction.Right;

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 1 };
    duck.isTrapped = false;
    duck.carryingBadge = false;

    // Simulate a short upper platform segment that the projectile reaches in the same frame.
    game.state.grid[1][6] = TileType.Sand;
    game.projectiles = [createProjectile(game.state.player.pos, Direction.Right)];

    (game as any).updateProjectiles(220);

    expect(game.projectiles).toHaveLength(0);
    expect(game.duckDeaths).toHaveLength(1);
  });

  it('drops a carried bag onto a collectible floor tile when a projectile kills a duck', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));
    game.state.grid[6][5] = TileType.Sand;
    game.state.player.pos = { x: 2, y: 5 };
    game.state.player.facing = Direction.Right;

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 5 };
    duck.isTrapped = false;
    duck.carryingBadge = true;

    game.projectiles = [createProjectile(game.state.player.pos, Direction.Right)];

    (game as any).updateProjectiles(220);

    expect(game.state.grid[5][5]).toBe(TileType.Badge);
    expect(game.state.grid[4][5]).toBe(TileType.Empty);
  });

  it('does not let projectiles kill trapped ducks in holes', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));
    game.state.player.pos = { x: 2, y: 5 };
    game.state.player.facing = Direction.Right;

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 5 };
    duck.isTrapped = true;
    duck.carryingBadge = false;

    game.projectiles = [createProjectile(game.state.player.pos, Direction.Right)];

    (game as any).updateProjectiles(220);

    expect(game.duckDeaths).toHaveLength(0);
    expect(game.confetti).toHaveLength(0);
    expect(duck.isTrapped).toBe(true);
  });

  it('starts duck death slightly before the hole fully closes', () => {
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));

    const duck = game.state.ducks[0];
    duck.pos = { x: 5, y: 5 };
    duck.isTrapped = true;
    duck.carryingBadge = false;

    game.state.holes = [{
      x: 5,
      y: 5,
      timer: DUCK_HOLE_KILL_LEAD_MS - 1,
      phase: 'closing',
      fillTile: TileType.Sand,
      direction: Direction.Left,
    }];

    (game as any).checkHoleKills();

    expect(game.duckDeaths).toHaveLength(1);
    expect(game.confetti.length).toBeGreaterThan(0);
    expect(duck.isTrapped).toBe(false);
  });

  it('blocks LFV while the helmet power-up is active', () => {
    game.state.powerHelmetCollected = true;
    game.state.powerHelmetActive = true;
    game.state.powerHelmetShots = 3;
    game.vibeMeter.meter = 100;
    game.state.player.pos = { x: 2, y: 5 };
    game.state.player.facing = Direction.Right;
    game.state.grid = Array.from({ length: game.state.grid.length }, () => (
      Array.from({ length: game.state.grid[0].length }, () => TileType.Empty)
    ));

    input.handleKeyDown(' ');
    game.update(16);

    expect(game.projectiles).toHaveLength(1);
    expect(game.state.powerHelmetShots).toBe(2);
    expect(game.vibeMeter.lfvTimer).toBe(0);
    expect(game.vibeMeter.meter).toBe(0);
  });

  it('prevents digging while the helmet power-up is active', () => {
    const startPos = { ...game.state.player.pos };
    game.state.powerHelmetCollected = true;
    game.state.powerHelmetActive = true;
    game.state.powerHelmetShots = 3;

    input.handleKeyDown('x');
    game.update(16);

    expect(game.state.player.isDigging).toBe(false);
    expect(game.state.holes).toHaveLength(0);
    expect(game.state.player.pos).toEqual(startPos);
  });

  it('cancels active LFV when the helmet is collected', () => {
    game.loadLevel(2);
    game.startGame();
    game.vibeMeter.lfvTimer = 1000;
    game.state.player.isLFV = true;

    game.state.player.pos = { x: 13, y: 7 };
    (game as any).checkPowerHelmetCollection();

    expect(game.state.powerHelmetActive).toBe(true);
    expect(game.vibeMeter.lfvTimer).toBe(0);
    expect(game.vibeMeter.meter).toBe(0);
    expect(game.state.player.isLFV).toBe(false);
  });

  it('drains any new LFV gain while the helmet power-up remains active', () => {
    game.state.powerHelmetCollected = true;
    game.state.powerHelmetActive = true;
    game.state.powerHelmetShots = 3;
    game.vibeMeter.meter = 80;

    game.update(16);

    expect(game.vibeMeter.meter).toBe(0);
    expect(game.vibeMeter.lfvTimer).toBe(0);
    expect(game.state.player.isLFV).toBe(false);
  });

  it('spawns the helmet randomly on levels after 3', () => {
    game.loadLevel(3);
    game.startGame();

    expect(game.state.currentLevel).toBe(4);
    expect(game.state.powerHelmetPos).not.toBeNull();
  });

  it('spawns the helmet on a platform tile instead of a ladder or rope', () => {
    game.loadLevel(3);
    game.startGame();

    const spawn = game.state.powerHelmetPos;
    expect(spawn).not.toBeNull();
    if (!spawn) return;

    expect(game.state.grid[spawn.y][spawn.x]).toBe(TileType.Empty);
    const below = game.state.grid[spawn.y + 1][spawn.x];
    expect([TileType.Sand, TileType.Coral, TileType.TrapSand]).toContain(below);
  });
});
