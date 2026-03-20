import { TILE_SIZE } from '@/constants';

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export function createLandingDust(tileX: number, tileY: number): DustParticle[] {
  const particles: DustParticle[] = [];
  const baseX = tileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = tileY * TILE_SIZE + TILE_SIZE - 2;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * 1.2;
    const speed = 25 + Math.random() * 35;
    const life = 250 + Math.random() * 150;
    particles.push({
      x: baseX + (Math.random() - 0.5) * 8,
      y: baseY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 15,
      life,
      maxLife: life,
      size: 1.5 + Math.random() * 1.5,
    });
  }
  return particles;
}

export function updateDustParticles(particles: DustParticle[], dt: number): void {
  const dtSec = dt / 1000;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.vy += 120 * dtSec; // gentle gravity
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}
