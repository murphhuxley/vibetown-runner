export function getTargetDuckCountForLevel(levelId: number): number {
  if (levelId <= 5) return 1;
  if (levelId <= 10) return 2;
  if (levelId <= 15) return 3;
  if (levelId <= 17) return 4;
  return 5;
}

export const MAX_DUCK_COUNT = 5;
