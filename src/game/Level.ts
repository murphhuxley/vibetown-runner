import { TileType, WeatherType, LevelData, Position } from '@/types';
import { GRID_COLS, GRID_ROWS } from '@/constants';

export function parseLevel(raw: any): LevelData {
  const { id, name, grid, weather, npcs, theme, exitColumn } = raw;

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
    exitColumn: typeof exitColumn === 'number' ? exitColumn : undefined,
    theme: theme ?? 'beach',
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

function findTopPlatformRow(grid: TileType[][]): number {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x] === TileType.Sand) {
        return y;
      }
    }
  }

  return GRID_ROWS - 1;
}

function getValidExitColumns(grid: TileType[][], topPlatformRow: number): number[] {
  const validCols: number[] = [];

  for (let x = 0; x < GRID_COLS; x++) {
    if (grid[topPlatformRow][x] !== TileType.Sand) continue;

    let clear = true;
    for (let y = 0; y < topPlatformRow; y++) {
      if (grid[y][x] !== TileType.Empty) {
        clear = false;
        break;
      }
    }

    if (clear) validCols.push(x);
  }

  return validCols;
}

export function ensureHiddenExit(grid: TileType[][], exitColumn?: number): number | null {
  const hasAuthoredHiddenLadder = grid.some((row) => row.includes(TileType.HiddenLadder));
  if (hasAuthoredHiddenLadder) return null;

  const topPlatformRow = findTopPlatformRow(grid);
  const validCols = getValidExitColumns(grid, topPlatformRow);
  if (validCols.length === 0) return null;

  const resolvedColumn = (
    typeof exitColumn === 'number' && validCols.includes(exitColumn)
      ? exitColumn
      : validCols[0]
  );

  for (let y = 0; y < topPlatformRow; y++) {
    grid[y][resolvedColumn] = TileType.HiddenLadder;
  }

  return resolvedColumn;
}
