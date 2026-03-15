/**
 * Sound effects using pre-pooled Audio elements for zero-latency playback.
 */

const POOL_SIZE = 4;
const pools: Map<string, HTMLAudioElement[]> = new Map();

function createPool(src: string): HTMLAudioElement[] {
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    pool.push(audio);
  }
  pools.set(src, pool);
  return pool;
}

function play(src: string, volume = 0.5): void {
  const pool = pools.get(src);
  if (!pool) return;
  // Find an idle instance or reuse the oldest
  const audio = pool.find(a => a.paused || a.ended) ?? pool[0];
  audio.currentTime = 0;
  audio.volume = volume;
  audio.play().catch(() => {});
}

// Pre-create pools for all sounds
createPool('/assets/audio/dig.mp3');
createPool('/assets/audio/collect.mp3');
createPool('/assets/audio/level-complete.mp3');
createPool('/assets/audio/trap.mp3');
createPool('/assets/audio/fall.mp3');
createPool('/assets/audio/cheer.wav');
createPool('/assets/audio/yay.wav');

export function sfxDig(): void { play('/assets/audio/dig.mp3', 0.5); }
export function sfxCollect(): void { play('/assets/audio/collect.mp3', 0.5); }
export function sfxLevelComplete(): void { play('/assets/audio/level-complete.mp3', 0.6); }
export function sfxTrap(): void { play('/assets/audio/trap.mp3', 0.5); }
export function sfxFall(): void { play('/assets/audio/fall.mp3', 0.4); }

export function sfxKill(): void {
  const sound = Math.random() < 0.5 ? '/assets/audio/cheer.wav' : '/assets/audio/yay.wav';
  play(sound, 0.15);
}
export function sfxDeath(): void { /* silence */ }
export function sfxLFV(): void { play('/assets/audio/collect.mp3', 0.6); }
export function sfxVibestr(): void { play('/assets/audio/collect.mp3', 0.3); }
export function sfxRevealLadders(): void { play('/assets/audio/collect.mp3', 0.4); }

export function resumeAudio(): void {}
