import { GameManager } from '@/game/GameManager';
import { GameLoop } from '@/engine/GameLoop';
import { Renderer } from '@/engine/Renderer';
import { InputManager } from '@/engine/Input';
import { loadPlayerSprites, loadDuckSprites } from '@/engine/SpriteSheet';
import { GamePhase } from '@/types';
import { getTheme } from '@/engine/Themes';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, COLORS, DISPLAY_SCALE, RENDER_SCALE } from '@/constants';
// Audio disabled — needs proper sound design
// import { resumeAudio, sfxDig, sfxCollect, sfxTrap, sfxKill, sfxDeath, sfxLFV, sfxLevelComplete, sfxVibestr, sfxRevealLadders } from '@/engine/Audio';

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
  const appliedScale = Math.max(scale, 1);

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

// SFX disabled — needs proper sound design
// game.onDig = sfxDig;
// game.onCollect = sfxCollect;
// game.onTrap = sfxTrap;
// game.onKill = sfxKill;
// game.onDeath = sfxDeath;
// game.onLFV = sfxLFV;
// game.onLevelComplete = sfxLevelComplete;
// game.onVibestr = sfxVibestr;
// game.onRevealLadders = sfxRevealLadders;

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


let lastDt = 0;
let playerRenderPos = game.getPlayerRenderPos();
const loop = new GameLoop(
  (dt) => {
    lastDt = dt;
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
    const usingLadder = isPlaying && game.state.player.isOnLadder && !usingRope;

    renderer.playerUsingRope = usingRope;
    renderer.playerUsingLadder = usingLadder;
    renderer.playerClimbing = usingLadder && movingVertically;
    renderer.playerMoving = isPlaying && !usingLadder && !usingRope && movingHorizontally;
    renderer.playerFacing = game.state.player.facing;
    renderer.playerDigging = isPlaying && game.state.player.isDigging;
    renderer.updateAnimation(dt);

    input.endFrame();
  },
  () => {
    renderer.setWeather(game.state.weather);
    renderer.clear(lastDt);
    renderer.drawGrid(game.state.grid);
    renderer.drawHoles(game.state.holes);
    renderer.drawWeather();

    // Draw $VIBESTR drops
    for (const drop of game.drops) {
      const px = drop.pos.x * TILE_SIZE + TILE_SIZE / 2;
      const py = drop.pos.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillStyle = COLORS.vibestrGold;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.black;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', px, py);
    }

    // Draw ducks (with smooth interpolation)
    for (const duck of game.state.ducks) {
      const renderPos = duck.isTrapped ? duck.pos : game.getDuckRenderPos(duck.id);
      renderer.drawDuck(renderPos, duck.isTrapped, duck.facing, duck.isOnLadder);
    }

    // Draw player
    renderer.drawPlayer(playerRenderPos, game.state.player.isLFV);

    // Duck kill confetti
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
    if (game.state.phase === GamePhase.Menu) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const cx = CANVAS_WIDTH / 2;
      const cy = CANVAS_HEIGHT / 2;

      ctx.fillStyle = COLORS.vibestrGold;
      ctx.font = "900 44px 'Brice', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VIBETOWN RUNNER', cx, cy - 100);

      ctx.fillStyle = COLORS.cream;
      ctx.font = "bold 14px 'Brice', sans-serif";
      ctx.fillText('HOW TO PLAY', cx, cy - 40);

      ctx.font = "13px 'Brice', sans-serif";
      ctx.fillStyle = '#C0C0C0';
      ctx.fillText('Arrow Keys — Move & Climb', cx, cy - 10);
      ctx.fillText('Z — Dig Left    C — Dig Right', cx, cy + 15);
      ctx.fillText('SPACE — Activate LFV Mode', cx, cy + 40);
      ctx.fillText('Collect all money bags to reveal the escape ladder', cx, cy + 70);
      ctx.fillText('Climb to the top to complete the level', cx, cy + 90);

      ctx.fillStyle = COLORS.vibestrGold;
      ctx.font = "bold 18px 'Brice', sans-serif";
      ctx.fillText('Press ENTER to start', cx, cy + 140);
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
    }
  }
);

// Handle state transitions (retry / next level)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (game.state.phase === GamePhase.Menu) {
      game.startGame();
    } else if (game.state.phase === GamePhase.Dead) {
      game.loadLevel(game.state.currentLevel - 1);
      syncTheme();
    } else if (game.state.phase === GamePhase.LevelComplete) {
      if (!game.loadLevel(game.state.currentLevel)) {
        game.state.phase = GamePhase.Victory;
      } else {
        syncTheme();
      }
    } else if (game.state.phase === GamePhase.GameOver || game.state.phase === GamePhase.Victory) {
      game.restart();
      syncTheme();
    }
  }
});

loop.start();

if (isDevHost) {
  // Debug export for playtesting
  (window as any).__game = game;
  (window as any).__syncTheme = syncTheme;
}
