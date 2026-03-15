import { PlayerState, Position, Direction, TileType } from '@/types';
import { canMoveTo, getTile, isSupported, isInBounds } from '@/game/Physics';

export function createPlayer(pos: Position): PlayerState {
  return {
    pos: { ...pos },
    facing: Direction.Right,
    isDigging: false,
    isOnRope: false,
    isOnLadder: false,
    isFalling: false,
    isLFV: false,
    alive: true,
  };
}

export function canClimb(grid: TileType[][], pos: Position): boolean {
  const tile = getTile(grid, pos);
  return tile === TileType.Ladder;
}

export function canTraverseRope(grid: TileType[][], pos: Position): boolean {
  return getTile(grid, pos) === TileType.Rope;
}

export function movePlayer(
  player: PlayerState,
  grid: TileType[][],
  direction: Direction
): PlayerState {
  const next = { ...player, pos: { ...player.pos } };
  const target: Position = { ...player.pos };

  switch (direction) {
    case Direction.Left:
      target.x -= 1;
      next.facing = Direction.Left;
      break;
    case Direction.Right:
      target.x += 1;
      next.facing = Direction.Right;
      break;
    case Direction.Up:
      target.y -= 1;
      break;
    case Direction.Down:
      target.y += 1;
      break;
    case Direction.None:
      return next;
  }

  // Vertical movement requires ladder
  if (direction === Direction.Up) {
    if (!canClimb(grid, player.pos) && !canClimb(grid, target)) return next;
    if (!isInBounds(target)) return next;
    if (!canMoveTo(grid, target)) return next;
    next.pos = target;
    next.isOnLadder = canClimb(grid, target);
    next.isOnRope = false;
    return next;
  }

  if (direction === Direction.Down) {
    if (!isInBounds(target)) return next;
    if (canClimb(grid, target)) {
      next.pos = target;
      next.isOnLadder = true;
      next.isOnRope = false;
      return next;
    }
    // Drop off rope — let go and fall
    if (player.isOnRope && canMoveTo(grid, target)) {
      next.pos = target;
      next.isOnRope = false;
      next.isFalling = true;
      return next;
    }
    if (canMoveTo(grid, target) && !isSupported(grid, player.pos, player.isOnLadder, player.isOnRope)) {
      next.pos = target;
      return next;
    }
    return next;
  }

  // Horizontal movement
  if (!canMoveTo(grid, target)) return next;
  const supported = isSupported(grid, player.pos, player.isOnLadder, player.isOnRope);
  if (!supported && !player.isFalling) return next;

  next.pos = target;
  next.isOnLadder = canClimb(grid, target);
  next.isOnRope = canTraverseRope(grid, target);
  return next;
}
