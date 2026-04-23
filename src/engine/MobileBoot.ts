import type { GameManager } from '@/game/GameManager';
import type { InputManager } from '@/engine/Input';

/** True if the user agent has touch capability. Hybrid devices (iPad, touchscreen laptops) return true. */
export function detectTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Set body class so CSS can show touch controls. */
function applyTouchClass(): void {
  if (detectTouch()) {
    document.body.classList.add('has-touch');
    // Re-trigger canvas sizing now that CSS has taken over (syncCanvasDisplaySize
    // was called once at module init before this class was set).
    window.dispatchEvent(new Event('resize'));
  }
}

/** Toggle `body.portrait` based on orientation media query. Pauses/resumes game. */
function bindOrientation(game: GameManager): void {
  const mq = window.matchMedia('(orientation: portrait)');
  const apply = (matches: boolean): void => {
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
  const active = new Map<number, string>();

  const press = (pointerId: number, key: string): void => {
    const prior = active.get(pointerId);
    if (prior === key) return;
    if (prior) input.releaseTouch(prior);
    input.pressTouch(key);
    active.set(pointerId, key);
  };

  const release = (pointerId: number): void => {
    const key = active.get(pointerId);
    if (key) input.releaseTouch(key);
    active.delete(pointerId);
  };

  const handleDown = (e: PointerEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
    if (!target) return;
    const key = target.dataset.key!;
    e.preventDefault();
    target.setPointerCapture?.(e.pointerId);
    press(e.pointerId, key);
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
    const startedOnDpad = currentKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(currentKey);
    const targetIsDpad = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(btn.dataset.key!);
    if (startedOnDpad && targetIsDpad) {
      press(e.pointerId, btn.dataset.key!);
    }
  };

  document.querySelectorAll<HTMLElement>('[data-key]').forEach(el => {
    el.addEventListener('pointerdown', handleDown);
    el.addEventListener('pointerup', handleUp);
    el.addEventListener('pointercancel', handleUp);
    el.addEventListener('pointerleave', handleUp);
    el.addEventListener('pointermove', handleMove);
  });
}

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

function bindVisibility(game: GameManager): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.pause?.();
    else game.resume?.();
  });
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
  bindOrientation(_opts.game);
  bindTouchButtons(_opts.input);
  bindFirstGestureUnlock();
  bindVisibility(_opts.game);
}
