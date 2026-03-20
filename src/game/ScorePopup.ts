import { TILE_SIZE } from '@/constants';

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  elapsed: number;
  duration: number;
}

export function createScorePopup(tileX: number, tileY: number, text: string, color: string): ScorePopup {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE,
    text,
    color,
    elapsed: 0,
    duration: 1000,
  };
}

export function updateScorePopups(popups: ScorePopup[], dt: number): void {
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].elapsed += dt;
    if (popups[i].elapsed >= popups[i].duration) {
      popups.splice(i, 1);
    }
  }
}
