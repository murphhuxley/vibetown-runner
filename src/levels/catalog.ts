import levelData01 from '@/levels/level-01.json';
import levelData02 from '@/levels/level-02.json';
import levelData03 from '@/levels/level-03.json';
import levelData04 from '@/levels/level-04.json';
import levelData05 from '@/levels/level-05.json';
import { GRID_COLS, GRID_ROWS } from '@/constants';
import { TileType, WeatherType } from '@/types';

interface RawLevel {
  id: number;
  name: string;
  theme: string;
  weather: string;
  exitColumn?: number;
  powerHelmet?: { x: number; y: number };
  npcs: [];
  grid: number[][];
}

class GridBuilder {
  private cells: number[][];

  constructor() {
    this.cells = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(TileType.Empty)
    );
  }

  sand(y: number, start: number, end: number): this {
    return this.fill(y, start, end, TileType.Sand);
  }

  coral(y: number, start: number, end: number): this {
    return this.fill(y, start, end, TileType.Coral);
  }

  ladder(x: number, startY: number, endY: number): this {
    return this.column(x, startY, endY, TileType.Ladder);
  }

  rope(y: number, start: number, end: number): this {
    return this.fill(y, start, end, TileType.Rope);
  }

  badge(x: number, y: number): this {
    return this.place(x, y, TileType.Badge);
  }

  badges(y: number, xs: number[]): this {
    xs.forEach((x) => this.badge(x, y));
    return this;
  }

  duck(x: number, y: number): this {
    return this.place(x, y, TileType.DuckSpawn);
  }

  ducks(y: number, xs: number[]): this {
    xs.forEach((x) => this.duck(x, y));
    return this;
  }

  player(x: number, y: number): this {
    return this.place(x, y, TileType.PlayerSpawn);
  }

  build(): number[][] {
    return this.cells.map((row) => [...row]);
  }

  private place(x: number, y: number, tile: TileType): this {
    this.assertInBounds(x, y);
    this.cells[y][x] = tile;
    return this;
  }

  private fill(y: number, start: number, end: number, tile: TileType): this {
    for (let x = start; x <= end; x++) {
      this.place(x, y, tile);
    }
    return this;
  }

  private column(x: number, startY: number, endY: number, tile: TileType): this {
    for (let y = startY; y <= endY; y++) {
      this.place(x, y, tile);
    }
    return this;
  }

  private assertInBounds(x: number, y: number): void {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
      throw new Error(`Out-of-bounds tile placement at (${x}, ${y})`);
    }
  }
}

function createBuiltLevel(
  id: number,
  name: string,
  theme: string,
  weather: WeatherType,
  exitColumn: number,
  build: (grid: GridBuilder) => void
): RawLevel {
  const grid = new GridBuilder();

  grid.sand(18, 0, 27);
  grid.sand(19, 0, 27);
  build(grid);

  const rawLevel: RawLevel = {
    id,
    name,
    theme,
    weather,
    exitColumn,
    npcs: [],
    grid: grid.build(),
  };

  validateBuiltLevel(rawLevel);
  return rawLevel;
}

function validateBuiltLevel(level: RawLevel): void {
  let playerCount = 0;
  let badgeCount = 0;
  let duckCount = 0;

  for (const row of level.grid) {
    for (const cell of row) {
      if (cell === TileType.PlayerSpawn) playerCount++;
      if (cell === TileType.Badge) badgeCount++;
      if (cell === TileType.DuckSpawn) duckCount++;
    }
  }

  if (playerCount !== 1) {
    throw new Error(`Level ${level.id} must have exactly one player spawn`);
  }

  if (badgeCount === 0) {
    throw new Error(`Level ${level.id} must contain at least one badge`);
  }

  if (level.id >= 6 && duckCount < 2) {
    throw new Error(`Level ${level.id} should sustain mid-game pressure with at least two ducks`);
  }
}

function withPowerHelmet(level: RawLevel, powerHelmet: { x: number; y: number }): RawLevel {
  return {
    ...level,
    powerHelmet,
  };
}

const levelOneVariants: RawLevel[] = [
  levelData01 as RawLevel,
  createBuiltLevel(1, 'Welcome to Vibetown', 'nature-1', WeatherType.None, 20, (g) => {
    g.sand(2, 2, 25);
    g.sand(9, 0, 27);
    g.sand(15, 2, 25);
    g.ladder(6, 2, 17).ladder(20, 2, 17);
    g.rope(5, 4, 23);
    g.badges(1, [3, 24]).badges(8, [1, 13]).badges(14, [5, 22]);
    g.ducks(8, [18]);
    g.player(1, 17);
  }),
  createBuiltLevel(1, 'Welcome to Vibetown', 'nature-1', WeatherType.None, 20, (g) => {
    g.sand(2, 1, 10).sand(2, 14, 26);
    g.sand(9, 0, 9).sand(9, 12, 27);
    g.sand(15, 3, 24);
    g.ladder(5, 2, 17).ladder(20, 2, 17);
    g.rope(5, 3, 24);
    g.badges(1, [2, 18]).badges(8, [1, 14]).badges(14, [6, 21]);
    g.ducks(8, [23]);
    g.player(1, 17);
  }),
];

const levelTwoVariants: RawLevel[] = [
  levelData02 as RawLevel,
  createBuiltLevel(2, 'Rope Tricks', 'nature-2', WeatherType.None, 20, (g) => {
    g.sand(2, 0, 27);
    g.sand(9, 0, 8).sand(9, 11, 17).sand(9, 20, 27);
    g.sand(15, 0, 27);
    g.ladder(6, 2, 17).ladder(20, 2, 17);
    g.rope(5, 0, 27).rope(12, 4, 23);
    g.badges(1, [2, 25]).badges(8, [1, 13]).badges(14, [5, 22]);
    g.ducks(8, [24]);
    g.player(1, 17);
  }),
  createBuiltLevel(2, 'Rope Tricks', 'nature-2', WeatherType.None, 13, (g) => {
    g.sand(2, 3, 24);
    g.sand(9, 0, 10).sand(9, 13, 17).sand(9, 20, 27);
    g.sand(15, 2, 25);
    g.ladder(5, 2, 17).ladder(13, 2, 17).ladder(21, 2, 17);
    g.rope(5, 3, 24).rope(12, 6, 21);
    g.badges(1, [4, 22]).badges(8, [1, 15]).badges(14, [6, 19]);
    g.ducks(8, [23]);
    g.player(1, 17);
  }),
];

const levelThreeVariants: RawLevel[] = [
  levelData03 as RawLevel,
  withPowerHelmet(
    createBuiltLevel(3, 'Dig Deep', 'nature-3', WeatherType.None, 13, (g) => {
      g.sand(2, 1, 8).sand(2, 11, 15).sand(2, 19, 26);
      g.sand(5, 10, 16);
      g.sand(13, 6, 20);
      g.ladder(5, 2, 17).ladder(13, 2, 17).ladder(22, 2, 17);
      g.rope(9, 5, 22);
      g.badges(1, [3, 24]).badges(4, [10, 16]).badges(12, [8, 18]);
      g.ducks(4, [13]);
      g.player(1, 17);
    }),
    { x: 13, y: 7 },
  ),
  withPowerHelmet(
    createBuiltLevel(3, 'Dig Deep', 'nature-3', WeatherType.None, 13, (g) => {
      g.sand(2, 3, 24);
      g.sand(5, 8, 18);
      g.sand(13, 4, 12).sand(13, 14, 22);
      g.ladder(6, 2, 17).ladder(13, 2, 17).ladder(20, 2, 17);
      g.rope(9, 3, 24);
      g.badges(1, [4, 22]).badges(4, [10, 16]).badges(12, [6, 19]);
      g.ducks(4, [13]);
      g.player(1, 17);
    }),
    { x: 13, y: 7 },
  ),
];

const levelFourVariants: RawLevel[] = [
  levelData04 as RawLevel,
  createBuiltLevel(4, 'Sunny Side', 'beach-1', WeatherType.Sunshine, 14, (g) => {
    g.sand(2, 4, 27);
    g.sand(9, 0, 27);
    g.sand(15, 3, 24);
    g.ladder(7, 2, 17).ladder(14, 2, 17).ladder(21, 2, 17);
    g.rope(5, 2, 25);
    g.badges(1, [5, 22]).badges(8, [1, 25]).badges(14, [4, 22]);
    g.ducks(8, [14]);
    g.player(1, 17);
  }),
  createBuiltLevel(4, 'Sunny Side', 'beach-1', WeatherType.Sunshine, 14, (g) => {
    g.sand(2, 4, 11).sand(2, 13, 18).sand(2, 20, 27);
    g.sand(9, 0, 12).sand(9, 15, 27);
    g.sand(15, 2, 25);
    g.ladder(7, 2, 17).ladder(14, 2, 17).ladder(21, 2, 17);
    g.rope(5, 3, 9).rope(5, 18, 24);
    g.badges(1, [5, 21]).badges(8, [1, 17]).badges(14, [4, 23]);
    g.ducks(8, [11]);
    g.player(1, 17);
  }),
];

const levelFiveVariants: RawLevel[] = [
  levelData05 as RawLevel,
  createBuiltLevel(5, 'Rainy Daze', 'beach-2', WeatherType.Rain, 14, (g) => {
    g.sand(2, 0, 27);
    g.sand(9, 0, 8).sand(9, 19, 27);
    g.sand(15, 0, 27);
    g.ladder(3, 2, 17).ladder(14, 2, 17).ladder(24, 2, 17);
    g.rope(5, 0, 9).rope(5, 18, 27).rope(11, 8, 19);
    g.badges(1, [1, 13, 25]).badges(14, [1, 11, 17]);
    g.ducks(8, [21]);
    g.player(1, 17);
  }),
  createBuiltLevel(5, 'Rainy Daze', 'beach-2', WeatherType.Rain, 14, (g) => {
    g.sand(2, 2, 11).sand(2, 14, 25);
    g.sand(9, 0, 9).sand(9, 18, 27);
    g.sand(15, 2, 25);
    g.ladder(4, 2, 17).ladder(14, 2, 17).ladder(24, 2, 17);
    g.rope(5, 1, 10).rope(5, 17, 26).rope(11, 6, 21);
    g.badges(1, [3, 16, 24]).badges(14, [1, 10, 21]);
    g.ducks(8, [19]);
    g.player(1, 17);
  }),
];

const builtLevels: RawLevel[] = [
  // Act II: teach one new wrinkle at a time.
  createBuiltLevel(6, 'Rope Lesson', 'beach-3', WeatherType.None, 14, (g) => {
    g.sand(2, 3, 24);
    g.sand(9, 0, 8).sand(9, 12, 16).sand(9, 20, 27);
    g.sand(15, 3, 12).sand(15, 15, 24);
    g.ladder(6, 2, 17).ladder(14, 9, 15).ladder(22, 2, 17);
    g.rope(5, 5, 22).rope(12, 6, 21);
    g.badges(1, [5, 22]).badges(8, [2, 14]).badges(14, [4, 17, 23]);
    g.ducks(14, [10, 18]);
    g.player(1, 17);
  }),
  createBuiltLevel(7, 'Split Stairs', 'city-1', WeatherType.None, 13, (g) => {
    g.sand(2, 4, 23);
    g.sand(8, 0, 6).sand(8, 10, 17).sand(8, 21, 27);
    g.sand(13, 3, 24);
    g.sand(15, 0, 4).sand(15, 8, 12).sand(15, 16, 20).sand(15, 24, 27);
    g.ladder(5, 2, 17).ladder(13, 2, 15).ladder(22, 2, 17);
    g.rope(5, 4, 23).rope(10, 0, 27);
    g.badges(1, [6, 21]).badges(7, [1, 12]).badges(12, [5, 20, 25]);
    g.ducks(14, [9, 19]);
    g.player(1, 17);
  }),
  createBuiltLevel(8, 'First Bait', 'city-2', WeatherType.None, 22, (g) => {
    g.sand(2, 2, 10).sand(2, 17, 25);
    g.sand(9, 0, 27);
    g.sand(15, 2, 8).sand(15, 11, 17).sand(15, 20, 26);
    g.coral(15, 9, 9).coral(15, 18, 18);
    g.ladder(6, 2, 17).ladder(14, 9, 17).ladder(22, 2, 17);
    g.rope(5, 3, 24);
    g.badges(1, [4, 22]).badges(8, [1, 13]).badges(14, [5, 21, 24]);
    g.ducks(8, [9, 18]);
    g.player(1, 17);
  }),
  createBuiltLevel(9, 'Rope Relay', 'city-3', WeatherType.None, 14, (g) => {
    g.sand(2, 2, 24);
    g.sand(6, 0, 8).sand(6, 12, 16).sand(6, 20, 27);
    g.sand(10, 2, 25);
    g.sand(15, 0, 6).sand(15, 10, 17).sand(15, 21, 27);
    g.ladder(4, 2, 17).ladder(14, 2, 15).ladder(23, 2, 17);
    g.rope(5, 3, 23).rope(9, 0, 27);
    g.badges(1, [3, 22]).badges(5, [1, 25]).badges(9, [4, 18]).badges(14, [12, 23]);
    g.ducks(14, [16]).ducks(8, [7]);
    g.player(1, 17);
  }),
  createBuiltLevel(10, 'Crossfire', 'rainbow-1', WeatherType.None, 20, (g) => {
    g.sand(2, 4, 23);
    g.sand(8, 0, 10).sand(8, 17, 27);
    g.sand(13, 3, 24);
    g.sand(15, 0, 6).sand(15, 9, 18).sand(15, 21, 27);
    g.coral(13, 12, 14);
    g.ladder(6, 2, 17).ladder(15, 2, 15).ladder(22, 2, 17);
    g.rope(5, 4, 23).rope(10, 1, 26);
    g.badges(1, [5, 22]).badges(7, [1, 18]).badges(12, [5]).badges(14, [2, 10, 24]);
    g.ducks(14, [8, 19]);
    g.player(1, 17);
  }),
  // Act III: combine route planning with duck pressure.
  createBuiltLevel(11, 'False Floor', 'rainbow-2', WeatherType.None, 13, (g) => {
    g.sand(2, 1, 10).sand(2, 17, 26);
    g.sand(7, 0, 6).sand(7, 10, 17).sand(7, 21, 27);
    g.sand(11, 3, 24);
    g.sand(15, 0, 8).sand(15, 11, 17).sand(15, 20, 27);
    g.coral(11, 9, 10).coral(11, 18, 19);
    g.ladder(4, 2, 17).ladder(13, 2, 17).ladder(22, 2, 17);
    g.rope(5, 2, 25).rope(9, 4, 23);
    g.badges(1, [3, 22]).badges(6, [1, 12]).badges(10, [5, 15]).badges(14, [2, 25]);
    g.ducks(8, [13]).ducks(14, [19]);
    g.player(1, 17);
  }),
  createBuiltLevel(12, 'High Water', 'rainbow-3', WeatherType.HighTide, 6, (g) => {
    g.sand(3, 1, 12).sand(3, 15, 26);
    g.sand(8, 0, 8).sand(8, 11, 17).sand(8, 20, 27);
    g.sand(12, 2, 25);
    g.sand(15, 5, 22);
    g.ladder(6, 3, 17).ladder(13, 8, 15).ladder(21, 3, 17);
    g.rope(10, 0, 27);
    g.badges(2, [2, 24]).badges(7, [1, 13]).badges(11, [4, 20]).badges(14, [8, 18]);
    g.ducks(14, [9, 17]);
    g.player(1, 17);
  }),
  createBuiltLevel(13, 'Ladder Tax', 'gray-1', WeatherType.None, 7, (g) => {
    g.sand(2, 2, 11).sand(2, 16, 25);
    g.sand(9, 0, 7).sand(9, 10, 17).sand(9, 20, 27);
    g.sand(15, 0, 27);
    g.coral(15, 6, 7).coral(15, 13, 14).coral(15, 20, 21);
    g.ladder(4, 2, 17).ladder(9, 9, 17).ladder(18, 2, 17).ladder(23, 9, 17);
    g.rope(5, 2, 25).rope(12, 4, 23);
    g.badges(1, [3, 24]).badges(8, [1, 13, 22]).badges(14, [2, 17, 25]);
    g.ducks(8, [12]).ducks(14, [22]);
    g.player(1, 17);
  }),
  createBuiltLevel(14, 'Trap Works', 'gray-2', WeatherType.None, 20, (g) => {
    g.sand(2, 4, 23);
    g.sand(9, 0, 27);
    g.sand(13, 3, 24);
    g.sand(15, 0, 8).sand(15, 11, 17).sand(15, 20, 27);
    g.coral(13, 10, 11).coral(13, 16, 17);
    g.ladder(7, 2, 17).ladder(14, 2, 15).ladder(21, 2, 17);
    g.rope(6, 5, 22);
    g.badges(1, [5, 22]).badges(8, [1, 17]).badges(12, [4, 19]).badges(14, [2, 6, 23]);
    g.ducks(14, [9, 24]).ducks(8, [18]);
    g.player(1, 17);
  }),
  createBuiltLevel(15, 'Three Story Panic', 'gray-3', WeatherType.Rain, 13, (g) => {
    g.sand(2, 0, 27);
    g.sand(9, 1, 8).sand(9, 11, 16).sand(9, 19, 26);
    g.sand(15, 2, 25);
    g.ladder(3, 2, 17).ladder(13, 2, 17).ladder(24, 2, 17);
    g.rope(5, 0, 27).rope(11, 0, 27);
    g.badges(1, [2, 13, 24]).badges(8, [4, 21]).badges(14, [5, 10, 17, 23]);
    g.ducks(14, [6, 22]).ducks(8, [14]);
    g.player(1, 17);
  }),
  createBuiltLevel(16, 'Crosscut', 'flower-1', WeatherType.Sunshine, 22, (g) => {
    g.sand(2, 2, 25);
    g.sand(6, 0, 7).sand(6, 10, 17).sand(6, 20, 27);
    g.sand(10, 2, 25);
    g.sand(15, 0, 6).sand(15, 9, 18).sand(15, 21, 27);
    g.ladder(5, 2, 15).ladder(13, 6, 17).ladder(22, 2, 17);
    g.rope(13, 4, 23);
    g.badges(1, [4, 13, 22]).badges(5, [1, 12]).badges(9, [6, 18]).badges(14, [2, 11]);
    g.ducks(14, [10, 23]).ducks(8, [20]);
    g.player(1, 17);
  }),
  createBuiltLevel(17, 'Bridge Bait', 'flower-2', WeatherType.None, 13, (g) => {
    g.sand(2, 3, 24);
    g.sand(8, 0, 10).sand(8, 13, 17).sand(8, 20, 27);
    g.sand(15, 2, 25);
    g.coral(15, 9, 10).coral(15, 17, 18);
    g.ladder(6, 2, 15).ladder(13, 2, 17).ladder(21, 2, 15);
    g.rope(5, 5, 22).rope(11, 0, 27);
    g.badges(1, [4, 13, 22]).badges(7, [1, 9, 26]).badges(14, [4, 19, 23]);
    g.ducks(14, [8, 20]).ducks(8, [15]);
    g.player(1, 17);
  }),
  createBuiltLevel(18, 'Midnight Run', 'flower-3', WeatherType.None, 6, (g) => {
    g.sand(2, 1, 10).sand(2, 17, 26);
    g.sand(9, 0, 27);
    g.sand(13, 0, 8).sand(13, 11, 17).sand(13, 20, 27);
    g.sand(15, 3, 24);
    g.ladder(5, 2, 17).ladder(13, 9, 15).ladder(22, 2, 17);
    g.rope(6, 2, 25);
    g.badges(1, [2, 8, 23]).badges(8, [1, 14, 26]).badges(12, [13, 24]).badges(14, [5]);
    g.ducks(8, [6, 23]).ducks(14, [14]);
    g.player(1, 17);
  }),
  createBuiltLevel(19, 'Sunrise Sprint', 'future-1', WeatherType.None, 20, (g) => {
    g.sand(2, 2, 10).sand(2, 17, 25);
    g.sand(9, 1, 12).sand(9, 15, 26);
    g.sand(15, 0, 27);
    g.coral(15, 8, 9).coral(15, 18, 19);
    g.ladder(6, 2, 17).ladder(20, 2, 17);
    g.rope(5, 0, 27).rope(12, 4, 23);
    g.badges(1, [3, 8, 24]).badges(8, [2, 12, 25]).badges(14, [2, 13, 23]);
    g.ducks(8, [11]).ducks(14, [6, 22]);
    g.player(1, 17);
  }),
  createBuiltLevel(20, 'Crowded House', 'future-2', WeatherType.None, 13, (g) => {
    g.sand(2, 4, 23);
    g.sand(9, 0, 27);
    g.sand(15, 0, 8).sand(15, 11, 17).sand(15, 20, 27);
    g.ladder(6, 2, 17).ladder(13, 2, 17).ladder(20, 2, 17);
    g.rope(5, 2, 25).rope(12, 0, 27);
    g.badges(1, [5, 13, 22]).badges(8, [1, 14, 20, 26]).badges(14, [1, 12, 16]);
    g.ducks(14, [5, 17]).ducks(8, [10, 23]);
    g.player(1, 17);
  }),
  createBuiltLevel(21, 'Drop Zone', 'future-3', WeatherType.TradeWinds, 13, (g) => {
    g.sand(3, 0, 27);
    g.sand(8, 2, 11).sand(8, 15, 25);
    g.sand(12, 0, 8).sand(12, 11, 17).sand(12, 20, 27);
    g.sand(15, 4, 23);
    g.coral(12, 9, 10).coral(12, 18, 19);
    g.ladder(3, 3, 17).ladder(13, 3, 15).ladder(24, 3, 17);
    g.rope(6, 0, 27).rope(10, 4, 23);
    g.badges(2, [2, 13, 24]).badges(7, [3, 18, 23]).badges(11, [1, 13]).badges(14, [6, 12]);
    g.ducks(14, [7, 19]).ducks(8, [13]);
    g.player(1, 17);
  }),
  createBuiltLevel(22, 'Wind Tunnel', 'gold-1', WeatherType.None, 7, (g) => {
    g.sand(2, 2, 11).sand(2, 15, 26);
    g.sand(7, 0, 8).sand(7, 11, 17).sand(7, 20, 27);
    g.sand(13, 2, 25);
    g.sand(15, 0, 6).sand(15, 9, 18).sand(15, 21, 27);
    g.ladder(5, 2, 15).ladder(13, 7, 17).ladder(22, 2, 17);
    g.rope(5, 0, 27).rope(10, 2, 25);
    g.badges(1, [3, 8, 24]).badges(6, [1, 13]).badges(12, [4, 19, 24]).badges(14, [2, 15]);
    g.ducks(8, [8, 18]).ducks(14, [24]);
    g.player(1, 17);
  }),
  createBuiltLevel(23, 'Backdoor', 'gold-2', WeatherType.Sunshine, 24, (g) => {
    g.sand(2, 1, 8).sand(2, 12, 18).sand(2, 22, 26);
    g.sand(9, 0, 9).sand(9, 13, 18).sand(9, 21, 27);
    g.sand(15, 2, 25);
    g.coral(15, 10, 11).coral(15, 16, 17);
    g.ladder(4, 2, 17).ladder(15, 2, 15).ladder(24, 2, 17);
    g.rope(6, 1, 18).rope(12, 9, 27);
    g.badges(1, [2, 13, 24]).badges(8, [1, 15, 25]).badges(14, [4, 8, 19, 23]);
    g.ducks(14, [10, 24]).ducks(8, [20]);
    g.player(1, 17);
  }),
  createBuiltLevel(24, 'Badge Storm', 'cosmic-1', WeatherType.None, 13, (g) => {
    g.sand(2, 0, 27);
    g.sand(8, 0, 27);
    g.sand(14, 0, 27);
    g.coral(8, 9, 10).coral(8, 18, 19).coral(14, 5, 6).coral(14, 15, 16).coral(14, 25, 26);
    g.ladder(3, 2, 17).ladder(8, 2, 17).ladder(13, 2, 17).ladder(18, 2, 17).ladder(23, 2, 17);
    g.rope(5, 0, 27).rope(11, 0, 27);
    g.badges(1, [2, 13, 25]).badges(7, [1, 12, 21, 26]).badges(13, [2, 12, 18, 24]);
    g.ducks(14, [6, 18]).ducks(8, [12, 24]);
    g.player(1, 17);
  }),
  createBuiltLevel(25, 'Vibetown Finale', 'cosmic-2', WeatherType.None, 13, (g) => {
    g.sand(2, 2, 11).sand(2, 15, 25);
    g.sand(6, 0, 8).sand(6, 11, 17).sand(6, 20, 27);
    g.sand(10, 2, 25);
    g.sand(15, 0, 6).sand(15, 9, 17).sand(15, 20, 27);
    g.coral(10, 8, 9).coral(10, 18, 19).coral(15, 7, 8).coral(15, 18, 19);
    g.ladder(4, 2, 17).ladder(13, 2, 17).ladder(22, 2, 17);
    g.rope(4, 0, 27).rope(8, 3, 24).rope(13, 1, 26);
    g.badges(1, [3, 8, 24]).badges(5, [1, 13, 26]).badges(9, [4, 16, 23]).badges(14, [2, 11, 15]);
    g.ducks(14, [5, 17]).ducks(8, [10, 22]);
    g.player(1, 17);
  }),
];

export const LEVEL_VARIANT_SLOTS: RawLevel[][] = [
  levelOneVariants,
  levelTwoVariants,
  levelThreeVariants,
  levelFourVariants,
  levelFiveVariants,
  ...builtLevels.map((level) => [level]),
];

// Canonical A-path campaign, useful for tests and any future "classic route" mode.
export const MASTER_LEVELS: RawLevel[] = LEVEL_VARIANT_SLOTS.map((slot) => slot[0]);

function cloneLevel(level: RawLevel): RawLevel {
  return {
    ...level,
    grid: level.grid.map((row) => [...row]),
    powerHelmet: level.powerHelmet ? { ...level.powerHelmet } : undefined,
  };
}

export const LEVELS: RawLevel[] = [];

// Rebuild the live level list from the curated variant slots.
// We clone so runtime mutations never touch the authored campaign data.
export function randomizeLevels(rng: () => number = Math.random): void {
  LEVELS.length = 0;

  for (const slot of LEVEL_VARIANT_SLOTS) {
    const variantIndex = Math.min(
      slot.length - 1,
      Math.floor(rng() * slot.length),
    );
    LEVELS.push(cloneLevel(slot[variantIndex]));
  }
}

randomizeLevels();
