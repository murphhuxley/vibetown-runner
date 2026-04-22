/**
 * Sound effects using pre-pooled Audio elements for zero-latency playback.
 */

const POOL_SIZE = 4;
const pools: Map<string, HTMLAudioElement[]> = new Map();
let uiAudioCtx: AudioContext | null = null;

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

function getUiAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!uiAudioCtx) {
    uiAudioCtx = new Ctx();
  }
  if (uiAudioCtx.state === 'suspended') {
    uiAudioCtx.resume().catch(() => {});
  }
  return uiAudioCtx;
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
createPool('/assets/audio/lfv-activate.mp3');

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
export function sfxLfvActivate(): void { play('/assets/audio/lfv-activate.mp3', 0.6); }
export function sfxShoot(): void { play('/assets/audio/shoot.mp3', 0.4); }
export function sfxLFV(): void { play('/assets/audio/collect.mp3', 0.6); }
export function sfxVibestr(): void { play('/assets/audio/collect.mp3', 0.3); }
export function sfxRevealLadders(): void { play('/assets/audio/collect.mp3', 0.4); }
export function sfxError(): void {
  const ctx = getUiAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Two-tone descending "nope" buzz
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520 - i * 140, t);
    osc.frequency.linearRampToValueAtTime(380 - i * 140, t + 0.1);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

export function sfxMenuClick(): void {
  const ctx = getUiAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Punchy two-tone chirp — SNES-style select sound
  const freqs = [660, 990];
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.045;
    // Triangle for warmth + square for bite
    for (const type of ['triangle', 'square'] as OscillatorType[]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqs[i], t);
      const vol = type === 'triangle' ? 0.1 : 0.04;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }
}

export function resumeAudio(): void {
  // Called on first user gesture to unlock audio on iOS Safari.
  getUiAudioCtx();
  // Prime every pool so AudioElements are "user-gesture authorized".
  for (const pool of pools.values()) {
    for (const audio of pool) {
      audio.muted = true;
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => { audio.muted = false; });
    }
  }
}

// ── Power-up SFX songs (pause music while active) ──
const shadowFunkAudio = new Audio('/assets/audio/shadow-funk.mp3');
shadowFunkAudio.preload = 'auto';
shadowFunkAudio.volume = 0.5;

const lfvAudio = new Audio('/assets/audio/lfv.mp3');
lfvAudio.preload = 'auto';
lfvAudio.volume = 0.5;

let powerSfxActive = false; // true when any power-up song is playing

function resumeMusicAfterPowerSfx(): void {
  powerSfxActive = false;
  if (musicPlaying && !musicMuted) {
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

function pauseMusicForPowerSfx(): void {
  powerSfxActive = true;
  musicTheme.pause();
  musicVibegaming.pause();
  // Stop the other power-up song if active
  shadowFunkAudio.pause();
  shadowFunkAudio.currentTime = 0;
  lfvAudio.pause();
  lfvAudio.currentTime = 0;
}

export function shadowFunkStart(): void {
  pauseMusicForPowerSfx();
  shadowFunkAudio.play().catch(() => {});
}

export function shadowFunkStop(): void {
  shadowFunkAudio.pause();
  shadowFunkAudio.currentTime = 0;
  if (!lfvAudio.paused) return; // LFV still going, don't resume music
  resumeMusicAfterPowerSfx();
}

export function lfvSfxStart(): void {
  pauseMusicForPowerSfx();
  lfvAudio.play().catch(() => {});
}

export function lfvSfxStop(): void {
  lfvAudio.pause();
  lfvAudio.currentTime = 0;
  if (!shadowFunkAudio.paused) return; // shadow funk still going, don't resume music
  resumeMusicAfterPowerSfx();
}

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
    if (!musicMuted && musicPlaying && !powerSfxActive) {
      musicVibegaming.currentTime = 0;
      musicVibegaming.play().catch(() => {});
    }
  };
  musicVibegaming.onended = () => {
    if (!musicMuted && musicPlaying && !powerSfxActive) {
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
  if (!musicMuted && !powerSfxActive) {
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
  } else if (musicPlaying && !powerSfxActive) {
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
