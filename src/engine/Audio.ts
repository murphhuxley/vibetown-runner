/**
 * Retro synthesized sound effects using Web Audio API.
 * Inspired by classic Lode Runner SFX — no audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.15,
  freqEnd?: number,
): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + duration);
  }
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function playNoise(duration: number, volume = 0.1): void {
  const ac = getCtx();
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  source.connect(gain);
  gain.connect(ac.destination);
  source.start(ac.currentTime);
}

/** Short crunchy dig sound — noise burst + low frequency sweep */
export function sfxDig(): void {
  playNoise(0.08, 0.12);
  playTone(200, 0.08, 'square', 0.08, 80);
}

/** Bright ascending chime — money bag collected */
export function sfxCollect(): void {
  playTone(880, 0.08, 'square', 0.12);
  setTimeout(() => playTone(1320, 0.1, 'square', 0.12), 60);
}

/** Triumphant ascending arpeggio — level complete */
export function sfxLevelComplete(): void {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'square', 0.1), i * 120);
  });
}

/** Quick low thud — player lands after falling */
export function sfxLand(): void {
  playTone(120, 0.1, 'square', 0.1, 40);
}

/** Comedic descending boop — duck trapped */
export function sfxTrap(): void {
  playTone(600, 0.12, 'square', 0.1, 150);
}

/** Pop/splat — duck killed by closing hole */
export function sfxKill(): void {
  playNoise(0.06, 0.1);
  playTone(400, 0.06, 'square', 0.08, 800);
  setTimeout(() => playTone(200, 0.1, 'square', 0.06, 60), 50);
}

/** Power-up rising sweep — LFV activated */
export function sfxLFV(): void {
  playTone(300, 0.3, 'sawtooth', 0.08, 1200);
  setTimeout(() => playTone(600, 0.2, 'square', 0.06, 1600), 150);
}

/** Quick death sound — player caught */
export function sfxDeath(): void {
  playTone(400, 0.15, 'square', 0.1, 100);
  setTimeout(() => playTone(200, 0.2, 'square', 0.08, 50), 120);
}

/** Short step/footstep tick — optional for movement */
export function sfxStep(): void {
  playTone(150, 0.03, 'square', 0.04);
}

/** Collect $VIBESTR token */
export function sfxVibestr(): void {
  playTone(1047, 0.06, 'triangle', 0.1);
  setTimeout(() => playTone(1319, 0.08, 'triangle', 0.1), 50);
}

/** Hidden ladders revealed — magical ascending sweep */
export function sfxRevealLadders(): void {
  const notes = [440, 554, 659, 880, 1047, 1319];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, 'triangle', 0.06), i * 60);
  });
}

/** Resume audio context after user interaction (required by browsers) */
export function resumeAudio(): void {
  if (ctx?.state === 'suspended') {
    ctx.resume();
  }
}
