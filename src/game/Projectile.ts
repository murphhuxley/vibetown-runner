import { POWER_PROJECTILE_SPEED, POWER_PROJECTILE_TTL } from '@/constants';
import { Direction, Position, ProjectileState, TileType } from '@/types';
import { getTile, isInBounds } from '@/game/Physics';

export function createProjectile(
  playerPos: Position,
  facing: Direction.Left | Direction.Right
): ProjectileState {
  const startX = playerPos.x + 0.5 + (facing === Direction.Right ? 0.35 : -0.35);
  const startY = playerPos.y + 0.48;

  return {
    pos: { x: startX, y: startY },
    prevPos: { x: startX, y: startY },
    direction: facing,
    ttl: POWER_PROJECTILE_TTL,
  };
}

export function updateProjectile(projectile: ProjectileState, dt: number): void {
  projectile.prevPos = { ...projectile.pos };
  const delta = (POWER_PROJECTILE_SPEED * dt) / 1000;
  projectile.pos.x += projectile.direction === Direction.Right ? delta : -delta;
  projectile.ttl -= dt;
}

export function isProjectileExpired(projectile: ProjectileState): boolean {
  return projectile.ttl <= 0;
}

export function projectileHitsSolid(projectile: ProjectileState, grid: TileType[][]): boolean {
  const sampleX = projectile.pos.x + (projectile.direction === Direction.Right ? 0.18 : -0.18);
  const sample = { x: Math.floor(sampleX), y: Math.floor(projectile.pos.y) };
  if (!isInBounds(sample)) return true;

  const tile = getTile(grid, sample);
  return tile === TileType.Sand || tile === TileType.Coral || tile === TileType.TrapSand;
}

export function projectileCrossesDuck(projectile: ProjectileState, duckPos: Position): boolean {
  if (Math.floor(projectile.pos.y) !== duckPos.y) return false;

  const minX = Math.min(projectile.prevPos.x, projectile.pos.x);
  const maxX = Math.max(projectile.prevPos.x, projectile.pos.x);
  const duckCenterX = duckPos.x + 0.5;

  return duckCenterX >= minX && duckCenterX <= maxX;
}
