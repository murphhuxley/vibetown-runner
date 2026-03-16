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
  powerRunRight: SpriteAnimation;
  powerRunLeft: SpriteAnimation;
  powerFront: SpriteAnimation;
  powerPickup: SpriteAnimation;
}

export interface DuckSprites {
  right: HTMLImageElement;
  left: HTMLImageElement;
  front: HTMLImageElement;
  back: HTMLImageElement;
  death: SpriteAnimation;
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
  const version = 'gif-run-v7';

  const [runRight, runLeft, idle, climb, rope, digLeft, digRight, powerRunRight, powerRunLeft, powerFront, powerPickup] = await Promise.all([
    loadImage(base + 'player-run-right.png?v=' + version),
    loadImage(base + 'player-run-left.png?v=' + version),
    loadImage(base + 'player-idle.png?v=' + version),
    loadImage(base + 'player-climb-back.png?v=' + version),
    loadImage(base + 'player-rope-hang.png?v=' + version),
    loadImage(base + 'player-dig-left.png?v=' + version),
    loadImage(base + 'player-dig-right.png?v=' + version),
    loadImage(base + 'player-power-run-right.png?v=' + version),
    loadImage(base + 'player-power-run-left.png?v=' + version),
    loadImage(base + 'player-power-front.png?v=' + version),
    loadImage(base + 'power-helmet.png?v=' + version),
  ]);
  const runFrameCount = 8;
  const runSourceFrameWidth = Math.floor(runRight.naturalWidth / runFrameCount);
  const idleFrameCount = 4;
  const idleSourceFrameWidth = Math.floor(idle.naturalWidth / idleFrameCount);
  const climbFrameCount = 7;
  const climbSourceFrameWidth = Math.floor(climb.naturalWidth / climbFrameCount);
  const ropeFrameCount = 7;
  const ropeSourceFrameWidth = Math.floor(rope.naturalWidth / ropeFrameCount);
  const digFrameCount = 9;
  const digLeftSourceFrameWidth = Math.floor(digLeft.naturalWidth / digFrameCount);
  const digRightSourceFrameWidth = Math.floor(digRight.naturalWidth / digFrameCount);
  const powerRunFrameCount = 12;
  const powerRunSourceFrameWidth = Math.floor(powerRunRight.naturalWidth / powerRunFrameCount);
  const powerFrontFrameCount = 1;
  const powerFrontSourceFrameWidth = Math.floor(powerFront.naturalWidth / powerFrontFrameCount);
  const powerPickupFrameCount = 8;
  const powerPickupSourceFrameWidth = Math.floor(powerPickup.naturalWidth / powerPickupFrameCount);

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
      frameWidth: Math.floor(idleSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(idle.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: idleFrameCount,
      sourceFrameWidth: idleSourceFrameWidth,
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
      frameWidth: Math.floor(digLeftSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(digLeft.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: digFrameCount,
      sourceFrameWidth: digLeftSourceFrameWidth,
      sourceFrameHeight: digLeft.naturalHeight,
    },
    digRight: {
      image: digRight,
      frameWidth: Math.floor(digRightSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(digRight.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: digFrameCount,
      sourceFrameWidth: digRightSourceFrameWidth,
      sourceFrameHeight: digRight.naturalHeight,
    },
    powerRunRight: {
      image: powerRunRight,
      frameWidth: Math.floor(powerRunSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(powerRunRight.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: powerRunFrameCount,
      sourceFrameWidth: powerRunSourceFrameWidth,
      sourceFrameHeight: powerRunRight.naturalHeight,
    },
    powerRunLeft: {
      image: powerRunLeft,
      frameWidth: Math.floor(powerRunSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(powerRunLeft.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: powerRunFrameCount,
      sourceFrameWidth: powerRunSourceFrameWidth,
      sourceFrameHeight: powerRunLeft.naturalHeight,
    },
    powerFront: {
      image: powerFront,
      frameWidth: Math.floor(powerFrontSourceFrameWidth / PLAYER_SPRITE_SOURCE_SCALE),
      frameHeight: Math.floor(powerFront.naturalHeight / PLAYER_SPRITE_SOURCE_SCALE),
      frameCount: powerFrontFrameCount,
      sourceFrameWidth: powerFrontSourceFrameWidth,
      sourceFrameHeight: powerFront.naturalHeight,
    },
    powerPickup: {
      image: powerPickup,
      frameWidth: powerPickupSourceFrameWidth,
      frameHeight: powerPickup.naturalHeight,
      frameCount: powerPickupFrameCount,
      sourceFrameWidth: powerPickupSourceFrameWidth,
      sourceFrameHeight: powerPickup.naturalHeight,
    },
  };
}

export async function loadDuckSprites(): Promise<DuckSprites> {
  const base = '/assets/sprites/';
  const version = 'duck-v2';

  const [right, left, front, back, death] = await Promise.all([
    loadImage(base + 'duck-right.png?v=' + version),
    loadImage(base + 'duck-left.png?v=' + version),
    loadImage(base + 'duck-front.png?v=' + version),
    loadImage(base + 'duck-back.png?v=' + version),
    loadImage(base + 'duck-death.png?v=' + version),
  ]);

  const deathFrameCount = 8;
  const deathSourceFrameWidth = Math.floor(death.naturalWidth / deathFrameCount);

  return {
    right,
    left,
    front,
    back,
    death: {
      image: death,
      frameWidth: deathSourceFrameWidth,
      frameHeight: death.naturalHeight,
      frameCount: deathFrameCount,
      sourceFrameWidth: deathSourceFrameWidth,
      sourceFrameHeight: death.naturalHeight,
    },
  };
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
