import { DuckState, Position, Direction, TileType } from '@/types';
import { canMoveTo, getTile, isSupported, isInBounds } from '@/game/Physics';
import { canClimb } from '@/game/Player';
import { DUCK_TRAP_ESCAPE_TIME } from '@/constants';

export function createDuck(id: number, pos: Position): DuckState {
  return {
    id,
    pos: { ...pos },
    facing: Direction.Left,
    isTrapped: false,
    isFalling: false,
    isOnRope: false,
    isOnLadder: false,
    carryingBadge: false,
    trapTimer: 0,
  };
}

export function trapDuck(duck: DuckState): void {
  duck.isTrapped = true;
  duck.trapTimer = DUCK_TRAP_ESCAPE_TIME;
  if (duck.carryingBadge) {
    duck.carryingBadge = false;
  }
}

export function updateTrappedDuck(duck: DuckState, dt: number): boolean {
  if (!duck.isTrapped) return false;
  duck.trapTimer -= dt;
  if (duck.trapTimer <= 0) {
    duck.isTrapped = false;
    duck.trapTimer = 0;
    return true;
  }
  return false;
}

export function moveDuckToward(
  duck: DuckState,
  grid: TileType[][],
  playerPos: Position,
  otherDucks: DuckState[]
): DuckState {
  if (duck.isTrapped) return duck;

  const next = { ...duck, pos: { ...duck.pos } };

  // Check if falling
  const supported = isSupported(grid, duck.pos, duck.isOnLadder, duck.isOnRope);
  if (!supported) {
    const below = { x: duck.pos.x, y: duck.pos.y + 1 };
    if (isInBounds(below) && canMoveTo(grid, below)) {
      next.pos = below;
      next.isFalling = true;
      next.isOnLadder = false;
      next.isOnRope = false;
      return next;
    }
  }
  next.isFalling = false;

  const dx = playerPos.x - duck.pos.x;
  const dy = playerPos.y - duck.pos.y;

  // Prefer getting above the player (original AI behavior)
  if (dy > 0 && canClimb(grid, duck.pos)) {
    const up = { x: duck.pos.x, y: duck.pos.y - 1 };
    if (isInBounds(up) && canMoveTo(grid, up)) {
      next.pos = up;
      next.isOnLadder = canClimb(grid, up);
      return next;
    }
  }

  // If player is above, look for ladder to climb
  if (dy < 0) {
    if (canClimb(grid, duck.pos)) {
      const up = { x: duck.pos.x, y: duck.pos.y - 1 };
      if (isInBounds(up) && canMoveTo(grid, up)) {
        next.pos = up;
        next.isOnLadder = true;
        return next;
      }
    }
    if (canClimb(grid, { x: duck.pos.x, y: duck.pos.y + 1 })) {
      const down = { x: duck.pos.x, y: duck.pos.y + 1 };
      if (isInBounds(down)) {
        next.pos = down;
        next.isOnLadder = true;
        return next;
      }
    }
  }

  // Move horizontally toward player
  if (dx !== 0) {
    const moveDir = dx > 0 ? 1 : -1;
    const target = { x: duck.pos.x + moveDir, y: duck.pos.y };

    if (canMoveTo(grid, target) && isSupported(grid, target, false, false)) {
      const occupied = otherDucks.some(
        d => d.id !== duck.id && d.pos.x === target.x && d.pos.y === target.y
      );
      if (!occupied) {
        next.pos = target;
        next.facing = moveDir > 0 ? Direction.Right : Direction.Left;
        next.isOnLadder = canClimb(grid, target);
        next.isOnRope = getTile(grid, target) === TileType.Rope;
        return next;
      }
    }
  }

  return next;
}

export function respawnDuck(duck: DuckState, grid: TileType[][]): void {
  const y = 0;
  const validXs: number[] = [];
  for (let x = 0; x < grid[0].length; x++) {
    if (canMoveTo(grid, { x, y })) validXs.push(x);
  }
  if (validXs.length > 0) {
    const x = validXs[Math.floor(Math.random() * validXs.length)];
    duck.pos = { x, y };
  }
  duck.isTrapped = false;
  duck.isFalling = false;
  duck.isOnLadder = false;
  duck.isOnRope = false;
  duck.carryingBadge = false;
  duck.trapTimer = 0;
}
