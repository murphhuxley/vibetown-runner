import { COLORS, TILE_SIZE } from '@/constants';
import { Position } from '@/types';

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

const CONFETTI_COLORS = [
  COLORS.coral,
  COLORS.vibestrGold,
  COLORS.skyBlue,
  COLORS.palmGreen,
  COLORS.dustyRose,
  COLORS.cream,
];

export function createConfettiBurst(pos: Position): ConfettiPiece[] {
  const centerX = pos.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = pos.y * TILE_SIZE + TILE_SIZE / 2;

  return Array.from({ length: 18 }, (_, index) => {
    const spread = (index / 17) * Math.PI * 1.35 - Math.PI * 0.85;
    const angle = spread + (Math.random() - 0.5) * 0.35;
    const speed = 70 + Math.random() * 120;
    const life = 650 + Math.random() * 250;

    return {
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      life,
      maxLife: life,
      size: 4 + Math.floor(Math.random() * 4),
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    };
  });
}

export function updateConfetti(pieces: ConfettiPiece[], dt: number): ConfettiPiece[] {
  const gravity = 280;
  const dtSeconds = dt / 1000;

  return pieces
    .map((piece) => ({
      ...piece,
      x: piece.x + piece.vx * dtSeconds,
      y: piece.y + piece.vy * dtSeconds,
      vx: piece.vx * 0.985,
      vy: piece.vy + gravity * dtSeconds,
      life: piece.life - dt,
      rotation: piece.rotation + piece.spin * dtSeconds,
    }))
    .filter((piece) => piece.life > 0);
}
