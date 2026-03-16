export enum TileType {
  Empty = 0,
  Sand = 1,
  Coral = 2,
  Ladder = 3,
  Rope = 4,
  TrapSand = 5,
  HiddenLadder = 6,
  Badge = 7,
  DuckSpawn = 8,
  PlayerSpawn = 9,
}

export enum Direction {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down',
  None = 'none',
}

export enum GamePhase {
  Menu = 'menu',
  Playing = 'playing',
  Paused = 'paused',
  LevelComplete = 'level-complete',
  Dead = 'dead',
  GameOver = 'game-over',
  Victory = 'victory',
}

export enum WeatherType {
  None = 'none',
  Sunshine = 'sunshine',
  Rain = 'rain',
  TradeWinds = 'trade-winds',
  HighTide = 'high-tide',
}

export interface Position {
  x: number;
  y: number;
}

export interface Hole {
  x: number;
  y: number;
  timer: number;
  phase: 'opening' | 'open' | 'closing';
  fillTile: TileType.Sand | TileType.TrapSand;
  direction: Direction.Left | Direction.Right;
}

export interface PlayerState {
  pos: Position;
  facing: Direction;
  isDigging: boolean;
  isOnRope: boolean;
  isOnLadder: boolean;
  isFalling: boolean;
  isLFV: boolean;
  alive: boolean;
}

export interface DuckState {
  id: number;
  pos: Position;
  facing: Direction;
  isTrapped: boolean;
  isFalling: boolean;
  isOnRope: boolean;
  isOnLadder: boolean;
  carryingBadge: boolean;
  trapTimer: number;
}

export interface ProjectileState {
  pos: { x: number; y: number };
  prevPos: { x: number; y: number };
  direction: Direction.Left | Direction.Right;
  ttl: number;
}

export interface NPCData {
  name: string;
  pos: Position;
  dialogue: string[];
  spriteKey: string;
}

export interface LevelData {
  id: number;
  name: string;
  grid: TileType[][];
  weather: WeatherType;
  npcs: NPCData[];
  par?: number;
  exitColumn?: number;
  theme?: string;
  powerHelmet?: Position;
}

export interface GameState {
  phase: GamePhase;
  level: LevelData;
  grid: TileType[][];
  player: PlayerState;
  ducks: DuckState[];
  holes: Hole[];
  score: number;
  lives: number;
  badgesCollected: number;
  badgesTotal: number;
  vibestr: number;
  vibeMeter: number;
  lfvTimer: number;
  currentLevel: number;
  weather: WeatherType;
  powerHelmetPos: Position | null;
  powerHelmetCollected: boolean;
  powerHelmetActive: boolean;
  powerHelmetShots: number;
}
