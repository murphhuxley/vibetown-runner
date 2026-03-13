import { GameManager } from '@/game/GameManager';
import { GameLoop } from '@/engine/GameLoop';
import { Renderer } from '@/engine/Renderer';
import { InputManager } from '@/engine/Input';
import { GamePhase } from '@/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, COLORS } from '@/constants';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const input = new InputManager();
input.bind();

const game = new GameManager(input);
const renderer = new Renderer(ctx);

const loop = new GameLoop(
  (dt) => {
    game.update(dt);
    input.endFrame();
  },
  () => {
    renderer.clear();
    renderer.drawGrid(game.state.grid);

    // Draw $VIBESTR drops
    for (const drop of game.drops) {
      const px = drop.pos.x * TILE_SIZE + TILE_SIZE / 2;
      const py = drop.pos.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillStyle = COLORS.vibestrGold;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.black;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', px, py);
    }

    // Draw ducks
    for (const duck of game.state.ducks) {
      renderer.drawDuck(duck.pos, duck.isTrapped);
    }

    // Draw player
    renderer.drawPlayer(game.state.player.pos, game.state.player.isLFV);

    // Draw HUD
    renderer.drawHUD(
      game.state.score,
      game.state.lives,
      game.state.currentLevel,
      game.vibeMeter,
      game.state.vibestr
    );

    // Phase overlays
    if (game.state.phase === GamePhase.Dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.cream;
      ctx.font = '32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAD VIBES...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = '16px monospace';
      ctx.fillText('Press ENTER to retry', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }

    if (game.state.phase === GamePhase.LevelComplete) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.vibestrGold;
      ctx.font = '32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LETS FREAKING VIBE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = COLORS.cream;
      ctx.fillText('Press ENTER for next level', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }

    if (game.state.phase === GamePhase.GameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = COLORS.coral;
      ctx.font = '40px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = COLORS.cream;
      ctx.fillText(`Final Score: ${game.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }
  }
);

// Handle state transitions (retry / next level)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (game.state.phase === GamePhase.Dead) {
      game.loadLevel(game.state.currentLevel - 1);
    } else if (game.state.phase === GamePhase.LevelComplete) {
      game.loadLevel(game.state.currentLevel); // next level index
    }
  }
});

loop.start();
