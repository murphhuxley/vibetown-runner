import { TileType, Position, Direction, WeatherType, Hole } from '@/types';
import { VibeMeterState } from '@/game/VibeMeter';
import { ConfettiPiece } from '@/game/Confetti';
import { getWeatherEffects, WeatherEffects } from '@/game/Weather';
import { SpriteSet, DuckSprites, drawFrame } from '@/engine/SpriteSheet';
import { LevelTheme, getTheme } from '@/engine/Themes';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, CANVAS_WIDTH, COLORS, VIBE_MAX, HOLE_OPEN_ANIM, HOLE_CLOSE_ANIM } from '@/constants';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private theme: LevelTheme = getTheme('beach');
  private sandTile: HTMLImageElement | null = null;
  private coralTile: HTMLImageElement | null = null;
  private badgeSprite: HTMLImageElement | null = null;
  sprites: SpriteSet | null = null;
  duckSprites: DuckSprites | null = null;
  private animFrame = 0;
  private animAccum = 0;
  private animState: 'run-left' | 'run-right' | 'climb' | 'rope' | null = null;
  private readonly ANIM_FRAME_MS = 80;
  private readonly ROPE_LINE_OFFSET_Y = 13;
  private readonly ROPE_HAND_ANCHOR_Y = 6;
  private readonly BADGE_SCALE = 0.72;
  private readonly PLAYER_SCALE = 1;
  private bgTime = 0;
  private weather: WeatherType = WeatherType.None;
  private weatherEffects: WeatherEffects = getWeatherEffects(WeatherType.None);

  // Snapshot of player visual state, set once per frame in update
  playerMoving = false;
  playerFacing: Direction = Direction.Right;
  playerUsingLadder = false;
  playerClimbing = false;
  playerUsingRope = false;
  playerDigging = false;

  private pixelCanvas: HTMLCanvasElement;
  private pixelCtx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    const badgeImg = new Image();
    badgeImg.onload = () => { this.badgeSprite = badgeImg; };
    badgeImg.src = '/assets/sprites/badge.png';

    // Offscreen canvas for pixelated text rendering
    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d')!;
  }

  /** Draw text with a chunky pixel-art feel by rendering small then scaling up */
  private drawPixelText(
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'left',
    scale = 2,
  ): void {
    const pc = this.pixelCtx;
    const pCanvas = this.pixelCanvas;

    // Render at 1/scale size
    const smallFont = font.replace(/(\d+)px/, (_, sz) => `${Math.ceil(Number(sz) / scale)}px`);
    pc.font = smallFont;
    const metrics = pc.measureText(text);
    const textW = Math.ceil(metrics.width) + 4;
    const fontSize = parseInt(font.match(/(\d+)px/)?.[1] ?? '14');
    const textH = Math.ceil(fontSize / scale) + 4;

    pCanvas.width = textW;
    pCanvas.height = textH;
    pc.font = smallFont;
    pc.fillStyle = color;
    pc.textAlign = 'left';
    pc.textBaseline = 'middle';
    pc.imageSmoothingEnabled = false;
    pc.clearRect(0, 0, textW, textH);
    pc.fillText(text, 2, textH / 2);

    // Draw scaled up with nearest-neighbor
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const drawW = textW * scale;
    const drawH = textH * scale;
    let drawX = x;
    if (align === 'center') drawX = x - drawW / 2;
    else if (align === 'right') drawX = x - drawW;

    ctx.drawImage(pCanvas, 0, 0, textW, textH, drawX, y - drawH / 2, drawW, drawH);
  }

  setTheme(theme: LevelTheme, themeKey: string): void {
    this.theme = theme;
    this.sandTile = null;
    this.coralTile = null;
    this.loadTileSprites(themeKey);
  }

  setWeather(weather: WeatherType): void {
    if (this.weather === weather) return;
    this.weather = weather;
    this.weatherEffects = getWeatherEffects(weather);
  }

  private loadTileSprites(themeKey: string): void {
    const base = '/assets/tiles/';
    const tryLoad = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    tryLoad(base + themeKey + '-sand.png').then(img => { this.sandTile = img; });
    tryLoad(base + themeKey + '-coral.png').then(img => { this.coralTile = img; });
  }

  updateAnimation(dt: number): void {
    if (!this.playerMoving && !this.playerClimbing && !this.playerUsingRope) {
      this.animAccum = 0;
      this.animFrame = 0;
      this.animState = null;
      return;
    }

    const nextAnimState = this.playerUsingRope
      ? 'rope'
      : this.playerClimbing
      ? 'climb'
      : (this.playerFacing === Direction.Left ? 'run-left' : 'run-right');
    if (this.animState !== nextAnimState) {
      this.animAccum = 0;
      this.animFrame = 0;
      this.animState = nextAnimState;
    }

    this.animAccum += dt;
    if (this.animAccum >= this.ANIM_FRAME_MS) {
      this.animAccum -= this.ANIM_FRAME_MS;
      this.animFrame++;
    }
  }

  clear(dt: number): void {
    const ctx = this.ctx;
    const W = CANVAS_WIDTH;
    const H = GRID_ROWS * TILE_SIZE;
    const t = (this.bgTime += dt * 0.001);
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.max(W, H);
    const style = this.theme.animStyle;

    let x1: number, y1: number, x2: number, y2: number;
    let c1 = this.theme.bgTop;
    let c2 = this.theme.bgBottom;

    switch (style) {
      case 'wave': {
        const angle = Math.sin(t * 1.5) * 0.3;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      case 'drift': {
        const drift = t * 0.25;
        x1 = cx; y1 = -r + (drift * H * 2) % (r * 2);
        x2 = cx; y2 = y1 + r * 2;
        break;
      }
      case 'rainbow': {
        const hue1 = (t * 80) % 360;
        const hue2 = (hue1 + 120) % 360;
        c1 = `hsl(${hue1}, 70%, 65%)`;
        c2 = `hsl(${hue2}, 70%, 65%)`;
        const angle = t * 0.2;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      case 'pulse': {
        const pulse = Math.sin(t * 2.0) * 0.15 + 0.85;
        ctx.globalAlpha = pulse;
        const angle = t * 0.15;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      case 'bloom': {
        const bloomR = r * (0.6 + Math.sin(t * 1.8) * 0.3);
        const bx = cx + Math.sin(t * 0.9) * W * 0.15;
        const by = cy + Math.cos(t * 0.6) * H * 0.15;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, bloomR);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        return;
      }
      case 'sweep': {
        const angle = t * 1.5;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      case 'shimmer': {
        const angle = t * 0.3;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      case 'cosmic': {
        const angle = t * 0.25;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
      default: {
        const angle = t * 0.45;
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx - Math.cos(angle) * r; y2 = cy - Math.sin(angle) * r;
        break;
      }
    }

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Shimmer: golden twinkling particles
    if (style === 'shimmer') {
      ctx.save();
      for (let i = 0; i < 12; i++) {
        const px = ((i * 137 + t * 40) % W);
        const py = ((i * 97 + t * 25) % H);
        const alpha = (Math.sin(t * 2 + i * 1.7) + 1) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFE080';
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Cosmic: twinkling star dots
    if (style === 'cosmic') {
      ctx.save();
      for (let i = 0; i < 20; i++) {
        const px = (i * 173 + 31) % W;
        const py = (i * 119 + 17) % H;
        const alpha = (Math.sin(t * 1.5 + i * 2.3) + 1) * 0.35;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Drifting radial glow
    {
      const glowX = cx + Math.sin(t * 0.4) * W * 0.4;
      const glowY = cy + Math.cos(t * 0.25) * H * 0.3;
      const grad2 = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, r * 0.5);
      grad2.addColorStop(0, c2 + '30');
      grad2.addColorStop(0.5, c1 + '15');
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawWeather(): void {
    const ctx = this.ctx;
    const gridH = GRID_ROWS * TILE_SIZE;
    const effects = this.weatherEffects;

    if (effects.floodRows > 0) {
      const floodHeight = effects.floodRows * TILE_SIZE;
      const floodTop = gridH - floodHeight;
      const flood = ctx.createLinearGradient(0, floodTop, 0, gridH);
      flood.addColorStop(0, 'rgba(124, 202, 255, 0.18)');
      flood.addColorStop(1, 'rgba(38, 112, 170, 0.38)');
      ctx.fillStyle = flood;
      ctx.fillRect(0, floodTop, CANVAS_WIDTH, floodHeight);
    }

    switch (effects.particleType) {
      case 'rain':
        ctx.save();
        ctx.strokeStyle = 'rgba(224, 244, 255, 0.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
          const x = ((i * 73 + this.bgTime * 240) % (CANVAS_WIDTH + 80)) - 40;
          const y = ((i * 47 + this.bgTime * 520) % (gridH + 50)) - 50;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 8, y + 22);
          ctx.stroke();
        }
        ctx.restore();
        break;
      case 'wind':
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const baseX = ((i * 97 + this.bgTime * 160) % (CANVAS_WIDTH + 120)) - 60;
          const baseY = 70 + i * 46;
          ctx.beginPath();
          ctx.moveTo(baseX, baseY);
          ctx.bezierCurveTo(baseX + 18, baseY - 6, baseX + 34, baseY + 6, baseX + 54, baseY);
          ctx.stroke();
        }
        ctx.restore();
        break;
      case 'sunshine':
        ctx.save();
        const glow = ctx.createRadialGradient(120, 90, 10, 120, 90, 220);
        glow.addColorStop(0, 'rgba(255, 248, 196, 0.28)');
        glow.addColorStop(1, 'rgba(255, 248, 196, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(120, 90, 220, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let i = 0; i < 3; i++) {
          const beamX = 120 + i * 90 + Math.sin(this.bgTime + i) * 12;
          ctx.beginPath();
          ctx.moveTo(beamX, 0);
          ctx.lineTo(beamX + 40, 0);
          ctx.lineTo(beamX - 20, gridH);
          ctx.lineTo(beamX - 60, gridH);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      default:
        break;
    }
  }

  drawGrid(grid: TileType[][]): void {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        switch (tile) {
          case TileType.Sand:
          case TileType.TrapSand:
            this.drawSand(px, py);
            break;
          case TileType.Coral:
            this.drawCoral(px, py);
            break;
          case TileType.Ladder:
            this.drawLadder(px, py);
            break;
          case TileType.Rope:
            this.drawRope(px, py);
            break;
          case TileType.Badge:
            this.drawBadge(px, py);
            break;
          case TileType.HiddenLadder:
          case TileType.Empty:
          case TileType.PlayerSpawn:
          case TileType.DuckSpawn:
            // Draw nothing
            break;
        }
      }
    }
  }

  private drawSand(px: number, py: number): void {
    if (this.sandTile) {
      this.ctx.drawImage(this.sandTile, px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    const ctx = this.ctx;
    const t = this.theme;
    const S = TILE_SIZE;

    ctx.fillStyle = t.sandFill;
    ctx.fillRect(px, py, S, S);

    // 4-wide × 3-tall brick mortar pattern (classic Lode Runner style)
    ctx.strokeStyle = t.sandLine;
    ctx.lineWidth = 1;

    // 3 horizontal mortar lines (creating 3 rows of bricks)
    const rowH = S / 3;
    for (let r = 1; r <= 2; r++) {
      const ly = py + Math.round(rowH * r);
      ctx.beginPath();
      ctx.moveTo(px, ly);
      ctx.lineTo(px + S, ly);
      ctx.stroke();
    }

    // Vertical mortar lines — staggered per row
    const brickW = S / 4;
    for (let r = 0; r < 3; r++) {
      const ry = py + Math.round(rowH * r);
      const rh = Math.round(rowH);
      const offset = (r % 2 === 0) ? 0 : brickW / 2;
      for (let c = 1; c <= 3; c++) {
        const lx = px + Math.round(offset + brickW * c);
        if (lx > px && lx < px + S) {
          ctx.beginPath();
          ctx.moveTo(lx, ry);
          ctx.lineTo(lx, ry + rh);
          ctx.stroke();
        }
      }
    }

    // Subtle highlight on top edge of each brick row
    ctx.fillStyle = t.sandHighlight;
    ctx.fillRect(px, py, S, 1);
    ctx.fillRect(px, py + Math.round(rowH), S, 1);
    ctx.fillRect(px, py + Math.round(rowH * 2), S, 1);

    // Bottom shadow
    ctx.fillStyle = t.sandShadow;
    ctx.fillRect(px, py + S - 1, S, 1);
  }

  private drawCoral(px: number, py: number): void {
    if (this.coralTile) {
      this.ctx.drawImage(this.coralTile, px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    const ctx = this.ctx;
    const t = this.theme;
    const S = TILE_SIZE;

    // Solid fill — visually distinct from sand (no mortar pattern)
    ctx.fillStyle = t.coralFill;
    ctx.fillRect(px, py, S, S);

    // Subtle horizontal score lines for texture (not brick mortar — this is solid/indestructible)
    ctx.strokeStyle = t.coralShadow;
    ctx.lineWidth = 1;
    const rowH = S / 3;
    for (let r = 1; r <= 2; r++) {
      const ly = py + Math.round(rowH * r);
      ctx.beginPath();
      ctx.moveTo(px, ly);
      ctx.lineTo(px + S, ly);
      ctx.stroke();
    }

    // Top highlight
    ctx.fillStyle = t.coralHighlight;
    ctx.fillRect(px, py, S, 1);

    // Bottom shadow
    ctx.fillStyle = t.coralShadow;
    ctx.fillRect(px, py + S - 1, S, 1);
  }

  private drawLadder(px: number, py: number): void {
    const ctx = this.ctx;
    const color = this.theme.ladder;
    const S = TILE_SIZE;

    // Dark outline for contrast against any background
    const railW = 4;
    const rungH = 3;
    const railL = px + 5;
    const railR = px + S - 5 - railW;

    // Shadow/outline layer
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(railL + 1, py + 1, railW, S);
    ctx.fillRect(railR + 1, py + 1, railW, S);

    // Two solid vertical rails
    ctx.fillStyle = color;
    ctx.fillRect(railL, py, railW, S);
    ctx.fillRect(railR, py, railW, S);

    // 4 horizontal rungs (evenly spaced)
    const rungCount = 4;
    for (let i = 1; i <= rungCount; i++) {
      const ry = py + Math.round((S / (rungCount + 1)) * i) - 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(railL + 1, ry + 1, railR + railW - railL, rungH);
      ctx.fillStyle = color;
      ctx.fillRect(railL, ry, railR + railW - railL, rungH);
    }
  }

  private drawRope(px: number, py: number): void {
    const ctx = this.ctx;
    const color = this.theme.rope;
    const midY = py + this.ROPE_LINE_OFFSET_Y;
    const startX = px;
    const endX = px + TILE_SIZE;
    const ropeH = 6;
    const top = midY - ropeH / 2;

    // Dark shadow for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(startX, top + 2, TILE_SIZE, ropeH);

    // Main rope body
    ctx.fillStyle = color;
    ctx.fillRect(startX, top, TILE_SIZE, ropeH);

    // Top highlight (lighter)
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(startX, top, TILE_SIZE, 2);

    // Bottom shadow edge (darker)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(startX, top + ropeH - 1, TILE_SIZE, 1);

    // Rope texture — vertical hash marks every 6px for a twisted rope look
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = startX + 3; x < endX; x += 6) {
      ctx.fillRect(x, top + 1, 1, ropeH - 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let x = startX + 5; x < endX; x += 6) {
      ctx.fillRect(x, top + 1, 1, ropeH - 2);
    }
  }

  drawHoles(holes: Hole[]): void {
    for (const hole of holes) {
      const px = hole.x * TILE_SIZE;
      const py = hole.y * TILE_SIZE;

      if (hole.phase === 'opening') {
        const progress = 1 - hole.timer / HOLE_OPEN_ANIM;
        this.drawOpeningHole(px, py, progress, hole.direction);
        continue;
      }

      const closingProgress = hole.phase === 'closing'
        ? 1 - hole.timer / HOLE_CLOSE_ANIM
        : 0;
      this.drawOpenHole(px, py, closingProgress);
    }
  }

  private drawOpeningHole(
    px: number,
    py: number,
    progress: number,
    direction: Direction.Left | Direction.Right
  ): void {
    const ctx = this.ctx;
    const frame = Math.min(6, Math.max(0, Math.floor(progress * 7)));
    const cavityShapes = [
      [[4, 3], [6, 4], [5, 7], [4, 7]],
      [[4, 3], [8, 4], [10, 8], [7, 12], [4, 10]],
      [[4, 3], [11, 4], [13, 11], [10, 17], [6, 16], [4, 12]],
      [[4, 3], [13, 4], [17, 14], [15, 22], [10, 23], [6, 19], [4, 14]],
      [[4, 3], [16, 5], [21, 17], [20, 27], [13, 29], [8, 26], [5, 20], [4, 15]],
      [[4, 3], [18, 5], [24, 20], [24, 32], [15, 32], [10, 30], [6, 25], [4, 18]],
      [[4, 3], [21, 6], [27, 22], [27, 32], [16, 32], [11, 32], [6, 28], [4, 20]],
    ] as const;
    const burstAnchors = [
      { x: 5, y: -2, scale: 0.45 },
      { x: 6, y: -2, scale: 0.6 },
      { x: 7, y: -1, scale: 0.8 },
      { x: 8, y: -1, scale: 1.0 },
      { x: 8, y: 0, scale: 0.95 },
      { x: 9, y: 0, scale: 0.8 },
      { x: 9, y: 1, scale: 0.6 },
    ] as const;
    const speckSets = [
      [[4, -6], [8, -8]],
      [[2, -7], [6, -10], [10, -6]],
      [[1, -8], [5, -12], [8, -15], [12, -8]],
      [[0, -8], [4, -13], [8, -16], [11, -11], [14, -7]],
      [[1, -9], [5, -13], [8, -17], [12, -12], [15, -8]],
      [[3, -8], [7, -11], [11, -9]],
      [[6, -7], [10, -8]],
    ] as const;
    const burstDir = direction === Direction.Left ? 1 : -1;
    const mapX = (x: number): number => (
      direction === Direction.Left
        ? px + TILE_SIZE - x
        : px + x
    );

    const shape = cavityShapes[frame];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(mapX(shape[0][0]), py + shape[0][1]);
    for (const [x, y] of shape.slice(1)) {
      ctx.lineTo(mapX(x), py + y);
    }
    ctx.lineTo(mapX(4), py + TILE_SIZE);
    ctx.lineTo(mapX(4), py + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Fiery brick chunk debris — ember-colored pieces with gravity arc
    const t = progress;
    const fireColors = ['#FF4020', '#FF8020', '#FFD040', '#FFF080'];
    for (let i = 0; i < speckSets[frame].length; i++) {
      const [sx, sy] = speckSets[frame][i];
      const gravity = t * t * 20;
      const drift = (sx - 6) * t * 2;
      const finalX = mapX(sx) + drift;
      const finalY = py + sy - (1 - t) * 8 + gravity;
      const alpha = Math.max(0, 1 - t * 0.5);
      const size = 3 + Math.floor((1 - t) * 2);
      // Hot core (yellow/white) fading to orange/red as it cools
      const colorIdx = Math.min(fireColors.length - 1, Math.floor(t * fireColors.length));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fireColors[fireColors.length - 1 - colorIdx];
      ctx.fillRect(Math.round(finalX), Math.round(finalY), size, size);
      ctx.fillStyle = fireColors[Math.min(colorIdx + 1, fireColors.length - 1)];
      ctx.fillRect(Math.round(finalX) + 1, Math.round(finalY) + 1, size - 1, size - 1);
      // Tiny ember glow around each chunk
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = '#FF6030';
      ctx.fillRect(Math.round(finalX) - 1, Math.round(finalY) - 1, size + 2, size + 2);
    }
    ctx.globalAlpha = 1;

    const burst = burstAnchors[frame];
    ctx.save();
    ctx.translate(mapX(burst.x), py + burst.y);
    ctx.scale(burstDir * burst.scale, burst.scale);
    ctx.fillStyle = '#FFD040';
    ctx.strokeStyle = '#FF6020';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.lineTo(-4, -1);
    ctx.lineTo(-2, 2);
    ctx.lineTo(0, -5);
    ctx.lineTo(2, 1);
    ctx.lineTo(5, -6);
    ctx.lineTo(3, -9);
    ctx.lineTo(0, -7);
    ctx.lineTo(-2, -10);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawOpenHole(px: number, py: number, closingProgress: number): void {
    const ctx = this.ctx;
    if (closingProgress <= 0) return;

    const left = px + 4;
    const width = TILE_SIZE - 8;
    const height = TILE_SIZE - 6;
    const fillHeight = Math.max(3, Math.floor(height * closingProgress));
    const fillTop = py + TILE_SIZE - fillHeight;
    const segmentW = Math.max(3, Math.floor(width / 4));
    const lipDepths = [1, 3, 0, 2].map((depth) => Math.floor(depth * (1 - closingProgress)));

    ctx.fillStyle = this.theme.sandFill;
    ctx.beginPath();
    ctx.moveTo(left, py + TILE_SIZE);
    ctx.lineTo(left, fillTop + lipDepths[0]);
    ctx.lineTo(left + segmentW, fillTop + lipDepths[1]);
    ctx.lineTo(left + segmentW * 2, fillTop + lipDepths[2]);
    ctx.lineTo(left + segmentW * 3, fillTop + lipDepths[3]);
    ctx.lineTo(left + width, fillTop + lipDepths[1]);
    ctx.lineTo(left + width, py + TILE_SIZE);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.theme.sandHighlight;
    ctx.fillRect(left, fillTop + Math.min(...lipDepths), width, 1);
  }

  private drawBadge(px: number, py: number): void {
    const badgeSize = Math.floor(TILE_SIZE * this.BADGE_SCALE);
    const badgeOffset = Math.floor((TILE_SIZE - badgeSize) / 2);
    if (this.badgeSprite) {
      this.ctx.drawImage(this.badgeSprite, px + badgeOffset, py + badgeOffset, badgeSize, badgeSize);
      return;
    }

    // Fallback: gold circle with "B"
    const ctx = this.ctx;
    const t = this.theme;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    const radius = badgeSize / 2.4;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = t.badgeGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = t.badgeFill;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = t.badgeText;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', cx, cy + 1);
  }

  drawPlayer(pos: Position, isLFV: boolean): void {
    const ctx = this.ctx;
    const px = pos.x * TILE_SIZE;
    const py = pos.y * TILE_SIZE;
    const isMoving = this.playerMoving;
    const isUsingLadder = this.playerUsingLadder;
    const isClimbing = this.playerClimbing;
    const isUsingRope = this.playerUsingRope;
    const facing = this.playerFacing;

    if (this.sprites) {
      // LFV glow effect
      if (isLFV) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = COLORS.vibestrGold;
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Pick the correct pre-mirrored strip or idle sprite
      const isDigging = this.playerDigging;
      const anim = isDigging
        ? (facing === Direction.Left ? this.sprites.digLeft : this.sprites.digRight)
        : isUsingLadder
        ? this.sprites.climb
        : isUsingRope
        ? this.sprites.rope
        : isMoving
        ? (facing === Direction.Left ? this.sprites.runLeft : this.sprites.runRight)
        : this.sprites.idle;
      const frameIndex = (isMoving || isClimbing || isUsingRope) ? this.animFrame : 0;
      const drawWidth = Math.floor(anim.frameWidth * this.PLAYER_SCALE);
      const drawHeight = Math.floor(anim.frameHeight * this.PLAYER_SCALE);
      const offsetY = TILE_SIZE - drawHeight;
      const offsetX = (TILE_SIZE - drawWidth) / 2;
      const drawX = Math.max(0, Math.min(px + offsetX, CANVAS_WIDTH - drawWidth));
      const drawY = Math.max(
        0,
        isUsingRope
          ? py + this.ROPE_LINE_OFFSET_Y - this.ROPE_HAND_ANCHOR_Y
          : py + offsetY
      );
      const fi = frameIndex % anim.frameCount;
      const sourceFrameWidth = anim.sourceFrameWidth ?? anim.frameWidth;
      const sourceFrameHeight = anim.sourceFrameHeight ?? anim.frameHeight;
      ctx.drawImage(
        anim.image,
        fi * sourceFrameWidth,
        0,
        sourceFrameWidth,
        sourceFrameHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
      return;
    }

    // Fallback: colored rectangles
    ctx.fillStyle = isLFV ? COLORS.vibestrGold : COLORS.oceanBlue;
    ctx.fillRect(px + 6, py + 10, TILE_SIZE - 12, TILE_SIZE - 10);
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawDuck(pos: Position, isTrapped: boolean, facing: Direction, isOnLadder = false): void {
    const ctx = this.ctx;
    const px = pos.x * TILE_SIZE;
    const py = pos.y * TILE_SIZE;

    if (this.duckSprites) {
      let img: HTMLImageElement;
      if (isTrapped) {
        img = this.duckSprites.front;
      } else if (isOnLadder) {
        img = this.duckSprites.back;
      } else {
        img = facing === Direction.Left ? this.duckSprites.left : this.duckSprites.right;
      }
      ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    // Fallback
    ctx.fillStyle = isTrapped ? COLORS.darkSand : COLORS.vibestrGold;
    ctx.fillRect(px + 4, py + 8, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.fillStyle = '#E87B35';
    ctx.fillRect(px + TILE_SIZE - 6, py + 12, 6, 4);
  }

  drawConfetti(pieces: ConfettiPiece[]): void {
    const ctx = this.ctx;

    for (const piece of pieces) {
      const alpha = Math.max(piece.life / piece.maxLife, 0);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.7);
      ctx.restore();
    }
  }

  drawHUD(
    score: number,
    lives: number,
    level: number,
    vibeMeter: VibeMeterState,
    vibestr: number
  ): void {
    const ctx = this.ctx;
    const hudY = GRID_ROWS * TILE_SIZE;

    // Black bar background
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, hudY, CANVAS_WIDTH, TILE_SIZE);

    const midY = hudY + TILE_SIZE / 2;
    const hudFont = "bold 16px 'Brice', sans-serif";

    const ps = 1.4;
    this.drawPixelText(`SCORE: ${score}`, 10, midY, hudFont, COLORS.cream, 'left', ps);
    this.drawPixelText(`LIVES: ${lives}`, 180, midY, hudFont, COLORS.cream, 'left', ps);
    this.drawPixelText(`LVL: ${level}`, 300, midY, hudFont, COLORS.cream, 'left', ps);
    this.drawPixelText(`$VIBESTR: ${vibestr}`, 390, midY, hudFont, COLORS.vibestrGold, 'left', ps);

    // Vibe meter progress bar
    const barX = 560;
    const barW = 150;
    const barH = 14;
    const barY = hudY + (TILE_SIZE - barH) / 2;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    // Fill
    const fillRatio = vibeMeter.meter / VIBE_MAX;
    const isReady = vibeMeter.meter >= VIBE_MAX;
    const isActive = vibeMeter.lfvTimer > 0;
    ctx.fillStyle = isReady || isActive ? COLORS.vibestrGold : COLORS.palmGreen;
    ctx.fillRect(barX, barY, barW * fillRatio, barH);

    // Border
    ctx.strokeStyle = COLORS.cream;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Label
    const vibeFont = "bold 12px 'Brice', sans-serif";
    if (isActive) {
      this.drawPixelText('LFV!', barX + barW / 2, midY, vibeFont, COLORS.vibestrGold, 'center', ps);
    } else if (isReady) {
      this.drawPixelText('LFV READY!', barX + barW / 2, midY, vibeFont, COLORS.vibestrGold, 'center', ps);
    } else {
      this.drawPixelText('VIBE', barX + barW / 2, midY, vibeFont, COLORS.cream, 'center', ps);
    }
  }
}
