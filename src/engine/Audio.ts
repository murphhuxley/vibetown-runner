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

// ── Background Music ──
// Two-track cycle: theme → vibegaming → theme → ...
const musicTheme = new Audio('/assets/audio/viberunner-theme.mp3');
const musicVibegaming = new Audio('/assets/audio/vibegaming.mp3');
musicTheme.preload = 'auto';
musicVibegaming.preload = 'auto';

let musicMuted = false;
let musicPlaying = false;

function chainMusic(): void {
  musicTheme.onended = () => {
    if (!musicMuted && musicPlaying) {
      musicVibegaming.currentTime = 0;
      musicVibegaming.play().catch(() => {});
    }
  };
  musicVibegaming.onended = () => {
    if (!musicMuted && musicPlaying) {
      musicTheme.currentTime = 0;
      musicTheme.play().catch(() => {});
    }
  };
}
chainMusic();

/** Start playing the theme from the beginning. Chains to vibegaming on end. */
export function musicStart(): void {
  musicPlaying = true;
  musicVibegaming.pause();
  musicVibegaming.currentTime = 0;
  musicTheme.currentTime = 0;
  musicTheme.volume = 0.4;
  musicVibegaming.volume = 0.4;
  if (!musicMuted) {
    musicTheme.play().catch(() => {});
  }
}

/** Stop all music. */
export function musicStop(): void {
  musicPlaying = false;
  musicTheme.pause();
  musicTheme.currentTime = 0;
  musicVibegaming.pause();
  musicVibegaming.currentTime = 0;
}

/** Mute/unmute music (for sound toggle). */
export function musicSetMuted(muted: boolean): void {
  musicMuted = muted;
  if (muted) {
    musicTheme.pause();
    musicVibegaming.pause();
  } else if (musicPlaying) {
    // Resume whichever was active — if neither was mid-play, restart theme
    if (musicTheme.currentTime > 0 && musicTheme.currentTime < musicTheme.duration) {
      musicTheme.play().catch(() => {});
    } else if (musicVibegaming.currentTime > 0 && musicVibegaming.currentTime < musicVibegaming.duration) {
      musicVibegaming.play().catch(() => {});
    } else {
      musicTheme.currentTime = 0;
      musicTheme.play().catch(() => {});
    }
  }
}
