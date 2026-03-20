import { GameManager } from '@/game/GameManager';
import { GameLoop } from '@/engine/GameLoop';
import { Renderer } from '@/engine/Renderer';
import { InputManager } from '@/engine/Input';
import { loadPlayerSprites, loadDuckSprites } from '@/engine/SpriteSheet';
import { GamePhase } from '@/types';
import { getTheme } from '@/engine/Themes';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_ROWS, TILE_SIZE, COLORS, DISPLAY_SCALE, RENDER_SCALE } from '@/constants';
import { sfxDig, sfxCollect, sfxTrap, sfxKill, sfxDeath, sfxShoot, sfxLFV, sfxLevelComplete, sfxVibestr, sfxRevealLadders, sfxFallStart, sfxFallStop, sfxLfvActivate, sfxError, sfxMenuClick, musicStart, musicStop, musicSetMuted, shadowFunkStart, shadowFunkStop, lfvSfxStart, lfvSfxStop } from '@/engine/Audio';
import { getTop25, submitScore, LeaderboardEntry } from '@/leaderboard';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function syncCanvasDisplaySize(): void {
  canvas.width = Math.floor(CANVAS_WIDTH * RENDER_SCALE);
  canvas.height = Math.floor(CANVAS_HEIGHT * RENDER_SCALE);
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const scale = Math.min(
    DISPLAY_SCALE,
    window.innerWidth / CANVAS_WIDTH,
    window.innerHeight / CANVAS_HEIGHT,
  );
  const appliedScale = scale;

  canvas.style.width = `${Math.floor(CANVAS_WIDTH * appliedScale)}px`;
  canvas.style.height = `${Math.floor(CANVAS_HEIGHT * appliedScale)}px`;
}

syncCanvasDisplaySize();
window.addEventListener('resize', syncCanvasDisplaySize);

const input = new InputManager();
input.bind();

const game = new GameManager(input);
const renderer = new Renderer(ctx);
const isDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Wire up SFX
game.onDig = sfxDig;
game.onCollect = sfxCollect;
game.onTrap = sfxTrap;
game.onKill = sfxKill;
game.onDeath = sfxDeath;
game.onLevelComplete = sfxLevelComplete;
game.onVibestr = sfxVibestr;
game.onRevealLadders = sfxRevealLadders;

function onShoot(): void {
  renderer.startPowerShoot();
}
renderer.onPowerShootMidpoint = () => {
  sfxShoot();
  game.fireQueuedProjectile();
};

const sfLeftHelmet = document.getElementById('shadow-funk-left')!;
const sfRightHelmet = document.getElementById('shadow-funk-right')!;

// Render SHADOW/FUNK text to canvases for true pixel art look
function renderSfTextCanvases(): void {
  const scale = 4;
  const font = "bold 14px 'Brice', sans-serif";
  document.querySelectorAll<HTMLCanvasElement>('.sf-shadow').forEach(c => {
    const tctx = c.getContext('2d')!;
    tctx.font = font;
    const w = Math.ceil(tctx.measureText('SHADOW').width) + 4;
    const h = 18;
    c.width = w; c.height = h;
    tctx.font = font;
    tctx.fillStyle = '#FFFFFF';
    tctx.textBaseline = 'middle';
    tctx.fillText('SHADOW', 2, h / 2 + 1);
    c.style.width = (w * scale) + 'px';
    c.style.height = (h * scale) + 'px';
  });
  document.querySelectorAll<HTMLCanvasElement>('.sf-funk').forEach(c => {
    const tctx = c.getContext('2d')!;
    tctx.font = font;
    const w = Math.ceil(tctx.measureText('FUNK').width) + 4;
    const h = 18;
    c.width = w; c.height = h;
    tctx.font = font;
    tctx.fillStyle = '#FFFFFF';
    tctx.textBaseline = 'middle';
    tctx.fillText('FUNK', 2, h / 2 + 1);
    c.style.width = (w * scale) + 'px';
    c.style.height = (h * scale) + 'px';
  });
}
document.fonts.ready.then(renderSfTextCanvases);

function positionSideHelmets(): void {
  const rect = canvas.getBoundingClientRect();
  const minGap = 160;
  const leftGap = rect.left;
  const rightGap = window.innerWidth - rect.right;
  const gap = Math.min(leftGap, rightGap);
  if (gap < 100) {
    sfLeftHelmet.style.display = 'none';
    sfRightHelmet.style.display = 'none';
    return;
  }
  // Scale down to fit the available gap
  const maxW = gap - 20;
  const s = Math.min(1, maxW / 160);
  sfLeftHelmet.style.display = '';
  sfRightHelmet.style.display = '';
  sfLeftHelmet.style.transform = `translateY(-50%) scale(${s})`;
  sfRightHelmet.style.transform = `translateY(-50%) scale(${s})`;
  sfLeftHelmet.style.left = Math.max(0, (leftGap - 160 * s) / 2) + 'px';
  sfRightHelmet.style.right = Math.max(0, (rightGap - 160 * s) / 2) + 'px';
}

function onPowerActivate(): void {
  game.powerAnimationPlaying = true;
  renderer.startPowerActivation();
  shadowFunkStart();
  positionSideHelmets();
  sfLeftHelmet.classList.remove('hidden');
  sfRightHelmet.classList.remove('hidden');
}

function onPowerEnd(): void {
  game.powerAnimationPlaying = false;
  shadowFunkStop();
  sfLeftHelmet.classList.add('hidden');
  sfRightHelmet.classList.add('hidden');
}

const lfvLeft = document.getElementById('lfv-left')!;
const lfvRight = document.getElementById('lfv-right')!;

function positionLfvSides(): void {
  const rect = canvas.getBoundingClientRect();
  const imgW = 204;
  const minGap = 160;
  const leftGap = rect.left;
  const rightGap = window.innerWidth - rect.right;
  if (leftGap < minGap || rightGap < minGap) {
    lfvLeft.style.display = 'none';
    lfvRight.style.display = 'none';
    return;
  }
  lfvLeft.style.display = '';
  lfvRight.style.display = '';
  lfvLeft.style.left = Math.max(0, (leftGap - imgW) / 2) + 'px';
  lfvRight.style.right = Math.max(0, (rightGap - imgW) / 2) + 'px';
}

function onLfvActivate(): void {
  game.lfvAnimationPlaying = true;
  renderer.startLfvActivation();
  sfxLfvActivate();
  lfvSfxStart();
}

renderer.onLfvActivationDone = () => {
  game.lfvAnimationPlaying = false;
  positionLfvSides();
  lfvLeft.classList.remove('hidden');
  lfvRight.classList.remove('hidden');
};
renderer.onPowerActivationDone = () => {
  game.powerAnimationPlaying = false;
};

function onLfvEnd(): void {
  lfvSfxStop();
  lfvLeft.classList.add('hidden');
  lfvRight.classList.add('hidden');
}

game.onPowerStart = onPowerActivate;
game.onPowerEnd = onPowerEnd;
game.onLFV = onLfvActivate;
game.onLFVEnd = onLfvEnd;
game.onLFVDenied = sfxError;
game.onShoot = onShoot;

// ── Main Menu UI ──
const menuScreen = document.getElementById('menu-screen')!;
const menuPanel = document.getElementById('menu-panel')!;
const instructionsPanel = document.getElementById('instructions-panel')!;
const optionsPanel = document.getElementById('options-panel')!;

function showPanel(panel: HTMLElement): void {
  menuPanel.classList.add('hidden');
  instructionsPanel.classList.add('hidden');
  optionsPanel.classList.add('hidden');
  leaderboardPanel.classList.add('hidden');
  panel.classList.remove('hidden');
}

function hideMenu(): void {
  menuScreen.classList.add('hidden');
  game.startGame();
  musicStop();
  musicStart();
  canvas.focus();
}

function showMenu(): void {
  menuScreen.classList.remove('hidden');
  showPanel(menuPanel);
  game.state.phase = GamePhase.Menu;
}

// MENU click detection on canvas HUD area + overlay audio toggles
canvas.addEventListener('click', (e) => {
  if (game.state.phase === GamePhase.Menu) return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const cy = ((e.clientY - rect.top) / rect.height) * (CANVAS_HEIGHT);
  const hudY = GRID_ROWS * TILE_SIZE;
  // MENU text is at the right end of the HUD bar
  if (cy >= hudY && cx >= CANVAS_WIDTH - 100) {
    showMenu();
  }
  // Audio toggle click regions on overlay screens
  const phase = game.state.phase;
  if (phase === GamePhase.Paused || phase === GamePhase.Dead || phase === GamePhase.GameOver || phase === GamePhase.Victory) {
    const toggleY = phase === GamePhase.Paused ? CANVAS_HEIGHT / 2 + 90
                   : phase === GamePhase.Dead ? CANVAS_HEIGHT / 2 + 90
                   : phase === GamePhase.GameOver ? CANVAS_HEIGHT / 2 + 110
                   : CANVAS_HEIGHT / 2 + 130;
    const center = CANVAS_WIDTH / 2;
    const spacing = 120;
    const half = TOGGLE_SIZE / 2;
    // SFX icon hit area
    const sfxIconX = center - spacing / 2 - TOGGLE_SIZE;
    if (cx >= sfxIconX && cx <= sfxIconX + TOGGLE_SIZE && cy >= toggleY - half && cy <= toggleY + half) {
      toggleSoundEnabled();
    }
    // Music icon hit area
    const musIconX = center + spacing / 2 - TOGGLE_SIZE;
    if (cx >= musIconX && cx <= musIconX + TOGGLE_SIZE && cy >= toggleY - half && cy <= toggleY + half) {
      toggleMusicEnabled();
    }
  }
});

const soundToggle = document.getElementById('sound-toggle')!;
let soundEnabled = true;

document.getElementById('btn-play')!.addEventListener('click', () => { sfxMenuClick(); hideMenu(); });
document.getElementById('btn-instructions')!.addEventListener('click', () => {
  sfxMenuClick(); showPanel(instructionsPanel);
});
document.getElementById('instructions-close')!.addEventListener('click', () => {
  sfxMenuClick(); showPanel(menuPanel);
});
document.getElementById('btn-options')!.addEventListener('click', () => {
  sfxMenuClick(); showPanel(optionsPanel);
});
document.getElementById('options-close')!.addEventListener('click', () => {
  sfxMenuClick(); showPanel(menuPanel);
});
soundToggle.addEventListener('click', () => { sfxMenuClick(); toggleSoundEnabled(); });

// ── Music Toggle ──
const musicToggle = document.getElementById('music-toggle')!;
let musicEnabled = true;
musicToggle.addEventListener('click', () => { sfxMenuClick(); toggleMusicEnabled(); });

// ── Menu Music Toggle (bottom-right of main menu) ──
const menuMusicBtn = document.getElementById('menu-music-btn')!;
menuMusicBtn.addEventListener('click', () => {
  toggleMusicEnabled();
  // Sync the menu toggle image
  const img = menuMusicBtn.querySelector('img')!;
  img.src = musicEnabled ? '/assets/sprites/toggle-on.png' : '/assets/sprites/toggle-off.png';
  img.alt = musicEnabled ? 'ON' : 'OFF';
});

// ── Leaderboard ──
const leaderboardPanel = document.getElementById('leaderboard-panel')!;
const lbEntries = document.getElementById('lb-entries')!;

function renderLeaderboard(entries: LeaderboardEntry[], highlightId?: string): void {
  while (lbEntries.firstChild) lbEntries.removeChild(lbEntries.firstChild);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#888;padding:20px;font-family:Brice,sans-serif';
    empty.textContent = 'No scores yet. Be the first!';
    lbEntries.appendChild(empty);
    return;
  }
  entries.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (entry._id === highlightId ? ' highlight' : '');

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(i + 1);

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.name;

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = entry.score.toLocaleString();

    const level = document.createElement('span');
    level.className = 'lb-level';
    level.textContent = String(entry.level);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(level);
    row.appendChild(score);
    lbEntries.appendChild(row);
  });
}

async function showLeaderboard(highlightId?: string): Promise<void> {
  while (lbEntries.firstChild) lbEntries.removeChild(lbEntries.firstChild);
  const loading = document.createElement('div');
  loading.style.cssText = 'color:#888;padding:20px;font-family:Brice,sans-serif';
  loading.textContent = 'Loading...';
  lbEntries.appendChild(loading);
  menuScreen.classList.remove('hidden');
  showPanel(leaderboardPanel);
  game.state.phase = GamePhase.Menu;
  try {
    const entries = await getTop25();
    renderLeaderboard(entries, highlightId);
  } catch {
    loading.textContent = 'Failed to load scores.';
  }
}

document.getElementById('btn-quit')!.addEventListener('click', () => {
  sfxMenuClick(); showLeaderboard();
});
document.getElementById('leaderboard-close')!.addEventListener('click', () => {
  sfxMenuClick(); showPanel(menuPanel);
});

// ── Score Submission ──
const scoreSubmitModal = document.getElementById('score-submit')!;
const scoreNameInput = document.getElementById('score-name-input') as HTMLInputElement;
const submitScoreDisplay = document.getElementById('submit-score-display')!;
const scoreSubmitBtn = document.getElementById('score-submit-btn') as HTMLButtonElement;
const scoreSkipBtn = document.getElementById('score-skip-btn') as HTMLButtonElement;
let hasSubmittedThisRun = false;
let scoreSubmitInFlight = false;

function setScoreSubmitPending(pending: boolean): void {
  scoreSubmitInFlight = pending;
  scoreSubmitBtn.disabled = pending;
  scoreSkipBtn.disabled = pending;
  scoreNameInput.disabled = pending;
}

function showScoreSubmit(): void {
  if (hasSubmittedThisRun) return;
  submitScoreDisplay.textContent = `Score: ${game.state.score.toLocaleString()}  |  Level: ${game.state.currentLevel}`;
  scoreNameInput.value = '';
  setScoreSubmitPending(false);
  scoreSubmitModal.classList.remove('hidden');
  setTimeout(() => scoreNameInput.focus(), 100);
}

scoreSubmitBtn.addEventListener('click', async () => {
  if (scoreSubmitInFlight) return;
  const name = scoreNameInput.value.trim();
  if (!name) return;
  setScoreSubmitPending(true);
  scoreSubmitModal.classList.add('hidden');
  hasSubmittedThisRun = true;
  try {
    const id = await submitScore(name, game.state.score, game.state.currentLevel);
    await showLeaderboard(id);
  } catch {
    await showLeaderboard();
  } finally {
    setScoreSubmitPending(false);
  }
});

scoreSkipBtn.addEventListener('click', () => {
  if (scoreSubmitInFlight) return;
  scoreSubmitModal.classList.add('hidden');
  hasSubmittedThisRun = true;
});

scoreNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    scoreSubmitBtn.click();
  }
});

function syncTheme(): void {
  const key = game.state.level.theme ?? 'beach';
  renderer.setTheme(getTheme(key), key);
}
syncTheme();

// Load sprites async — game runs with fallback rectangles until loaded
loadPlayerSprites().then((sprites) => {
  renderer.sprites = sprites;
  if (isDevHost) {
    console.log('Player sprites loaded');
  }
}).catch((err) => console.warn('Player sprites failed:', err));

loadDuckSprites().then((duckSprites) => {
  renderer.duckSprites = duckSprites;
  if (isDevHost) {
    console.log('Duck sprites loaded');
  }
}).catch((err) => console.warn('Duck sprites failed:', err));


// ── Canvas audio toggles (drawn on death/gameover/victory overlays) ──
const toggleOnImg = new Image();
toggleOnImg.src = '/assets/sprites/toggle-on.png';
const toggleOffImg = new Image();
toggleOffImg.src = '/assets/sprites/toggle-off.png';
const TOGGLE_SIZE = 28;
const TOGGLE_FONT = "bold 14px 'Brice', sans-serif";

let lastToggleY = 0;

function drawAudioToggles(y: number): void {
  lastToggleY = y;
  const center = CANVAS_WIDTH / 2;
  const spacing = 120; // distance between SFX and Music groups

  // SFX: label + toggle icon
  ctx.font = TOGGLE_FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = soundEnabled ? '#F5D76E' : '#666';
  ctx.fillText('SFX', center - spacing / 2 - TOGGLE_SIZE - 6, y);
  const sfxImg = soundEnabled ? toggleOnImg : toggleOffImg;
  if (sfxImg.complete) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sfxImg, center - spacing / 2 - TOGGLE_SIZE, y - TOGGLE_SIZE / 2, TOGGLE_SIZE, TOGGLE_SIZE);
  }

  // Music: label + toggle icon
  ctx.textAlign = 'right';
  ctx.fillStyle = musicEnabled ? '#F5D76E' : '#666';
  ctx.fillText('MUSIC', center + spacing / 2 - TOGGLE_SIZE - 6, y);
  const musImg = musicEnabled ? toggleOnImg : toggleOffImg;
  if (musImg.complete) {
    ctx.drawImage(musImg, center + spacing / 2 - TOGGLE_SIZE, y - TOGGLE_SIZE / 2, TOGGLE_SIZE, TOGGLE_SIZE);
  }
  ctx.imageSmoothingEnabled = false;
}

function toggleSoundEnabled(): void {
  soundEnabled = !soundEnabled;
  const toggleImg = soundToggle.querySelector('img')!;
  toggleImg.src = soundEnabled ? '/assets/sprites/toggle-on.png' : '/assets/sprites/toggle-off.png';
  toggleImg.alt = soundEnabled ? 'ON' : 'OFF';
  if (soundEnabled) {
    game.onDig = sfxDig; game.onCollect = sfxCollect; game.onTrap = sfxTrap;
    game.onKill = sfxKill; game.onDeath = sfxDeath; game.onShoot = onShoot;
    game.onLFV = onLfvActivate; game.onLFVEnd = onLfvEnd; game.onLFVDenied = sfxError;
    game.onLevelComplete = sfxLevelComplete;
    game.onVibestr = sfxVibestr; game.onRevealLadders = sfxRevealLadders;
    game.onPowerStart = onPowerActivate; game.onPowerEnd = onPowerEnd;
  } else {
    game.onDig = undefined; game.onCollect = undefined; game.onTrap = undefined;
    game.onKill = undefined; game.onDeath = undefined; game.onShoot = undefined;
    game.onLFV = undefined; game.onLFVEnd = undefined; game.onLFVDenied = undefined; game.onLevelComplete = undefined;
    game.onVibestr = undefined; game.onRevealLadders = undefined;
    game.onPowerStart = undefined; game.onPowerEnd = undefined;
    shadowFunkStop(); lfvSfxStop();
  }
}

function toggleMusicEnabled(): void {
  musicEnabled = !musicEnabled;
  const src = musicEnabled ? '/assets/sprites/toggle-on.png' : '/assets/sprites/toggle-off.png';
  const alt = musicEnabled ? 'ON' : 'OFF';
  // Sync both toggle buttons (options page + main menu)
  for (const btn of [musicToggle, menuMusicBtn]) {
    const img = btn.querySelector('img');
    if (img) { img.src = src; img.alt = alt; }
  }
  musicSetMuted(!musicEnabled);
}

let lastDt = 0;
let playerRenderPos = game.getPlayerRenderPos();
const loop = new GameLoop(
  (dt) => {
    lastDt = dt;
    if (game.state.phase === GamePhase.Paused) { input.endFrame(); return; }
    game.update(dt);
    playerRenderPos = game.getPlayerRenderPos();

    // Snapshot player visual state BEFORE endFrame clears anything
    // Only animate during Playing phase — prevents wrong-direction sprite
    // showing through semi-transparent death/complete overlays.
    // Drive animation from actual interpolated movement instead of raw input,
    // so blocked/spawned players still render as idle/front-facing.
    const isPlaying = game.state.phase === GamePhase.Playing;
    const dx = Math.abs(playerRenderPos.x - game.state.player.pos.x);
    const dy = Math.abs(playerRenderPos.y - game.state.player.pos.y);
    const movingHorizontally = dx > 0.001;
    const movingVertically = dy > 0.001;
    const usingRope = isPlaying && game.state.player.isOnRope;
    const onLadder = isPlaying && game.state.player.isOnLadder && !usingRope;
    const usingLadder = onLadder && !movingHorizontally;

    renderer.playerUsingRope = usingRope;
    renderer.playerUsingLadder = usingLadder;
    renderer.playerClimbing = usingLadder && movingVertically;
    renderer.playerMoving = isPlaying && !usingLadder && !usingRope && movingHorizontally;
    renderer.playerFacing = game.state.player.facing;
    renderer.playerDigging = isPlaying && game.state.player.isDigging;
    renderer.playerPowerActive = isPlaying && game.state.powerHelmetActive;
    renderer.playerIdling = isPlaying
      && !game.state.player.isDigging
      && !usingLadder
      && !usingRope
      && !movingHorizontally
      && !movingVertically;
    renderer.updateAnimation(dt);

    // Fall sound — play while falling, stop on land
    if (isPlaying && game.state.player.isFalling) {
      sfxFallStart();
    } else {
      sfxFallStop();
    }

    input.endFrame();
  },
  () => {
    renderer.setWeather(game.state.weather);
    renderer.clear(lastDt);
    renderer.drawGrid(game.state.grid);
    renderer.drawHoles(game.state.holes);
    renderer.drawWeather();

    if (game.state.powerHelmetPos && !game.state.powerHelmetCollected && !game.state.powerHelmetActive) {
      renderer.drawPowerHelmetPickup(game.state.powerHelmetPos);
    }

    // Draw $VIBESTR drops
    for (const drop of game.drops) {
      renderer.drawMoneyDrop(drop.pos);
    }

    // Draw ducks (with smooth interpolation)
    for (const duck of game.state.ducks) {
      const renderPos = duck.isTrapped ? duck.pos : game.getDuckRenderPos(duck.id);
      renderer.drawDuck(renderPos, duck.isTrapped, duck.facing, duck.isOnLadder);
    }

    renderer.drawProjectiles(game.projectiles);

    // Draw player
    renderer.drawPlayer(playerRenderPos, game.state.player.isLFV);

    // Duck kill animation
    renderer.drawDuckDeaths(game.duckDeaths);
    renderer.drawConfetti(game.confetti);

    // Draw HUD
    renderer.drawHUD(
      game.state.score,
      game.state.lives,
      game.state.currentLevel,
      game.vibeMeter,
      game.state.vibestr
    );

    // Phase overlays
    if (game.state.phase === GamePhase.Paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.cream;
      ctx.font = "bold 32px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = "12px 'Brice', sans-serif";
      ctx.fillStyle = '#A0A0A0';
      ctx.fillText('Z = Dig Left  |  C = Dig Right  |  SPACE = LFV', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.fillStyle = COLORS.cream;
      ctx.font = "16px 'Brice', sans-serif";
      ctx.fillText('Press any key to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      drawAudioToggles(CANVAS_HEIGHT / 2 + 90);
    }

    if (game.state.phase === GamePhase.Dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.cream;
      ctx.font = "bold 32px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAD VIBES...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = "12px 'Brice', sans-serif";
      ctx.fillStyle = '#A0A0A0';
      ctx.fillText('Z = Dig Left  |  C = Dig Right  |  SPACE = LFV', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.fillStyle = COLORS.cream;
      ctx.font = "16px 'Brice', sans-serif";
      ctx.fillText('Press ENTER to retry', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      drawAudioToggles(CANVAS_HEIGHT / 2 + 90);
    }

    if (game.state.phase === GamePhase.LevelComplete) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.vibestrGold;
      ctx.font = "bold 32px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LETS FREAKING VIBE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = "16px 'Brice', sans-serif";
      ctx.fillStyle = COLORS.cream;
      ctx.fillText('Press ENTER for next level', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }

    if (game.state.phase === GamePhase.GameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.coral;
      ctx.font = "900 40px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = "16px 'Brice', sans-serif";
      ctx.fillStyle = COLORS.cream;
      ctx.fillText(`Final Score: ${game.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      ctx.fillText('Press ENTER to play again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
      drawAudioToggles(CANVAS_HEIGHT / 2 + 110);
    }

    if (game.state.phase === GamePhase.Victory) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.vibestrGold;
      ctx.font = "900 36px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VIBETOWN CHAMPION', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
      ctx.font = "20px 'Brice', sans-serif";
      ctx.fillStyle = COLORS.cream;
      ctx.fillText(`Final Score: ${game.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.fillText(`$VIBESTR: ${game.state.vibestr}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      ctx.font = "16px 'Brice', sans-serif";
      ctx.fillText('Press ENTER to play again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90);
      drawAudioToggles(CANVAS_HEIGHT / 2 + 130);
    }
  }
);

// Handle state transitions (retry / next level)
window.addEventListener('keydown', (e) => {
  if (game.state.phase === GamePhase.Paused) {
    game.state.phase = GamePhase.Playing;
    return;
  }
  if (e.key === 'Escape' && game.state.phase === GamePhase.Playing) {
    game.state.phase = GamePhase.Paused;
    return;
  }
  if (e.key === 'Enter') {
    if (game.state.phase === GamePhase.Dead) {
      game.loadLevel(game.state.currentLevel - 1);
      syncTheme();
    } else if (game.state.phase === GamePhase.LevelComplete) {
      if (!game.loadLevel(game.state.currentLevel)) {
        game.state.phase = GamePhase.Victory;
      } else {
        syncTheme();
      }
    } else if (game.state.phase === GamePhase.GameOver || game.state.phase === GamePhase.Victory) {
      if (!hasSubmittedThisRun) {
        showScoreSubmit();
      } else {
        hasSubmittedThisRun = false;
        game.restart();
        syncTheme();
      }
    }
  }
});

loop.start();

// Start music on first user interaction (browser autoplay policy)
let musicStarted = false;
function startMusicOnInteraction(): void {
  if (musicStarted) return;
  musicStarted = true;
  if (musicEnabled) musicStart();
  document.removeEventListener('click', startMusicOnInteraction);
  document.removeEventListener('keydown', startMusicOnInteraction);
}
document.addEventListener('click', startMusicOnInteraction);
document.addEventListener('keydown', startMusicOnInteraction);

if (isDevHost) {
  // Debug export for playtesting
  (window as any).__game = game;
  (window as any).__syncTheme = syncTheme;
}
