// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectTouch, __mobileBootTest } from '@/engine/MobileBoot';
import { InputManager } from '@/engine/Input';

function makePointerEvent(type: string, pointerId: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'clientX', { value: 0 });
  Object.defineProperty(event, 'clientY', { value: 0 });
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectTouch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    delete (window as unknown as { ontouchstart?: unknown }).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });

  it('returns false when no touch capability', () => {
    expect(detectTouch()).toBe(false);
  });

  it('returns true when ontouchstart exists', () => {
    (window as unknown as { ontouchstart: unknown }).ontouchstart = null;
    expect(detectTouch()).toBe(true);
  });

  it('returns true when maxTouchPoints > 0', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    expect(detectTouch()).toBe(true);
  });
});

describe('mobile touch controls', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="handheld-btn" data-key="ArrowLeft"></button>
      <button class="handheld-btn shoulder-L" data-key=" "></button>
      <button class="handheld-btn shoulder-R" data-key=" "></button>
    `;
    document.body.className = '';
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('presses and releases touch buttons with visual pressed state', () => {
    const input = new InputManager();
    const left = document.querySelector<HTMLElement>('[data-key="ArrowLeft"]')!;
    __mobileBootTest.bindTouchButtons(input);

    left.dispatchEvent(makePointerEvent('pointerdown', 1));
    expect(input.left).toBe(true);
    expect(left.classList.contains('pressed')).toBe(true);

    left.dispatchEvent(makePointerEvent('pointerup', 1));
    expect(input.left).toBe(false);
    expect(left.classList.contains('pressed')).toBe(false);
  });

  it('keeps a shared key held until every active pointer releases it', () => {
    const input = new InputManager();
    const leftShoulder = document.querySelector<HTMLElement>('.shoulder-L')!;
    const rightShoulder = document.querySelector<HTMLElement>('.shoulder-R')!;
    __mobileBootTest.bindTouchButtons(input);

    leftShoulder.dispatchEvent(makePointerEvent('pointerdown', 1));
    rightShoulder.dispatchEvent(makePointerEvent('pointerdown', 2));
    leftShoulder.dispatchEvent(makePointerEvent('pointerup', 1));

    expect(input.activateLFV).toBe(true);
    expect(leftShoulder.classList.contains('pressed')).toBe(false);
    expect(rightShoulder.classList.contains('pressed')).toBe(true);

    rightShoulder.dispatchEvent(makePointerEvent('pointerup', 2));
    expect(input.activateLFV).toBe(false);
  });

  it('clears held inputs when the page is hidden', () => {
    const input = new InputManager();
    const left = document.querySelector<HTMLElement>('[data-key="ArrowLeft"]')!;
    __mobileBootTest.bindTouchButtons(input);

    left.dispatchEvent(makePointerEvent('pointerdown', 1));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(input.left).toBe(false);
    expect(left.classList.contains('pressed')).toBe(false);
  });
});

describe('mobile orientation handling', () => {
  it('clears input and pauses when portrait starts', () => {
    const input = new InputManager();
    input.pressTouch('ArrowLeft');
    const game = {
      pause: vi.fn(),
      resume: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    __mobileBootTest.bindOrientation(game as never, input);

    expect(input.left).toBe(false);
    expect(document.body.classList.contains('portrait')).toBe(true);
    expect(game.pause).toHaveBeenCalledTimes(1);
  });
});
