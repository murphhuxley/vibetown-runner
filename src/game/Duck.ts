import { DuckState, Position, Direction, TileType, PlayerState } from '@/types';
import { canMoveTo, getTile, isSupported, isInBounds } from '@/game/Physics';
import { canClimb, canTraverseRope, movePlayer } from '@/game/Player';
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
    // Climb out of the hole — move up one tile
    duck.pos = { x: duck.pos.x, y: duck.pos.y - 1 };
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

  // Gravity — if not supported, fall
  const supported = isSupported(grid, duck.pos, duck.isOnLadder, duck.isOnRope);
  if (!supported) {
    const below = { x: duck.pos.x, y: duck.pos.y + 1 };
    if (isInBounds(below) && canMoveTo(grid, below)) {
      next.pos = below;
      next.isFalling = true;
      next.isOnLadder = false;
      next.isOnRope = false;
      // Face toward player while falling
      const dx = playerPos.x - duck.pos.x;
      if (dx !== 0) next.facing = dx > 0 ? Direction.Right : Direction.Left;
      return next;
    }
  }
  next.isFalling = false;

  const moved = chooseClassicDuckMove(duck, grid, playerPos, otherDucks);
  if (moved) {
    next.pos = moved.pos;
    next.isOnLadder = moved.isOnLadder;
    next.isOnRope = moved.isOnRope;
    next.facing = resolveDuckFacing(duck, moved, playerPos);
    return next;
  }

  return next;
}

function chooseClassicDuckMove(
  duck: DuckState,
  grid: TileType[][],
  playerPos: Position,
  otherDucks: DuckState[]
): PlayerState | null {
  const targetKey = posKey(playerPos);
  const occupied = new Set(
    otherDucks
      .filter((other) => other.id !== duck.id && !other.isTrapped)
      .map((other) => posKey(other.pos))
  );
  const priorities = getClassicPriorities(duck, grid, playerPos);
  const moveState = createMoverState(grid, duck.pos, duck.facing);

  for (const direction of priorities) {
    const moved = movePlayer(moveState, grid, direction);
    if (moved.pos.x === duck.pos.x && moved.pos.y === duck.pos.y) continue;

    const movedKey = posKey(moved.pos);
    if (occupied.has(movedKey) && movedKey !== targetKey) continue;

    return moved;
  }

  return null;
}

function getClassicPriorities(
  duck: DuckState,
  grid: TileType[][],
  playerPos: Position
): Direction[] {
  const directions: Direction[] = [];
  const pos = duck.pos;
  const sameRow = playerPos.y === pos.y;
  const sameColumn = playerPos.x === pos.x;
  const horizontalToward = playerPos.x <= pos.x ? Direction.Left : Direction.Right;
  const horizontalAway = horizontalToward === Direction.Left ? Direction.Right : Direction.Left;
  const verticalToward = playerPos.y < pos.y ? Direction.Up : Direction.Down;
  const verticalAway = verticalToward === Direction.Up ? Direction.Down : Direction.Up;
  const onLadder = canClimb(grid, pos);
  const onRope = canTraverseRope(grid, pos);
  const ladderAbove = canClimb(grid, { x: pos.x, y: pos.y - 1 });
  const ladderBelow = canClimb(grid, { x: pos.x, y: pos.y + 1 });
  const ladderSeek = playerPos.y < pos.y ? findLadderSeekDirection(grid, pos, playerPos.x) : null;

  if (playerPos.y < pos.y && (onLadder || ladderAbove)) {
    directions.push(Direction.Up, horizontalToward, horizontalAway, Direction.Down);
  } else if (sameColumn && onLadder) {
    directions.push(verticalToward, horizontalToward, horizontalAway, verticalAway);
  } else if (onRope && playerPos.y > pos.y) {
    directions.push(Direction.Down, horizontalToward, horizontalAway, Direction.Up);
  } else if (!sameRow && playerPos.y < pos.y && ladderSeek) {
    directions.push(ladderSeek, horizontalToward, Direction.Up, horizontalAway, Direction.Down);
  } else if (!sameRow && playerPos.y > pos.y && ladderBelow) {
    directions.push(Direction.Down, horizontalToward, horizontalAway, Direction.Up);
  } else if (!sameRow && playerPos.y < pos.y && onLadder) {
    directions.push(Direction.Up, horizontalToward, horizontalAway, Direction.Down);
  } else if (sameRow) {
    directions.push(horizontalToward, verticalToward, verticalAway, horizontalAway);
  } else {
    directions.push(horizontalToward, verticalToward, horizontalAway, verticalAway);
  }

  return Array.from(
    new Set(directions.filter((direction) => direction !== Direction.None))
  );
}

function findLadderSeekDirection(
  grid: TileType[][],
  pos: Position,
  playerX: number
): Direction | null {
  const preferred = playerX < pos.x ? [Direction.Left, Direction.Right] : [Direction.Right, Direction.Left];

  for (const direction of preferred) {
    const step = direction === Direction.Left ? -1 : 1;
    for (let dist = 1; dist < grid[0].length; dist++) {
      const x = pos.x + step * dist;
      if (!isInBounds({ x, y: pos.y })) break;

      const tileHere = getTile(grid, { x, y: pos.y });
      if (tileHere === TileType.Sand || tileHere === TileType.Coral || tileHere === TileType.TrapSand) break;

      if (canClimb(grid, { x, y: pos.y }) || canClimb(grid, { x, y: pos.y + 1 })) {
        return direction;
      }
    }
  }

  return null;
}

function createMoverState(grid: TileType[][], pos: Position, facing: Direction): PlayerState {
  return {
    pos: { ...pos },
    facing,
    isDigging: false,
    isOnRope: canTraverseRope(grid, pos),
    isOnLadder: canClimb(grid, pos),
    isFalling: false,
    isLFV: false,
    alive: true,
  };
}

function resolveDuckFacing(
  previous: DuckState,
  moved: PlayerState,
  playerPos: Position
): Direction {
  const movedVertically = moved.pos.y !== previous.pos.y;
  const onLadder = moved.isOnLadder;

  if ((movedVertically || onLadder) && playerPos.x !== moved.pos.x) {
    return playerPos.x < moved.pos.x ? Direction.Left : Direction.Right;
  }

  return moved.facing;
}

function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export function respawnDuck(duck: DuckState, grid: TileType[][], playerPos: Position): void {
  const y = 0;
  const validXs: number[] = [];
  for (let x = 0; x < grid[0].length; x++) {
    if (!canMoveTo(grid, { x, y })) continue;
    if (playerPos.y === y && playerPos.x === x) continue;
    validXs.push(x);
  }
  if (validXs.length > 0) {
    let bestDistance = -1;
    let bestXs: number[] = [];

    for (const x of validXs) {
      const distance = Math.abs(x - playerPos.x);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestXs = [x];
      } else if (distance === bestDistance) {
        bestXs.push(x);
      }
    }

    const x = bestXs[Math.floor(Math.random() * bestXs.length)];
    duck.pos = { x, y };
  }
  duck.isTrapped = false;
  duck.isFalling = false;
  duck.isOnLadder = false;
  duck.isOnRope = false;
  duck.carryingBadge = false;
  duck.trapTimer = 0;
}
