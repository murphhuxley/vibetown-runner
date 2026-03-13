import { TileType, Position } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

export function isSolid(tile: TileType): boolean {
  return tile === TileType.Sand || tile === TileType.Coral;
}

export function isInBounds(pos: Position): boolean {
  return pos.x >= 0 && pos.x < GRID_COLS && pos.y >= 0 && pos.y < GRID_ROWS;
}

export function getTile(grid: TileType[][], pos: Position): TileType {
  if (!isInBounds(pos)) return TileType.Empty;
  return grid[pos.y][pos.x];
}

export function isSupported(
  grid: TileType[][],
  pos: Position,
  onLadder = false,
  onRope = false
): boolean {
  if (pos.y >= GRID_ROWS - 1) return true;
  if (onLadder && getTile(grid, pos) === TileType.Ladder) return true;
  if (onRope && getTile(grid, pos) === TileType.Rope) return true;
  const below = { x: pos.x, y: pos.y + 1 };
  if (isInBounds(below) && isSolid(getTile(grid, below))) return true;
  if (isInBounds(below) && getTile(grid, below) === TileType.Ladder) return true;
  return false;
}

export function canMoveTo(grid: TileType[][], pos: Position): boolean {
  if (!isInBounds(pos)) return false;
  const tile = getTile(grid, pos);
  return !isSolid(tile);
}
