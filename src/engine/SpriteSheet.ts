import { PLAYER_SPRITE_SOURCE_SCALE } from '@/constants';

export interface SpriteAnimation {
  image: CanvasImageSource;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sourceFrameWidth?: number;
  sourceFrameHeight?: number;
}

export interface SpriteSet {
  runRight: SpriteAnimation;
  runLeft: SpriteAnimation;
  idle: SpriteAnimation;
  climb: SpriteAnimation;
  rope: SpriteAnimation;
  digLeft: SpriteAnimation;
  digRight: SpriteAnimation;
}

export interface DuckSprites {
  right: HTMLImageElement;
  left: HTMLImageElement;
  front: HTMLImageElement;
  back: HTMLImageElement;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadPlayerSprites(): Promise<SpriteSet> {
  const base = '/assets/sprites/';
  const version = 'aseprite-v2';

  const [runRight, runLeft, idle, climb, rope, digLeft, digRight] = await Promise.all([
    loadImage(base + 'player-run-right.png?v=' + version),
    loadImage(base + 'player-run-left.png?v=' + version),
    loadImage(base + 'player-idle.png?v=' + version),
    loadImage(base + 'player-climb-back.png?v=' + version),
    loadImage(base + 'player-rope-hang.png?v=' + version),
    loadImage(base + 'player-dig-left.png?v=' + version),
    loadImage(base + 'player-dig-right.png?v=' + version),
  ]);
  const runFrameCount = 5;
  const runSourceFrameWidth = Math.floor(runRight.naturalWidth / runFrameCount);
  const climbFrameCount = 2;
  const climbSourceFrameWidth = Math.floor(climb.naturalWidth / climbFrameCount);
  const ropeFrameCount = 2;
  const ropeSourceFrameWidth = Math.floor(rope.naturalWidth / ropeFrameCount);

  return {
    runRight: {
      image: runRight,
      frameWidth: Math.floor(runSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(runRight.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: runFrameCount,
      sourceFrameWidth: runSourceFrameWidth,
      sourceFrameHeight: runRight.naturalHeight,
    },
    runLeft: {
      image: runLeft,
      frameWidth: Math.floor(runSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(runLeft.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: runFrameCount,
      sourceFrameWidth: runSourceFrameWidth,
      sourceFrameHeight: runLeft.naturalHeight,
    },
    idle: {
      image: idle,
      frameWidth: Math.floor(idle.naturalWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(idle.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: 1,
      sourceFrameWidth: idle.naturalWidth,
      sourceFrameHeight: idle.naturalHeight,
    },
    climb: {
      image: climb,
      frameWidth: Math.floor(climbSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(climb.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: climbFrameCount,
      sourceFrameWidth: climbSourceFrameWidth,
      sourceFrameHeight: climb.naturalHeight,
    },
    rope: {
      image: rope,
      frameWidth: Math.floor(ropeSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(rope.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: ropeFrameCount,
      sourceFrameWidth: ropeSourceFrameWidth,
      sourceFrameHeight: rope.naturalHeight,
    },
    digLeft: {
      image: digLeft,
      frameWidth: Math.floor(digLeft.naturalWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(digLeft.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: 1,
      sourceFrameWidth: digLeft.naturalWidth,
      sourceFrameHeight: digLeft.naturalHeight,
    },
    digRight: {
      image: digRight,
      frameWidth: Math.floor(digRight.naturalWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(digRight.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: 1,
      sourceFrameWidth: digRight.naturalWidth,
      sourceFrameHeight: digRight.naturalHeight,
    },
  };
}

export async function loadDuckSprites(): Promise<DuckSprites> {
  const base = '/assets/sprites/';

  const [right, left, front, back] = await Promise.all([
    loadImage(base + 'duck-right.png'),
    loadImage(base + 'duck-left.png'),
    loadImage(base + 'duck-front.png'),
    loadImage(base + 'duck-back.png'),
  ]);

  return { right, left, front, back };
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  anim: SpriteAnimation,
  frameIndex: number,
  x: number,
  y: number,
): void {
  const fi = frameIndex % anim.frameCount;
  const sourceFrameWidth = anim.sourceFrameWidth ?? anim.frameWidth;
  const sourceFrameHeight = anim.sourceFrameHeight ?? anim.frameHeight;
  ctx.drawImage(
    anim.image,
    fi * sourceFrameWidth, 0,
    sourceFrameWidth, sourceFrameHeight,
    Math.round(x), Math.round(y),
    anim.frameWidth, anim.frameHeight,
  );
}
