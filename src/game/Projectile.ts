import { POWER_PROJECTILE_SPEED, POWER_PROJECTILE_TTL } from '@/constants';
import { Direction, Position, ProjectileState, TileType, DuckState } from '@/types';
import { getTile, isInBounds } from '@/game/Physics';

const PROJECTILE_HALF_WIDTH = 0.16;
const PROJECTILE_TRACE_STEP = 0.06;
const DUCK_HITBOX_LEFT = 0.14;
const DUCK_HITBOX_RIGHT = 0.86;
const DUCK_HITBOX_TOP = 0.08;
const DUCK_HITBOX_BOTTOM = 0.92;

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

export function traceProjectileImpact(
  projectile: ProjectileState,
  ducks: DuckState[],
  grid: TileType[][]
): { hitDuck: DuckState | null; hitSolid: boolean } {
  const dx = projectile.pos.x - projectile.prevPos.x;
  const dy = projectile.pos.y - projectile.prevPos.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  const steps = Math.max(1, Math.ceil(distance / PROJECTILE_TRACE_STEP));
  const dir = projectile.direction === Direction.Right ? 1 : -1;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sampleX = projectile.prevPos.x + dx * t;
    const sampleY = projectile.prevPos.y + dy * t;

    for (const duck of ducks) {
      if (duck.isTrapped) continue;
      if (projectileSampleHitsDuck(sampleX, sampleY, duck.pos)) {
        return { hitDuck: duck, hitSolid: false };
      }
    }

    if (projectileSampleHitsSolid(sampleX, sampleY, dir, grid)) {
      return { hitDuck: null, hitSolid: true };
    }
  }

  return { hitDuck: null, hitSolid: false };
}

function projectileSampleHitsSolid(
  sampleX: number,
  sampleY: number,
  dir: number,
  grid: TileType[][]
): boolean {
  const leadingEdgeX = sampleX + dir * PROJECTILE_HALF_WIDTH;
  const sample = { x: Math.floor(leadingEdgeX), y: Math.floor(sampleY) };
  if (!isInBounds(sample)) return true;

  const tile = getTile(grid, sample);
  return tile === TileType.Sand || tile === TileType.Coral || tile === TileType.TrapSand;
}

function projectileSampleHitsDuck(sampleX: number, sampleY: number, duckPos: Position): boolean {
  const projectileLeft = sampleX - PROJECTILE_HALF_WIDTH;
  const projectileRight = sampleX + PROJECTILE_HALF_WIDTH;
  const duckLeft = duckPos.x + DUCK_HITBOX_LEFT;
  const duckRight = duckPos.x + DUCK_HITBOX_RIGHT;
  const duckTop = duckPos.y + DUCK_HITBOX_TOP;
  const duckBottom = duckPos.y + DUCK_HITBOX_BOTTOM;

  return (
    sampleY >= duckTop &&
    sampleY <= duckBottom &&
    projectileRight >= duckLeft &&
    projectileLeft <= duckRight
  );
}
