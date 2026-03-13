import { TileType, Direction, Position, Hole } from '@/types';
import { getTile, isInBounds } from '@/game/Physics';
import { HOLE_REGEN_TIME } from '@/constants';

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
  onRope = false
): boolean {
  if (onRope) return false;

  const target = getDigTarget(playerPos, direction);
  if (!target || !isInBounds(target)) return false;

  const tile = getTile(grid, target);
  if (tile !== TileType.Sand) return false;

  const above = { x: target.x, y: target.y - 1 };
  const aboveTile = getTile(grid, above);
  if (aboveTile === TileType.Rope || aboveTile === TileType.Badge) return false;

  return true;
}

export function createHole(grid: TileType[][], pos: Position): Hole {
  grid[pos.y][pos.x] = TileType.Empty;
  return {
    x: pos.x,
    y: pos.y,
    timer: HOLE_REGEN_TIME,
    phase: 'open',
  };
}

export function updateHoles(
  holes: Hole[],
  grid: TileType[][],
  dt: number
): Hole[] {
  const remaining: Hole[] = [];
  for (const hole of holes) {
    hole.timer -= dt;
    if (hole.timer <= 0) {
      grid[hole.y][hole.x] = TileType.Sand;
    } else {
      remaining.push(hole);
    }
  }
  return remaining;
}
