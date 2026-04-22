import type { GameManager } from '@/game/GameManager';
import type { InputManager } from '@/engine/Input';

/** True if the user agent has touch capability. Hybrid devices (iPad, touchscreen laptops) return true. */
export function detectTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Set body class so CSS can show touch controls. */
function applyTouchClass(): void {
  if (detectTouch()) document.body.classList.add('has-touch');
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

  document.querySelectorAll<HTMLElement>('[data-key]').forEach(el => {
    el.addEventListener('pointerdown', handleDown);
    el.addEventListener('pointerup', handleUp);
    el.addEventListener('pointercancel', handleUp);
    el.addEventListener('pointerleave', handleUp);
  });
}

export interface MobileBootOptions {
  game: GameManager;
  input: InputManager;
}

/** Initialize all mobile-specific boot logic. Safe to call on desktop (becomes a no-op for non-touch). */
export function initMobile(_opts: MobileBootOptions): void {
  applyTouchClass();
  if (!detectTouch()) return;
  bindOrientation(_opts.game);
  bindTouchButtons(_opts.input);
}
