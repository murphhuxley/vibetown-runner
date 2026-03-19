import { TileType, Position, Direction, WeatherType, Hole, ProjectileState } from '@/types';
import { VibeMeterState } from '@/game/VibeMeter';
import { DuckDeathEffect, DUCK_DEATH_FRAME_MS } from '@/game/DuckDeath';
import { ConfettiPiece } from '@/game/Confetti';
import { getWeatherEffects, WeatherEffects } from '@/game/Weather';
import { SpriteSet, DuckSprites, drawFrame } from '@/engine/SpriteSheet';
import { LevelTheme, getTheme } from '@/engine/Themes';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, CANVAS_WIDTH, COLORS, VIBE_MAX, HOLE_OPEN_ANIM, HOLE_CLOSE_ANIM } from '@/constants';

/** Shift a hex color's hue by a given number of degrees */
function shiftColor(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // RGB to HSL
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }

  // Shift hue
  h = ((h * 360 + degrees) % 360 + 360) % 360 / 360;

  // HSL to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let ro: number, go: number, bo: number;
  if (s === 0) {
    ro = go = bo = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    ro = hue2rgb(p, q, h + 1/3);
    go = hue2rgb(p, q, h);
    bo = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(ro)}${toHex(go)}${toHex(bo)}`;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private theme: LevelTheme = getTheme('beach');
  private sandTile: HTMLImageElement | null = null;
  private coralTile: HTMLImageElement | null = null;
  private ladderTile: HTMLImageElement | null = null;
  private ropeTile: HTMLImageElement | null = null;
  private bgImage: HTMLImageElement | null = null;
  private badgeSprite: HTMLImageElement | null = null;
  private shakaSprites: HTMLImageElement[] = [];
  private badgeFrameCount = 1;
  private badgeSourceFrameWidth = 64;
  sprites: SpriteSet | null = null;
  duckSprites: DuckSprites | null = null;
  private animFrame = 0;
  private animAccum = 0;
  private animState: 'run-left' | 'run-right' | 'climb' | 'rope' | 'idle' | 'dig-left' | 'dig-right' | null = null;
  private readonly RUN_FRAME_MS = 80;
  private readonly CLIMB_FRAME_MS = 90;
  private readonly ROPE_FRAME_MS = 90;
  private readonly IDLE_FRAME_MS = 160;
  private readonly POWER_IDLE_FRAME_MS = 220;
  private readonly DIG_FRAME_MS = 58;
  private readonly WORLD_PIXEL = 1;
  private readonly ROPE_LINE_OFFSET_Y = 13;
  private readonly ROPE_HAND_ANCHOR_Y = 6;
  private readonly BADGE_SCALE = 0.9;
  private readonly DROP_SCALE = 0.9;
  private readonly PLAYER_SCALE = 1;
  private readonly DUCK_SCALE = 1.1;
  private readonly BASE_TILE_SIZE = 32;
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
  playerIdling = false;
  playerPowerActive = false;

  private pixelCanvas: HTMLCanvasElement;
  private pixelCtx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    const badgeImg = new Image();
    badgeImg.onload = () => {
      this.badgeSprite = badgeImg;
      const frameCount = Math.max(1, Math.round(badgeImg.naturalWidth / badgeImg.naturalHeight));
      this.badgeFrameCount = frameCount;
      this.badgeSourceFrameWidth = Math.floor(badgeImg.naturalWidth / frameCount);
    };
    badgeImg.src = '/assets/sprites/money-bag.png?v=money-bag-v2';

    const shakaNames = ['purple', 'red', 'yellow', 'mint', 'pink', 'blue'];
    for (const name of shakaNames) {
      const img = new Image();
      img.src = `/assets/sprites/shaka-${name}.png`;
      this.shakaSprites.push(img);
    }

    // Offscreen canvas for pixelated text rendering
    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d')!;
  }

  private scaleToTile(value: number): number {
    const scaled = Math.round((value * TILE_SIZE) / this.BASE_TILE_SIZE);
    if (scaled === 0 && value !== 0) {
      return value > 0 ? 1 : -1;
    }
    return scaled;
  }

  private withSpriteSmoothing(draw: () => void): void {
    const prevEnabled = this.ctx.imageSmoothingEnabled;
    const prevQuality = this.ctx.imageSmoothingQuality;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    draw();
    this.ctx.imageSmoothingEnabled = prevEnabled;
    this.ctx.imageSmoothingQuality = prevQuality;
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
    // Shift brick colors slightly based on theme key for per-level variation
    const hash = themeKey.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const hueShift = (hash % 30) - 15; // -15 to +15 degrees
    this.theme = {
      ...theme,
      sandFill: shiftColor(theme.sandFill, hueShift),
      sandLine: shiftColor(theme.sandLine, hueShift),
      sandHighlight: shiftColor(theme.sandHighlight, hueShift),
      sandShadow: shiftColor(theme.sandShadow, hueShift),
      coralFill: shiftColor(theme.coralFill, hueShift),
      coralHighlight: shiftColor(theme.coralHighlight, hueShift),
      coralShadow: shiftColor(theme.coralShadow, hueShift),
    };
    this.sandTile = null;
    this.coralTile = null;
    this.ladderTile = null;
    this.ropeTile = null;
    this.bgImage = null;
    this.loadTileSprites(themeKey);
  }

  setWeather(weather: WeatherType): void {
    if (this.weather === weather) return;
    this.weather = weather;
    this.weatherEffects = getWeatherEffects(weather);
  }

  private loadTileSprites(themeKey: string): void {
    const base = '/assets/tiles/';
    const district = themeKey.replace(/-\d+$/, '');
    const tryLoad = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    tryLoad(base + district + '-sand.png').then(img => { this.sandTile = img; });
    tryLoad(base + district + '-coral.png').then(img => { this.coralTile = img; });
    tryLoad(base + district + '-ladder.png').then(img => { this.ladderTile = img; });
    tryLoad(base + district + '-rope.png').then(img => { this.ropeTile = img; });
    tryLoad('/assets/backgrounds/' + district + '-bg.png').then(img => { this.bgImage = img; });
  }

  updateAnimation(dt: number): void {
    if (!this.playerMoving && !this.playerClimbing && !this.playerUsingRope && !this.playerDigging && !this.playerIdling) {
      this.animAccum = 0;
      this.animFrame = 0;
      this.animState = null;
      return;
    }

    const nextAnimState = this.playerDigging
      ? (this.playerFacing === Direction.Left ? 'dig-left' : 'dig-right')
      : this.playerUsingRope
      ? 'rope'
      : this.playerClimbing
      ? 'climb'
      : this.playerMoving
      ? (this.playerFacing === Direction.Left ? 'run-left' : 'run-right')
      : 'idle';
    if (this.animState !== nextAnimState) {
      this.animAccum = 0;
      this.animFrame = 0;
      this.animState = nextAnimState;
    }

    this.animAccum += dt;
    const frameMs = this.getAnimationFrameMs(nextAnimState);
    if (this.animAccum >= frameMs) {
      this.animAccum -= frameMs;
      this.animFrame++;
    }
  }

  private getAnimationFrameMs(state: Exclude<Renderer['animState'], null>): number {
    switch (state) {
      case 'idle':
        return this.playerPowerActive ? this.POWER_IDLE_FRAME_MS : this.IDLE_FRAME_MS;
      case 'climb':
        return this.CLIMB_FRAME_MS;
      case 'rope':
        return this.ROPE_FRAME_MS;
      case 'dig-left':
      case 'dig-right':
        return this.DIG_FRAME_MS;
      case 'run-left':
      case 'run-right':
      default:
        return this.RUN_FRAME_MS;
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
    this.drawBackdropPixelTexture(W, H);

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
      ctx.save();
      ctx.globalAlpha = 0.18;
      grad2.addColorStop(0, c2);
      grad2.addColorStop(0.5, c1);
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Scenic background image ──
    if (this.bgImage) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.bgImage, 0, 0, W, H);
      ctx.restore();
    }

    // ── Parallax depth layers ──
    this.drawParallaxLayers(W, H, t);

    // Pixel noise texture — breaks up the smooth gradient, matches sprite grain
    if (!this.noisePattern) {
      this.noisePattern = this.createNoisePattern();
    }
    if (this.noisePattern) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  private noisePattern: CanvasPattern | null = null;

  private createNoisePattern(): CanvasPattern | null {
    const size = 64;
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = size;
    noiseCanvas.height = size;
    const nctx = noiseCanvas.getContext('2d')!;
    const imageData = nctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    nctx.putImageData(imageData, 0, 0);
    return this.ctx.createPattern(noiseCanvas, 'repeat');
  }

  private drawParallaxLayers(W: number, H: number, t: number): void {
    const ctx = this.ctx;

    // ── Drifting clouds ──
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const speed = 6 + i * 4;
      const cloudX = ((i * 197 + t * speed) % (W + 200)) - 100;
      const cloudY = 20 + (i * 67) % (H * 0.3);
      const cloudW = 60 + (i * 31) % 50;
      const cloudH = 16 + (i * 13) % 12;
      ctx.globalAlpha = 0.06 + (i % 3) * 0.02;
      ctx.fillStyle = '#FFFFFF';
      // Blobby cloud shape — overlapping ellipses
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, cloudW * 0.5, cloudH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloudX - cloudW * 0.25, cloudY + 2, cloudW * 0.35, cloudH * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloudX + cloudW * 0.3, cloudY + 1, cloudW * 0.3, cloudH * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Vignette — dark edges to frame the scene ──
    ctx.save();
    const vigW = W * 0.7;
    const vigH = H * 0.7;
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(vigW, vigH) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  private drawBackdropPixelTexture(width: number, height: number): void {
    const ctx = this.ctx;
    const cell = this.WORLD_PIXEL * 2;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);

    ctx.save();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pattern = (row * 3 + col * 5) % 7;
        if (pattern > 2) continue;
        const x = col * cell;
        const y = row * cell;

        ctx.fillStyle = pattern === 0
          ? 'rgba(255,255,255,0.018)'
          : 'rgba(0,0,0,0.014)';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.restore();
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
    const mortar = this.scaleToTile(1);
    const step = this.scaleToTile(8);
    const brickH = Math.max(2, step - mortar);
    const brickW = Math.max(2, step - mortar);
    const rowY = Array.from({ length: Math.ceil(S / step) }, (_, index) => index * step);
    const brickCols = Math.ceil(S / step) + 1;
    const evenBrickXs = Array.from({ length: brickCols }, (_, index) => index * step);
    const oddBrickXs = Array.from({ length: brickCols }, (_, index) => index * step - Math.floor(step / 2));

    // Mortar background first, then textured bricks on top.
    ctx.fillStyle = t.sandLine;
    ctx.fillRect(px, py, S, S);

    let brickIdx = 0;
    for (let row = 0; row < rowY.length; row++) {
      const y = py + rowY[row];
      const brickXs = row % 2 === 0 ? evenBrickXs : oddBrickXs;

      for (const bx of brickXs) {
        const drawX = px + bx;
        const visibleX = Math.max(px, drawX);
        const visibleW = Math.min(px + S, drawX + brickW) - visibleX;
        if (visibleW <= 0) continue;

        // Per-brick color variation using deterministic hash
        const hash = ((px + bx) * 7 + (py + row) * 13 + brickIdx * 31) & 0xFF;
        const variation = (hash % 5 - 2) * 3; // -6 to +6 brightness shift

        // Base brick fill with variation
        ctx.fillStyle = t.sandFill;
        ctx.fillRect(visibleX, y, visibleW, brickH);

        // Apply brightness variation
        if (variation > 0) {
          ctx.fillStyle = `rgba(255,255,255,${variation * 0.015})`;
          ctx.fillRect(visibleX, y, visibleW, brickH);
        } else if (variation < 0) {
          ctx.fillStyle = `rgba(0,0,0,${-variation * 0.015})`;
          ctx.fillRect(visibleX, y, visibleW, brickH);
        }

        // Top highlight edge
        ctx.fillStyle = t.sandHighlight;
        ctx.fillRect(visibleX, y, visibleW, mortar);

        // Bottom shadow edge
        ctx.fillStyle = t.sandShadow;
        ctx.fillRect(visibleX, y + brickH - mortar, visibleW, mortar);

        // Surface grain — scattered pixels for texture
        const grainSeed = hash;
        for (let g = 0; g < 3; g++) {
          const gx = visibleX + ((grainSeed + g * 17) % Math.max(1, visibleW - 2)) + 1;
          const gy = y + ((grainSeed + g * 23) % (brickH - 3)) + 1;
          ctx.fillStyle = g % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
          ctx.fillRect(gx, gy, 1, 1);
        }

        brickIdx++;
      }
    }
  }

  private drawCoral(px: number, py: number): void {
    if (this.coralTile) {
      this.ctx.drawImage(this.coralTile, px, py, TILE_SIZE, TILE_SIZE);
      return;
    }

    const ctx = this.ctx;
    const t = this.theme;
    const S = TILE_SIZE;
    const bandH = this.scaleToTile(8);
    const divider = this.scaleToTile(1);
    const bandCount = Math.ceil(S / bandH);

    ctx.fillStyle = t.coralFill;
    ctx.fillRect(px, py, S, S);

    // Horizontal bands with variation
    for (let band = 0; band < bandCount; band++) {
      const by = py + band * bandH;
      const hash = ((px * 11 + by * 7 + band * 19) & 0xFF);
      const shift = (hash % 3 - 1) * 2;

      // Subtle per-band color variation
      if (shift > 0) {
        ctx.fillStyle = `rgba(255,255,255,${shift * 0.02})`;
        ctx.fillRect(px, by, S, bandH);
      } else if (shift < 0) {
        ctx.fillStyle = `rgba(0,0,0,${-shift * 0.02})`;
        ctx.fillRect(px, by, S, bandH);
      }

      // Surface grain pixels
      for (let g = 0; g < 4; g++) {
        const gx = px + ((hash + g * 13) % (S - 2)) + 1;
        const gy = by + ((hash + g * 7) % (bandH - 2)) + 1;
        ctx.fillStyle = g % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    // Divider lines between bands
    for (let band = 1; band < bandCount; band++) {
      const y = py + bandH * band;
      ctx.fillStyle = t.coralShadow;
      ctx.fillRect(px, y, S, divider);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px, y - divider, S, divider);
    }

    // Top highlight + bottom shadow
    ctx.fillStyle = t.coralHighlight;
    ctx.fillRect(px, py, S, divider);
    ctx.fillStyle = t.coralShadow;
    ctx.fillRect(px, py + S - divider, S, divider);
  }

  private drawLadder(px: number, py: number): void {
    const ctx = this.ctx;
    const color = this.theme.ladder;
    const S = TILE_SIZE;
    const s = (v: number) => this.scaleToTile(v);
    const style = this.theme.animStyle;

    switch (style) {
      case 'sweep': {
        // Futuristic: glowing energy beam rails, no rungs — floating pads
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(px + s(10), py, s(12), S); // center glow
        ctx.globalAlpha = 1;
        ctx.fillRect(px + s(13), py, s(6), S); // bright core
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(px + s(14), py, s(4), S); // white hot center
        // Floating step pads
        for (let ry = py + s(4); ry < py + S; ry += s(8)) {
          ctx.fillStyle = color;
          ctx.fillRect(px + s(8), ry, s(16), s(2));
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(px + s(9), ry, s(14), s(1));
        }
        break;
      }
      case 'cosmic': {
        // Cosmic: crystalline structure with sparkle dots
        ctx.fillStyle = color;
        ctx.fillRect(px + s(9), py, s(3), S);
        ctx.fillRect(px + S - s(9) - s(3), py, s(3), S);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(px + s(10), py, s(1), S);
        ctx.fillRect(px + S - s(10), py, s(1), S);
        for (let ry = py + s(5); ry < py + S - s(2); ry += s(7)) {
          ctx.fillStyle = color;
          ctx.fillRect(px + s(9), ry, S - s(18), s(2));
          // Sparkle dots on rungs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px + s(12), ry, s(1), s(1));
          ctx.fillRect(px + S - s(13), ry, s(1), s(1));
        }
        break;
      }
      case 'shimmer': {
        // Gold: ornate thick rails with decorative rungs
        const railW = s(4);
        const railL = px + s(6);
        const railR = px + S - s(6) - railW;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(railL + 1, py + 1, railW, S);
        ctx.fillRect(railR + 1, py + 1, railW, S);
        ctx.fillStyle = color;
        ctx.fillRect(railL, py, railW, S);
        ctx.fillRect(railR, py, railW, S);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(railL, py, s(1), S);
        ctx.fillRect(railR, py, s(1), S);
        for (let ry = py + s(5); ry < py + S - s(2); ry += s(7)) {
          ctx.fillStyle = color;
          ctx.fillRect(railL, ry, railR + railW - railL, s(3));
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(railL, ry, railR + railW - railL, s(1));
        }
        break;
      }
      case 'rainbow': {
        // Rainbow: each rung a different color
        const railL = px + s(8);
        const railR = px + S - s(8) - s(2);
        ctx.fillStyle = '#333333';
        ctx.fillRect(railL, py, s(2), S);
        ctx.fillRect(railR, py, s(2), S);
        const colors = ['#FF4444', '#FF8800', '#FFDD00', '#44DD44', '#4488FF', '#AA44FF'];
        let ci = 0;
        for (let ry = py + s(4); ry < py + S - s(2); ry += s(5)) {
          ctx.fillStyle = colors[ci % colors.length];
          ctx.fillRect(railL, ry, railR + s(2) - railL, s(3));
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(railL, ry, railR + s(2) - railL, s(1));
          ci++;
        }
        break;
      }
      default: {
        // Standard ladder: two rails + rungs (Nature, Beach, City, Gray, Flower)
        const railW = s(3);
        const railL = px + s(7);
        const railR = px + S - s(5) - railW;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(railL + 1, py + 1, railW, S);
        ctx.fillRect(railR + 1, py + 1, railW, S);
        ctx.fillStyle = color;
        ctx.fillRect(railL, py, railW, S);
        ctx.fillRect(railR, py, railW, S);
        const rungGap = s(6);
        for (let ry = py + rungGap; ry < py + S - s(2); ry += rungGap) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(railL + 1, ry + 1, railR + railW - railL, s(2));
          ctx.fillStyle = color;
          ctx.fillRect(railL, ry, railR + railW - railL, s(2));
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(railL, ry, railR + railW - railL, 1);
        }
        break;
      }
    }
  }

  private drawRope(px: number, py: number): void {
    const ctx = this.ctx;
    const color = this.theme.rope;
    const midY = py + this.scaleToTile(this.ROPE_LINE_OFFSET_Y);
    const startX = px;
    const endX = px + TILE_SIZE;
    const s = (v: number) => this.scaleToTile(v);
    const style = this.theme.animStyle;

    switch (style) {
      case 'sweep': {
        // Futuristic: neon laser beam with glow
        const beamH = s(3);
        const top = midY - beamH / 2;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(startX, top - s(3), TILE_SIZE, beamH + s(6)); // outer glow
        ctx.globalAlpha = 0.6;
        ctx.fillRect(startX, top - s(1), TILE_SIZE, beamH + s(2)); // mid glow
        ctx.globalAlpha = 1;
        ctx.fillRect(startX, top, TILE_SIZE, beamH); // core beam
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(startX, top + s(1), TILE_SIZE, s(1)); // white hot center
        break;
      }
      case 'cosmic': {
        // Cosmic: wavy energy tether with dots
        const ropeH = s(4);
        const top = midY - ropeH / 2;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(startX, top - s(2), TILE_SIZE, ropeH + s(4));
        ctx.globalAlpha = 1;
        ctx.fillRect(startX, top, TILE_SIZE, ropeH);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(startX, top, TILE_SIZE, s(1));
        // Sparkle dots along the tether
        ctx.fillStyle = '#FFFFFF';
        for (let x = startX + s(3); x < endX; x += s(6)) {
          ctx.fillRect(x, top + s(1), s(1), s(1));
        }
        break;
      }
      case 'shimmer': {
        // Gold: thick velvet cord with tassels
        const ropeH = s(6);
        const top = midY - ropeH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(startX, top + s(2), TILE_SIZE, ropeH);
        ctx.fillStyle = color;
        ctx.fillRect(startX, top, TILE_SIZE, ropeH);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(startX, top, TILE_SIZE, s(2));
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(startX, top + ropeH - s(1), TILE_SIZE, s(1));
        // Gold accent stripe
        ctx.fillStyle = '#E0B030';
        ctx.fillRect(startX, top + s(2), TILE_SIZE, s(1));
        break;
      }
      case 'rainbow': {
        // Rainbow: multicolor gradient rope
        const ropeH = s(5);
        const top = midY - ropeH / 2;
        const colors = ['#FF4444', '#FF8800', '#FFDD00', '#44DD44', '#4488FF', '#AA44FF'];
        const segW = Math.ceil(TILE_SIZE / colors.length);
        for (let i = 0; i < colors.length; i++) {
          ctx.fillStyle = colors[i];
          ctx.fillRect(startX + i * segW, top, segW, ropeH);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(startX, top, TILE_SIZE, s(1));
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(startX, top + ropeH - s(1), TILE_SIZE, s(1));
        break;
      }
      case 'pulse': {
        // Grayscale: heavy chain links
        const ropeH = s(5);
        const top = midY - ropeH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(startX, top + s(1), TILE_SIZE, ropeH);
        // Chain link pattern: alternating thick/thin segments
        for (let x = startX; x < endX; x += s(6)) {
          ctx.fillStyle = color;
          ctx.fillRect(x, top, s(4), ropeH);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x, top, s(4), s(1));
          // Thin connector
          ctx.fillStyle = color;
          ctx.fillRect(x + s(4), top + s(1), s(2), ropeH - s(2));
        }
        break;
      }
      case 'bloom': {
        // Flower: green vine with tiny flower dots
        const ropeH = s(4);
        const top = midY - ropeH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(startX, top + s(1), TILE_SIZE, ropeH);
        ctx.fillStyle = color;
        ctx.fillRect(startX, top, TILE_SIZE, ropeH);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(startX, top, TILE_SIZE, s(1));
        // Small flower buds along vine
        const budColors = ['#FF80A0', '#FFB0C0', '#FF60A0'];
        for (let x = startX + s(4); x < endX; x += s(8)) {
          ctx.fillStyle = budColors[Math.floor(x / s(8)) % budColors.length];
          ctx.fillRect(x, top - s(1), s(2), s(2));
        }
        break;
      }
      default: {
        // Standard rope (Nature, Beach, City)
        const ropeH = s(5);
        const top = midY - ropeH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(startX, top + s(2), TILE_SIZE, ropeH);
        ctx.fillStyle = color;
        ctx.fillRect(startX, top, TILE_SIZE, ropeH);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(startX, top, TILE_SIZE, s(2));
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(startX, top + ropeH - s(1), TILE_SIZE, s(1));
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (let x = startX + s(2); x < endX; x += s(4)) {
          ctx.fillRect(x, top + s(1), s(1), ropeH - s(2));
        }
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let x = startX + s(4); x < endX; x += s(4)) {
          ctx.fillRect(x, top + s(1), s(1), ropeH - s(2));
        }
        break;
      }
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
    const s = (value: number): number => this.scaleToTile(value);
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

    // Draw the cavity as a dark hole shape (visible crumbling brick)
    const shape = cavityShapes[frame];
    ctx.save();
    ctx.fillStyle = 'rgba(255, 100, 160, 0.6)';
    ctx.beginPath();
    ctx.moveTo(mapX(s(shape[0][0])), py + s(shape[0][1]));
    for (const [x, y] of shape.slice(1)) {
      ctx.lineTo(mapX(s(x)), py + s(y));
    }
    ctx.lineTo(mapX(s(4)), py + TILE_SIZE);
    ctx.lineTo(mapX(s(4)), py + s(3));
    ctx.closePath();
    ctx.fill();

    // Inner highlight edge for depth
    ctx.strokeStyle = this.theme.sandShadow;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Fiery brick chunk debris — ember-colored pieces with gravity arc
    const t = progress;
    const fireColors = ['#FF40A0', '#FF70C0', '#FFB0D8', '#FFE0F0'];
    for (let i = 0; i < speckSets[frame].length; i++) {
      const [sx, sy] = speckSets[frame][i];
      const gravity = t * t * 20;
      const drift = (sx - 6) * t * 2;
      const finalX = mapX(s(sx)) + s(drift);
      const finalY = py + s(sy) - s((1 - t) * 8) + s(gravity);
      const alpha = Math.max(0, 1 - t * 0.5);
      const size = s(3 + (1 - t) * 2);
      // Hot core (yellow/white) fading to orange/red as it cools
      const colorIdx = Math.min(fireColors.length - 1, Math.floor(t * fireColors.length));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fireColors[fireColors.length - 1 - colorIdx];
      ctx.fillRect(Math.round(finalX), Math.round(finalY), size, size);
      ctx.fillStyle = fireColors[Math.min(colorIdx + 1, fireColors.length - 1)];
      ctx.fillRect(Math.round(finalX) + 1, Math.round(finalY) + 1, size - 1, size - 1);
      // Tiny ember glow around each chunk
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = '#FF60B0';
      ctx.fillRect(Math.round(finalX) - s(1), Math.round(finalY) - s(1), size + s(2), size + s(2));
    }
    ctx.globalAlpha = 1;

    const burst = burstAnchors[frame];
    ctx.save();
    ctx.translate(mapX(s(burst.x)), py + s(burst.y));
    ctx.scale(burstDir * burst.scale, burst.scale);
    ctx.fillStyle = '#FFB0D8';
    ctx.strokeStyle = '#FF60A0';
    ctx.lineWidth = s(1);
    ctx.beginPath();
    ctx.moveTo(-s(6), s(5));
    ctx.lineTo(-s(4), -s(1));
    ctx.lineTo(-s(2), s(2));
    ctx.lineTo(0, -s(5));
    ctx.lineTo(s(2), s(1));
    ctx.lineTo(s(5), -s(6));
    ctx.lineTo(s(3), -s(9));
    ctx.lineTo(0, -s(7));
    ctx.lineTo(-s(2), -s(10));
    ctx.lineTo(-s(4), -s(5));
    ctx.lineTo(-s(6), -s(7));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawOpenHole(px: number, py: number, closingProgress: number): void {
    const ctx = this.ctx;
    if (closingProgress <= 0) return;

    const left = px + this.scaleToTile(4);
    const width = TILE_SIZE - this.scaleToTile(8);
    const height = TILE_SIZE - this.scaleToTile(6);
    const fillHeight = Math.max(3, Math.floor(height * closingProgress));
    const fillTop = py + TILE_SIZE - fillHeight;
    const segmentW = Math.max(3, Math.floor(width / 4));
    const lipDepths = [1, 3, 0, 2].map((depth) => Math.floor(this.scaleToTile(depth) * (1 - closingProgress)));

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
      const badgeSprite = this.badgeSprite;
      const frameIndex = this.getBadgeFrameIndex();
      this.withSpriteSmoothing(() => {
        this.ctx.drawImage(
          badgeSprite,
          frameIndex * this.badgeSourceFrameWidth,
          0,
          this.badgeSourceFrameWidth,
          badgeSprite.naturalHeight,
          px + badgeOffset,
          py + badgeOffset,
          badgeSize,
          badgeSize,
        );
      });
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

  drawMoneyDrop(pos: Position): void {
    const px = pos.x * TILE_SIZE;
    const py = pos.y * TILE_SIZE;
    const size = Math.floor(TILE_SIZE * this.DROP_SCALE);
    const offset = Math.floor((TILE_SIZE - size) / 2);

    if (this.badgeSprite) {
      const badgeSprite = this.badgeSprite;
      const frameIndex = this.getBadgeFrameIndex();
      this.withSpriteSmoothing(() => {
        this.ctx.drawImage(
          badgeSprite,
          frameIndex * this.badgeSourceFrameWidth,
          0,
          this.badgeSourceFrameWidth,
          badgeSprite.naturalHeight,
          px + offset,
          py + offset,
          size,
          size,
        );
      });
      return;
    }

    const ctx = this.ctx;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    ctx.fillStyle = COLORS.vibestrGold;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy);
  }

  private getBadgeFrameIndex(): number {
    return Math.floor(this.bgTime / 0.15) % this.badgeFrameCount;
  }

  drawPowerHelmetPickup(pos: Position): void {
    const px = pos.x * TILE_SIZE;
    const py = pos.y * TILE_SIZE;

    if (this.sprites?.powerPickup) {
      const anim = this.sprites.powerPickup;
      const frameIndex = Math.floor(this.bgTime / 0.11) % anim.frameCount;
      const fi = frameIndex % anim.frameCount;
      const srcW = anim.sourceFrameWidth ?? anim.frameWidth;
      const srcH = anim.sourceFrameHeight ?? anim.frameHeight;
      const drawSize = Math.floor(TILE_SIZE * 0.95);
      const offsetX = Math.floor((TILE_SIZE - drawSize) / 2);
      const offsetY = Math.floor((TILE_SIZE - drawSize) / 2);
      this.withSpriteSmoothing(() => {
        this.ctx.drawImage(
          anim.image,
          fi * srcW, 0, srcW, srcH,
          px + offsetX, py + offsetY, drawSize, drawSize,
        );
      });
      return;
    }

    this.ctx.fillStyle = '#C62828';
    this.ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }

  drawProjectiles(projectiles: ProjectileState[]): void {
    const ctx = this.ctx;
    const bodyW = this.scaleToTile(10);
    const bodyH = this.scaleToTile(4);
    const shadowOutset = this.scaleToTile(1);
    const shadowW = this.scaleToTile(3);
    const noseW = this.scaleToTile(3);
    const noseOffset = this.scaleToTile(2);
    const highlightY = this.scaleToTile(1);
    const beamW = this.scaleToTile(2);
    const beamH = this.scaleToTile(8);
    const beamOffset = this.scaleToTile(2);

    for (const projectile of projectiles) {
      const dir = projectile.direction === Direction.Right ? 1 : -1;
      const headX = Math.round(projectile.pos.x * TILE_SIZE);
      const headY = Math.round(projectile.pos.y * TILE_SIZE);

      ctx.fillStyle = 'rgba(58, 12, 12, 0.65)';
      ctx.fillRect(headX - (dir < 0 ? 0 : bodyW), headY - shadowOutset, bodyW + shadowW, bodyH + shadowOutset * 2);

      ctx.fillStyle = '#F74B4B';
      ctx.fillRect(headX - (dir < 0 ? 0 : bodyW), headY, bodyW, bodyH);

      ctx.fillStyle = '#FFD6D6';
      ctx.fillRect(headX - (dir < 0 ? -noseOffset : bodyW - noseOffset), headY + highlightY, noseW, this.scaleToTile(2));

      ctx.fillStyle = '#FF8B8B';
      ctx.fillRect(headX - dir * beamOffset, headY - beamOffset, beamW, beamH);
    }
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
      // LFV shaka aura effect — colorful shakas orbiting the player
      if (isLFV) {
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;
        const t = this.bgTime;
        ctx.save();

        // Inner glow
        ctx.globalAlpha = 0.2;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_SIZE / 2 + 2);
        glow.addColorStop(0, '#FFFFFF');
        glow.addColorStop(0.4, '#FFD700');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(px - 8, py - 8, TILE_SIZE + 16, TILE_SIZE + 16);

        // Orbiting shakas
        if (this.shakaSprites.length === 6 && this.shakaSprites[0].complete) {
          const shakaSize = 14;
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + t * 2.5;
            const bob = Math.sin(t * 5 + i * 1.8) * 3;
            const reach = TILE_SIZE / 2 + 8 + bob;
            const sx = cx + Math.cos(angle) * reach;
            const sy = cy + Math.sin(angle) * reach;
            const rot = angle + Math.sin(t * 3 + i) * 0.4;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(rot);
            ctx.globalAlpha = 0.9;
            ctx.drawImage(this.shakaSprites[i], -shakaSize / 2, -shakaSize / 2, shakaSize, shakaSize);
            ctx.restore();
          }
        }

        ctx.restore();
      }

      // Pick the correct pre-mirrored strip or idle sprite
      const isDigging = this.playerDigging;
      const usePowerSprites = this.playerPowerActive;
      const anim = usePowerSprites && isUsingLadder
        ? this.sprites.powerClimb
        : usePowerSprites && isUsingRope
        ? this.sprites.powerRope
        : usePowerSprites && !isUsingLadder && !isUsingRope
        ? (
          (isMoving || isDigging)
            ? (facing === Direction.Left ? this.sprites.powerRunLeft : this.sprites.powerRunRight)
            : this.sprites.powerFront
        )
        : isDigging
        ? (facing === Direction.Left ? this.sprites.digLeft : this.sprites.digRight)
        : isUsingLadder
        ? this.sprites.climb
        : isUsingRope
        ? this.sprites.rope
        : isMoving
        ? (facing === Direction.Left ? this.sprites.runLeft : this.sprites.runRight)
        : this.sprites.idle;
      const frameIndex = this.animFrame;
      const drawWidth = Math.floor(anim.frameWidth * this.PLAYER_SCALE);
      const drawHeight = Math.floor(anim.frameHeight * this.PLAYER_SCALE);
      const offsetY = TILE_SIZE - drawHeight;
      const offsetX = (TILE_SIZE - drawWidth) / 2;
      const drawX = Math.max(0, Math.min(px + offsetX, CANVAS_WIDTH - drawWidth));
      const drawY = Math.max(
        0,
        isUsingRope
          ? py + this.scaleToTile(this.ROPE_LINE_OFFSET_Y) - this.scaleToTile(this.ROPE_HAND_ANCHOR_Y)
          : py + offsetY
      );
      const fi = frameIndex % anim.frameCount;
      const sourceFrameWidth = anim.sourceFrameWidth ?? anim.frameWidth;
      const sourceFrameHeight = anim.sourceFrameHeight ?? anim.frameHeight;
      this.withSpriteSmoothing(() => {
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
      });
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
      let crop: { x: number; y: number; w: number; h: number };
      if (isTrapped) {
        img = this.duckSprites.front;
        crop = { x: 37, y: 33, w: 46, h: 55 };
      } else if (isOnLadder) {
        img = this.duckSprites.back;
        crop = { x: 37, y: 33, w: 47, h: 56 };
      } else {
        img = facing === Direction.Left ? this.duckSprites.left : this.duckSprites.right;
        crop = facing === Direction.Left
          ? { x: 30, y: 32, w: 59, h: 56 }
          : { x: 31, y: 32, w: 59, h: 56 };
      }
      const drawHeight = Math.floor(TILE_SIZE * this.DUCK_SCALE);
      const drawWidth = Math.round((crop.w / crop.h) * drawHeight);
      const offsetX = Math.floor((TILE_SIZE - drawWidth) / 2);
      const offsetY = TILE_SIZE - drawHeight;
      this.withSpriteSmoothing(() => {
        ctx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.w,
          crop.h,
          px + offsetX,
          py + offsetY,
          drawWidth,
          drawHeight,
        );
      });
      return;
    }

    // Fallback
    ctx.fillStyle = isTrapped ? COLORS.darkSand : COLORS.vibestrGold;
    ctx.fillRect(px + 4, py + 8, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.fillStyle = '#E87B35';
    ctx.fillRect(px + TILE_SIZE - 6, py + 12, 6, 4);
  }

  drawDuckDeaths(effects: DuckDeathEffect[]): void {
    if (!this.duckSprites) return;

    const death = this.duckSprites.death;
    for (const effect of effects) {
      const frameIndex = Math.min(
        death.frameCount - 1,
        Math.floor(effect.elapsed / DUCK_DEATH_FRAME_MS),
      );
      const drawX = effect.pos.x * TILE_SIZE + (TILE_SIZE - death.frameWidth) / 2;
      const drawY = effect.pos.y * TILE_SIZE + (TILE_SIZE - death.frameHeight) / 2;
      this.withSpriteSmoothing(() => {
        drawFrame(this.ctx, death, frameIndex, drawX, drawY);
      });
    }
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
