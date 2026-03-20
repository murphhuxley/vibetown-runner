export const GRID_COLS = 28;
export const GRID_ROWS = 20;
export const TILE_SIZE = 32;
export const DISPLAY_SCALE = 2;
export const RENDER_SCALE = 2;
export const PLAYER_SPRITE_SOURCE_SCALE = 1.75;

export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = (GRID_ROWS + 1) * TILE_SIZE;

export const HOLE_REGEN_TIME = 4_500;
export const HOLE_OPEN_ANIM = 520;
export const HOLE_CLOSE_ANIM = 300;
export const DUCK_HOLE_KILL_LEAD_MS = 150;
export const LFV_DURATION = 5_000;
export const DUCK_TRAP_ESCAPE_TIME = 3_000;
export const DUCK_TRAP_SUPPORT_DELAY = 250;
export const POWER_HELMET_SHOTS = 3;
export const POWER_PROJECTILE_SPEED = 18;
export const POWER_PROJECTILE_TTL = 900;

export const PLAYER_SPEED = 6;
export const DUCK_SPEED = 4;
export const PLAYER_FALL_SPEED = 10;
export const DUCK_FALL_SPEED = 6;
export const LFV_SPEED_MULTIPLIER = 1.5;
export const SUNSHINE_SPEED_MULTIPLIER = 1.25;
export const RAIN_SPEED_MULTIPLIER = 0.7;

export const SCORE_BADGE = 500;          // was 250
export const SCORE_TRAP_DUCK = 100;      // was 75
export const SCORE_KILL_DUCK = 100;      // was 75
export const SCORE_POWER_KILL = 150;
export const SCORE_VIBESTR = 100;
export const SCORE_LEVEL_COMPLETE = 2_000; // was 1_500
export const SCORE_LFV_BONUS = 1_000;    // was 2_000

export const VIBE_PER_BADGE = 20;
export const VIBE_PER_TRAP = 10;
export const VIBE_MAX = 100;

export const STARTING_LIVES = 3;

export const COLORS = {
  cream: '#F2EDE8',
  black: '#141414',
  olive: '#3D3D2B',
  green: '#5A7247',
  palmGreen: '#6B8E50',
  coral: '#C47A6C',
  dustyRose: '#B8867B',
  oceanBlue: '#4A7B8C',
  skyBlue: '#87BACC',
  sand: '#D4C5A9',
  darkSand: '#B8A88A',
  bamboo: '#A68B5B',
  silver: '#9BA0A8',
  gold: '#E8C547',
  vibestrGold: '#F5D76E',
} as const;
