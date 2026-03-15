import { TileType, Direction, Position, Hole } from '@/types';
import { getTile, isInBounds } from '@/game/Physics';
import { HOLE_REGEN_TIME, HOLE_OPEN_ANIM, HOLE_CLOSE_ANIM } from '@/constants';

export interface HoleUpdateResult {
  holes: Hole[];
  closed: Position[];
}

export function getDigTarget(playerPos: Position, direction: Direction): Position | null {
  if (direction === Direction.Left) {
    return { x: playerPos.x - 1, y: playerPos.y + 1 };
  }
  if (direction === Direction.Right) {
    return { x: playerPos.x + 1, y: playerPos.y + 1 };
  }
  return null;
}

export function canDig(
  grid: TileType[][],
  playerPos: Position,
  direction: Direction,
  _onRope = false
): boolean {
  const target = getDigTarget(playerPos, direction);
  if (!target || !isInBounds(target)) return false;

  const tile = getTile(grid, target);
  if (tile !== TileType.Sand && tile !== TileType.TrapSand) return false;

  return true;
}

export function createHole(grid: TileType[][], pos: Position, direction: Direction.Left | Direction.Right): Hole {
  const fillTile = getTile(grid, pos);
  if (fillTile !== TileType.Sand && fillTile !== TileType.TrapSand) {
    throw new Error(`Cannot create hole from non-diggable tile at (${pos.x}, ${pos.y})`);
  }

  return {
    x: pos.x,
    y: pos.y,
    timer: HOLE_OPEN_ANIM,
    phase: 'opening',
    fillTile,
    direction,
  };
}

export function updateHoles(
  holes: Hole[],
  grid: TileType[][],
  dt: number
): HoleUpdateResult {
  const remaining: Hole[] = [];
  const closed: Position[] = [];

  for (const hole of holes) {
    hole.timer -= dt;

    if (hole.phase === 'opening') {
      if (hole.timer <= 0) {
        hole.phase = 'open';
        hole.timer = HOLE_REGEN_TIME;
        grid[hole.y][hole.x] = TileType.Empty;
      }
      remaining.push(hole);
      continue;
    }

    if (hole.phase === 'open') {
      if (hole.timer <= 0) {
        hole.phase = 'closing';
        hole.timer = HOLE_CLOSE_ANIM;
      }
      remaining.push(hole);
      continue;
    }

    if (hole.timer <= 0) {
      grid[hole.y][hole.x] = hole.fillTile;
      closed.push({ x: hole.x, y: hole.y });
      continue;
    }

    remaining.push(hole);
  }

  return { holes: remaining, closed };
}
