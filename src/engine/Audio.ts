/**
 * Sound effects using pre-pooled Audio elements for zero-latency playback.
 */

const POOL_SIZE = 4;
const pools: Map<string, HTMLAudioElement[]> = new Map();

function createPool(src: string): void {
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    pool.push(audio);
  }
  pools.set(src, pool);
}

function play(src: string, volume = 0.5): void {
  const pool = pools.get(src);
  if (!pool) return;
  const audio = pool.find(a => a.paused || a.ended) ?? pool[0];
  audio.currentTime = 0;
  audio.volume = volume;
  audio.play().catch(() => {});
}

// Looping fall sound — single instance that starts/stops
let fallAudio: HTMLAudioElement | null = null;
let fallPlaying = false;

function ensureFallAudio(): HTMLAudioElement {
  if (!fallAudio) {
    fallAudio = new Audio('/assets/audio/fall.mp3');
    fallAudio.preload = 'auto';
    fallAudio.loop = true;
  }
  return fallAudio;
}

// Pre-create pools for all sounds
createPool('/assets/audio/dig.mp3');
createPool('/assets/audio/collect.mp3');
createPool('/assets/audio/level-complete.mp3');
createPool('/assets/audio/trap.mp3');
createPool('/assets/audio/cheer.mp3');
createPool('/assets/audio/yay.mp3');
createPool('/assets/audio/death.mp3');
createPool('/assets/audio/shoot.mp3');

export function sfxDig(): void { play('/assets/audio/dig.mp3', 0.5); }
export function sfxCollect(): void { play('/assets/audio/collect.mp3', 0.5); }
export function sfxLevelComplete(): void { play('/assets/audio/level-complete.mp3', 0.6); }
export function sfxTrap(): void { play('/assets/audio/trap.mp3', 0.5); }

/** Start the falling sound loop — call every frame while falling */
export function sfxFallStart(): void {
  const audio = ensureFallAudio();
  if (!fallPlaying) {
    audio.volume = 0.35;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    fallPlaying = true;
  }
}

/** Stop the falling sound — call when player lands */
export function sfxFallStop(): void {
  if (fallPlaying && fallAudio) {
    fallAudio.pause();
    fallAudio.currentTime = 0;
    fallPlaying = false;
  }
}

export function sfxKill(): void {
  const sound = Math.random() < 0.5 ? '/assets/audio/cheer.mp3' : '/assets/audio/yay.mp3';
  play(sound, 0.45);
}
export function sfxDeath(): void { play('/assets/audio/death.mp3', 0.6); }
export function sfxShoot(): void { play('/assets/audio/shoot.mp3', 0.4); }
export function sfxLFV(): void { play('/assets/audio/collect.mp3', 0.6); }
export function sfxVibestr(): void { play('/assets/audio/collect.mp3', 0.3); }
export function sfxRevealLadders(): void { play('/assets/audio/collect.mp3', 0.4); }

export function resumeAudio(): void {}
