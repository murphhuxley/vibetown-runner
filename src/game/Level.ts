import { TileType, WeatherType, LevelData, Position } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

export function parseLevel(raw: any): LevelData {
  const { id, name, grid, weather, npcs } = raw;

  if (!grid || grid.length !== GRID_ROWS) {
    throw new Error(`Level grid must have ${GRID_ROWS} rows, got ${grid?.length}`);
  }
  for (let y = 0; y < GRID_ROWS; y++) {
    if (grid[y].length !== GRID_COLS) {
      throw new Error(`Row ${y} must have ${GRID_COLS} cols, got ${grid[y].length}`);
    }
  }

  const weatherMap: Record<string, WeatherType> = {
    none: WeatherType.None,
    sunshine: WeatherType.Sunshine,
    rain: WeatherType.Rain,
    'trade-winds': WeatherType.TradeWinds,
    'high-tide': WeatherType.HighTide,
  };

  return {
    id,
    name,
    grid: grid.map((row: number[]) => row.map((t: number) => t as TileType)),
    weather: weatherMap[weather] ?? WeatherType.None,
    npcs: npcs ?? [],
  };
}

export function countBadges(grid: TileType[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile === TileType.Badge) count++;
    }
  }
  return count;
}

export function findSpawnPosition(grid: TileType[][], type: TileType): Position | null {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === type) return { x, y };
    }
  }
  return null;
}

export function findAllSpawnPositions(grid: TileType[][], type: TileType): Position[] {
  const positions: Position[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === type) positions.push({ x, y });
    }
  }
  return positions;
}

export function cloneGrid(grid: TileType[][]): TileType[][] {
  return grid.map(row => [...row]);
}
