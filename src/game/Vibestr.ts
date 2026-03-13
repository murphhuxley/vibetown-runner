import { Position } from '@/types';

export interface VibestrDrop {
  pos: Position;
  collected: boolean;
}

export function createDrop(pos: Position): VibestrDrop {
  return { pos: { ...pos }, collected: false };
}

export function collectDrop(drops: VibestrDrop[], playerPos: Position): boolean {
  for (const drop of drops) {
    if (!drop.collected && drop.pos.x === playerPos.x && drop.pos.y === playerPos.y) {
      drop.collected = true;
      return true;
    }
  }
  return false;
}

export function updateDrops(drops: VibestrDrop[]): VibestrDrop[] {
  return drops.filter(d => !d.collected);
}
