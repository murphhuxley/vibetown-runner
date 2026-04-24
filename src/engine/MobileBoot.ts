import type { GameManager } from '@/game/GameManager';
import type { InputManager } from '@/engine/Input';
import { GRID_COLS, GRID_ROWS, VIBE_MAX } from '@/constants';

/** True if the user agent has touch capability. Hybrid devices (iPad, touchscreen laptops) return true. */
export function detectTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Set body class so CSS can show touch controls. */
function applyTouchClass(): void {
  if (detectTouch()) {
    document.body.classList.add('has-touch');
    const params = new URLSearchParams(window.location.search);
    if (params.get('touchZones') === '1' || localStorage.getItem('debugTouchZones') === '1') {
      document.body.classList.add('debug-touch-zones');
    }
    // Re-trigger canvas sizing now that CSS has taken over (syncCanvasDisplaySize
    // was called once at module init before this class was set).
    window.dispatchEvent(new Event('resize'));
  }
}

/** Toggle `body.portrait` based on orientation media query. Pauses/resumes game. */
function bindOrientation(game: GameManager, input: InputManager): void {
  const mq = window.matchMedia('(orientation: portrait)');
  const apply = (matches: boolean): void => {
    input.clear();
    document.body.classList.toggle('portrait', matches);
    if (matches) game.pause?.();
    else game.resume?.();
  };
  apply(mq.matches);
  mq.addEventListener('change', (e) => apply(e.matches));
}

/** Wire pointer events on all elements with `data-key`. */
function bindTouchButtons(input: InputManager): void {
  // pointerId -> currently-pressed key (so we can release correctly on lift)
  const active = new Map<number, { key: string; el: HTMLElement }>();
  const keyCounts = new Map<string, number>();

  const press = (pointerId: number, key: string, el: HTMLElement): void => {
    const prior = active.get(pointerId);
    if (prior?.key === key && prior.el === el) return;
    if (prior) release(pointerId);

    const count = keyCounts.get(key) ?? 0;
    if (count === 0) input.pressTouch(key);
    keyCounts.set(key, count + 1);
    el.classList.add('pressed');
    active.set(pointerId, { key, el });
  };

  const release = (pointerId: number): void => {
    const entry = active.get(pointerId);
    if (!entry) return;
    const { key, el } = entry;
    const count = Math.max(0, (keyCounts.get(key) ?? 1) - 1);
    if (count === 0) {
      keyCounts.delete(key);
      input.releaseTouch(key);
    } else {
      keyCounts.set(key, count);
    }
    el.classList.remove('pressed');
    active.delete(pointerId);
  };

  const releaseAll = (): void => {
    active.forEach(({ el }) => el.classList.remove('pressed'));
    active.clear();
    keyCounts.clear();
    input.clear();
  };

  const handleDown = (e: PointerEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
    if (!target) return;
    const key = target.dataset.key!;
    e.preventDefault();
    target.setPointerCapture?.(e.pointerId);
    press(e.pointerId, key, target);
  };

  const handleUp = (e: PointerEvent): void => {
    if (active.has(e.pointerId)) {
      e.preventDefault();
      release(e.pointerId);
    }
  };

  const handleMove = (e: PointerEvent): void => {
    if (!active.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el?.closest<HTMLElement>('[data-key]');
    if (!btn) return; // still on the dpad rail but between buttons — keep current
    // Only re-target within the same rail (D-pad). Don't let a D-pad drag
    // accidentally press an action button.
    const currentKey = active.get(e.pointerId);
    const startedOnDpad = currentKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(currentKey.key);
    const targetIsDpad = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(btn.dataset.key!);
    if (startedOnDpad && targetIsDpad) {
      press(e.pointerId, btn.dataset.key!, btn);
    }
  };

  document.querySelectorAll<HTMLElement>('[data-key]').forEach(el => {
    el.addEventListener('pointerdown', handleDown);
    el.addEventListener('pointerup', handleUp);
    el.addEventListener('pointercancel', handleUp);
    el.addEventListener('pointerleave', handleUp);
    el.addEventListener('pointermove', handleMove);
  });

  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  window.addEventListener('orientationchange', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseAll();
  });
}

export const __mobileBootTest = {
  applyTouchClass,
  bindTouchButtons,
  bindOrientation,
};

function bindFirstGestureUnlock(): void {
  const onFirst = async (): Promise<void> => {
    const { resumeAudio } = await import('@/engine/Audio');
    try { resumeAudio(); } catch { /* ignore */ }
    try {
      const so = screen.orientation as { lock?: (o: string) => Promise<void> } | undefined;
      await so?.lock?.('landscape');
    } catch { /* iOS Safari doesn't support; rotate prompt handles it */ }
  };
  const fire = (): void => {
    onFirst();
    window.removeEventListener('pointerdown', fire, true);
    window.removeEventListener('keydown', fire, true);
  };
  window.addEventListener('pointerdown', fire, true);
  window.addEventListener('keydown', fire, true);
}

function bindVisibility(game: GameManager, input: InputManager): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      input.clear();
      game.pause?.();
    }
    else game.resume?.();
  });
}

/** Zoom the canvas 2× and translate it each frame so the player stays near the viewport
    center. Static phases (death / game over / pause) snap the camera to canvas center so
    overlay text is visible regardless of where the player died.
    Pure CSS + transform — does not touch the Renderer or game logic. */
function bindCameraFollow(game: GameManager): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const viewport = document.querySelector<HTMLElement>('.screen-viewport');
  if (!canvas || !viewport) return;

  const ZOOM = 2;
  const COLS = GRID_COLS;
  const ROWS = GRID_ROWS + 1; // grid rows + 1 UI row
  const LOOK_AHEAD_TILES = 2.2;
  const INTRO_PAN_MS = 900;

  // Cache viewport/canvas dimensions. Only recompute on resize — per-frame reads would
  // force layout recalc every frame, contributing to stutter.
  let vw = 0, vh = 0, tilePx = 0, cw = 0, ch = 0;
  let lastLevel = game.state.currentLevel;
  let introPanStart = performance.now();
  const relayout = (): void => {
    vw = viewport.clientWidth;
    vh = viewport.clientHeight;
    if (vw === 0 || vh === 0) return;
    tilePx = (vh / ROWS) * ZOOM;
    cw = tilePx * COLS;
    ch = tilePx * ROWS;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
  };
  relayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

  const staticPhases: Set<string> = new Set(['dead', 'game-over', 'victory', 'level-complete', 'paused']);

  const tick = (): void => {
    if (vw > 0 && vh > 0) {
      let tx: number;
      let ty: number;
      if (staticPhases.has(game.state.phase as unknown as string)) {
        // Center canvas in viewport so end-screen overlay text is visible.
        tx = (vw - cw) / 2;
        ty = (vh - ch) / 2;
      } else {
        const now = performance.now();
        if (game.state.currentLevel !== lastLevel) {
          lastLevel = game.state.currentLevel;
          introPanStart = now;
        }
        // Use the INTERPOLATED render position (same one the Renderer uses) to avoid
        // tick-quantized stutter. player.pos jumps discretely on each tick; renderPos
        // smoothly interpolates between ticks and is what's actually being drawn.
        const r = game.getPlayerRenderPos();
        const facingOffset = game.state.player.facing === 'left'
          ? -LOOK_AHEAD_TILES * tilePx
          : game.state.player.facing === 'right'
            ? LOOK_AHEAD_TILES * tilePx
            : 0;
        const px = r.x * tilePx + tilePx / 2 + facingOffset;
        const py = r.y * tilePx + tilePx / 2;
        const followTx = vw / 2 - px;
        const followTy = vh / 2 - py;
        const centerTx = (vw - cw) / 2;
        const centerTy = (vh - ch) / 2;
        const introT = Math.min(1, Math.max(0, (now - introPanStart) / INTRO_PAN_MS));
        const easedIntro = 1 - Math.pow(1 - introT, 3);
        tx = centerTx + (followTx - centerTx) * easedIntro;
        ty = centerTy + (followTy - centerTy) * easedIntro;
        // Clamp so canvas doesn't reveal black gutters past the grid edges.
        tx = Math.min(0, Math.max(vw - cw, tx));
        ty = Math.min(0, Math.max(vh - ch, ty));
      }
      // translate3d forces the browser onto the compositor thread — smoother than translate().
      canvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    }
    requestAnimationFrame(tick);
  };
  tick();
}

/** Pulse the L/R shoulder button glow overlays when the player has enough vibe to activate LFV.
    Targets .shoulder-glow (decorative, sized to visible button art), NOT the large invisible
    hit zone. Runs on RAF so it tracks vibeMeter changes without requiring a GameManager callback. */
function bindLfvReadyGlow(game: GameManager): void {
  const glows = document.querySelectorAll<HTMLElement>('.shoulder-glow');
  if (glows.length === 0) return;
  let lastReady = false;
  const tick = (): void => {
    const ready = game.state.vibeMeter >= VIBE_MAX && !game.state.player.isLFV;
    if (ready !== lastReady) {
      glows.forEach((el) => el.classList.toggle('lfv-ready', ready));
      lastReady = ready;
    }
    requestAnimationFrame(tick);
  };
  tick();
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPromptEvent: BeforeInstallPromptEvent | null = null;

function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPromptEvent = e as BeforeInstallPromptEvent;
  });
}

function isIOSStandaloneEligible(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
}

export function showInstallPromptIfEligible(): void {
  // Desktop should never see the install card — the PWA-install flow is meaningful only
  // on mobile where "add to home screen" unlocks fullscreen standalone. Chrome's native
  // prompt is already suppressed by captureInstallPrompt()'s preventDefault.
  if (!detectTouch()) return;
  if (localStorage.getItem('installDismissed') === '1') return;
  const androidCard = document.getElementById('install-card');
  const iosCard = document.getElementById('ios-install-card');
  if (installPromptEvent && androidCard) {
    androidCard.classList.remove('hidden');
    document.getElementById('install-yes')?.addEventListener('click', async () => {
      androidCard.classList.add('hidden');
      await installPromptEvent!.prompt();
      installPromptEvent = null;
    }, { once: true });
    document.getElementById('install-no')?.addEventListener('click', () => {
      androidCard.classList.add('hidden');
      localStorage.setItem('installDismissed', '1');
    }, { once: true });
  } else if (isIOSStandaloneEligible() && iosCard) {
    iosCard.classList.remove('hidden');
    document.getElementById('ios-install-close')?.addEventListener('click', () => {
      iosCard.classList.add('hidden');
      localStorage.setItem('installDismissed', '1');
    }, { once: true });
  }
}

export interface MobileBootOptions {
  game: GameManager;
  input: InputManager;
}

/** Initialize all mobile-specific boot logic. Safe to call on desktop (becomes a no-op for non-touch). */
export function initMobile(_opts: MobileBootOptions): void {
  captureInstallPrompt();
  applyTouchClass();
  if (!detectTouch()) return;
  bindOrientation(_opts.game, _opts.input);
  bindTouchButtons(_opts.input);
  bindFirstGestureUnlock();
  bindVisibility(_opts.game, _opts.input);
  bindLfvReadyGlow(_opts.game);
  bindCameraFollow(_opts.game);
}
