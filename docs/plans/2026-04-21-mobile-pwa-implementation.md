# Mobile PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take Vibetown Runner from "MOBILE COMING SOON" placeholder to a playable, installable PWA on iOS and Android in one week — Phase 1 (unblock mobile) ships Mon–Tue; Phase 2 (install polish) ships Wed–Fri.

**Architecture:** Three subsystems change. **(A)** `InputManager` gains `pressTouch` / `releaseTouch`. **(B)** A new `MobileBoot.ts` module owns feature detection, rotate-prompt, orientation lock, audio unlock, pointer tracking (including `pointerId`-scoped multi-touch and D-pad finger-slide), install prompt, and visibility pause/resume. **(C)** A rewritten `public/service-worker.js` uses stale-while-revalidate for the bundle and cache-first for assets, with Convex calls always network-only. Zero changes to game logic.

**Tech Stack:** TypeScript 5.9, Vite 8, Canvas 2D, Vitest 4 (existing), `pwa-asset-generator` (one-time via `npx`, no runtime dep), vanilla service worker (no Workbox).

**Design reference:** `docs/plans/2026-04-21-mobile-pwa-design.md` (this plan implements that design).

---

## Prerequisites

**Step 1: Confirm clean working tree on `main`**

Run: `cd ~/.openclaw/workspace/projects/vibetown-runner && git status && git branch --show-current`
Expected: `working tree clean`, branch `main`.

**Step 2: Confirm the design doc is committed**

Run: `git log --oneline -5`
Expected: the most recent commit should be `Add mobile PWA design doc (Phase 1 + Phase 2)` (sha `2573799` or a fresh one if you're re-running).

**Step 3: Confirm tests pass before any changes**

Run: `npm run test:run`
Expected: all existing tests pass. This is the baseline — if anything fails later, you can tell whether your change caused it.

**Step 4: Confirm the Vite dev server starts**

Run (in a separate terminal): `npm run dev`
Expected: Vite serves on `http://localhost:3337`. Leave it running for the whole Phase 1 — you'll use it for manual verification.

---

# Phase 1 — Unblock mobile (Days 1–2)

Goal: mobile players can load `vibetownrunner.com` on a phone and play the game using touch controls. No install polish yet.

---

### Task 1: Extend `InputManager` with `pressTouch` / `releaseTouch`

**Why first:** Touch wiring depends on this. Doing it first means every later task can call into a stable API. It's also pure-state logic, so we TDD it.

**Files:**
- Modify: `src/engine/Input.ts`
- Create: `tests/engine/Input.test.ts`

**Step 1: Write the failing test**

Create `tests/engine/Input.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { InputManager } from '@/engine/Input';

describe('InputManager touch API', () => {
  it('pressTouch marks the key as down', () => {
    const input = new InputManager();
    input.pressTouch('ArrowLeft');
    expect(input.left).toBe(true);
  });

  it('releaseTouch clears the key', () => {
    const input = new InputManager();
    input.pressTouch('ArrowLeft');
    input.releaseTouch('ArrowLeft');
    expect(input.left).toBe(false);
  });

  it('pressTouch registers as justPressed once', () => {
    const input = new InputManager();
    input.pressTouch(' ');
    expect(input.justPressed(' ')).toBe(true);
    expect(input.justPressed(' ')).toBe(false);
  });

  it('touch and keyboard state coexist', () => {
    const input = new InputManager();
    input.pressTouch('ArrowLeft');
    input.handleKeyDown('z');
    expect(input.left).toBe(true);
    expect(input.digLeft).toBe(true);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/Input.test.ts`
Expected: FAIL. Error: `pressTouch is not a function` or similar.

**Step 3: Implement the minimal code**

Edit `src/engine/Input.ts` — add these two methods inside the `InputManager` class (e.g., right after `handleKeyUp`):

```typescript
  pressTouch(key: string): void {
    this.handleKeyDown(key);
  }

  releaseTouch(key: string): void {
    this.handleKeyUp(key);
  }
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine/Input.test.ts`
Expected: all 4 tests pass.

**Step 5: Run the full suite to verify no regressions**

Run: `npm run test:run`
Expected: all tests pass (new + existing).

**Step 6: Commit**

```bash
git add src/engine/Input.ts tests/engine/Input.test.ts
git commit -m "Add pressTouch/releaseTouch methods to InputManager"
```

---

### Task 2: Make `resumeAudio()` actually resume the AudioContext

**Why:** Currently `src/engine/Audio.ts:149` has `export function resumeAudio(): void {}` — a no-op. iOS blocks audio until a user gesture. We need this to actually unlock.

**Files:**
- Modify: `src/engine/Audio.ts:149`

**Step 1: Read the current function**

Open `src/engine/Audio.ts` and find the `resumeAudio` function near line 149.

**Step 2: Replace the empty body**

Change:
```typescript
export function resumeAudio(): void {}
```

To:
```typescript
export function resumeAudio(): void {
  // Called on first user gesture to unlock audio on iOS Safari.
  getUiAudioCtx();
  // Prime every pool so AudioElements are "user-gesture authorized".
  for (const pool of pools.values()) {
    for (const audio of pool) {
      audio.muted = true;
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => { audio.muted = false; });
    }
  }
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: compile succeeds with no new TypeScript errors.

**Step 4: Commit**

```bash
git add src/engine/Audio.ts
git commit -m "Implement resumeAudio to unlock AudioContext + prime pools on first gesture"
```

---

### Task 3: Create `MobileBoot.ts` scaffold — feature detection + rotate prompt toggle

**Why:** Establishes the module. Nothing is wired in yet — `main.ts` still ignores it — so desktop is still untouched after this task.

**Files:**
- Create: `src/engine/MobileBoot.ts`
- Create: `tests/engine/MobileBoot.test.ts`

**Step 1: Write the failing test** (feature detection logic only — orientation listeners need browser)

Create `tests/engine/MobileBoot.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { detectTouch } from '@/engine/MobileBoot';

describe('detectTouch', () => {
  beforeEach(() => {
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
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/MobileBoot.test.ts`
Expected: FAIL (module doesn't exist).

**Step 3: Create the module**

Create `src/engine/MobileBoot.ts`:
```typescript
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

export interface MobileBootOptions {
  game: GameManager;
  input: InputManager;
}

/** Initialize all mobile-specific boot logic. Safe to call on desktop (becomes a no-op for non-touch). */
export function initMobile(_opts: MobileBootOptions): void {
  applyTouchClass();
  if (!detectTouch()) return;
  bindOrientation(_opts.game);
  // More wiring added in subsequent tasks.
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine/MobileBoot.test.ts`
Expected: all 3 tests pass.

**Step 5: Confirm `GameManager` has `pause` and `resume` methods**

Run: `grep -n "pause\\|resume" src/game/GameManager.ts | head -20`
Expected: at least one `pause()` or `resume()` method exists. If neither exists, add both as simple setters on game phase (set to Paused, restore prior phase). If they DO exist, the optional chaining in `bindOrientation` handles the case either way — so this is informational only.

**Step 6: Commit**

```bash
git add src/engine/MobileBoot.ts tests/engine/MobileBoot.test.ts
git commit -m "Add MobileBoot scaffold with touch detection and rotate-prompt toggle"
```

---

### Task 4: Add pointer tracking + touch handlers to `MobileBoot`

**Why:** This is the core of the touch UX — pointerdown/up on the D-pad and action buttons call into `InputManager`. Each pointer is tracked by ID so multi-touch (dig-while-running) works correctly.

**Files:**
- Modify: `src/engine/MobileBoot.ts`

**Step 1: Add the touch wiring function**

Edit `src/engine/MobileBoot.ts`. Add this function below `bindOrientation`:

```typescript
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
```

**Step 2: Call it from `initMobile`**

Inside `initMobile`, add after `bindOrientation(_opts.game);`:

```typescript
  bindTouchButtons(_opts.input);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: compiles cleanly.

**Step 4: Commit**

```bash
git add src/engine/MobileBoot.ts
git commit -m "Wire pointer events for D-pad and action buttons with multi-touch support"
```

---

### Task 5: Add finger-slide across D-pad

**Why:** Lode Runner players constantly change direction while climbing ladders or mid-air. Requiring a lift-and-retap between every direction change makes the game feel broken on touch. Finger-slide fixes this.

**Files:**
- Modify: `src/engine/MobileBoot.ts`

**Step 1: Extend `bindTouchButtons` with pointermove handling**

Find `bindTouchButtons` in `src/engine/MobileBoot.ts`. Add this inside the function, just before the `document.querySelectorAll` line:

```typescript
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
```

**Step 2: Register the move handler**

In the same `document.querySelectorAll` block inside `bindTouchButtons`, add:

```typescript
    el.addEventListener('pointermove', handleMove);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: compiles cleanly.

**Step 4: Commit**

```bash
git add src/engine/MobileBoot.ts
git commit -m "Add finger-slide across D-pad for smooth direction changes"
```

---

### Task 6: Add audio unlock + orientation lock on first gesture

**Why:** iOS Safari blocks audio until a user gesture. Same gesture is our best chance to lock orientation. Both are best-effort — they must not throw.

**Files:**
- Modify: `src/engine/MobileBoot.ts`

**Step 1: Add the unlock function**

Add this function in `src/engine/MobileBoot.ts`, above `initMobile`:

```typescript
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
```

**Step 2: Call it from `initMobile`**

Inside `initMobile`, add after `bindTouchButtons(_opts.input);`:

```typescript
  bindFirstGestureUnlock();
```

**Step 3: Verify build**

Run: `npm run build`
Expected: compiles cleanly.

**Step 4: Commit**

```bash
git add src/engine/MobileBoot.ts
git commit -m "Unlock audio and attempt orientation lock on first user gesture"
```

---

### Task 7: Add visibility pause/resume

**Why:** Home-swipe, app switcher, incoming notifications — all these background the PWA. If the game keeps ticking, the player returns to a dead character. Pause on hidden, resume on visible.

**Files:**
- Modify: `src/engine/MobileBoot.ts`

**Step 1: Add the visibility handler**

Add this function below `bindFirstGestureUnlock`:

```typescript
function bindVisibility(game: GameManager): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.pause?.();
    else game.resume?.();
  });
}
```

**Step 2: Call it from `initMobile`**

Inside `initMobile`, add:

```typescript
  bindVisibility(_opts.game);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: compiles cleanly.

**Step 4: Commit**

```bash
git add src/engine/MobileBoot.ts
git commit -m "Pause game on tab/app background and resume on return"
```

---

### Task 8: Update `index.html` CSS — show touch controls, activate rotate prompt, reorder LFV button

**Why:** The HTML scaffold already has all the markup. We just need CSS that reveals it at the right times, plus reorder the right rail so LFV is at the top (prevents fat-finger activation of a precious resource).

**Files:**
- Modify: `index.html` (CSS section, around lines 30–140; HTML section around lines 869–895)

**Step 1: Change the `.touch-controls` display rule**

Find in `index.html` (around line 67):
```css
    .touch-controls {
      display: none;
```

Replace with:
```css
    .touch-controls {
      display: none;
```
**AND** add a new rule just below the `.touch-controls` block (before the `.dpad` rule):
```css
    body.has-touch .touch-controls {
      display: flex;
    }
```

**Step 2: Activate the rotate prompt in portrait**

Find (around line 40):
```css
    #rotate-prompt {
      display: none;
```

Leave the base rule as-is. Add a new rule immediately after `#rotate-prompt .rotate-icon { ... }`:
```css
    body.portrait #rotate-prompt {
      display: flex;
    }
    body.portrait #game-wrapper {
      display: none;
    }
```

**Step 3: Reorder the right-rail action buttons (LFV to top)**

Find in `index.html` (around lines 887–894):
```html
    <div id="touch-right" class="touch-controls">
      <div class="action-buttons">
        <div class="action-btn" data-key="z">DIG<br>LEFT</div>
        <div class="action-btn" data-key=" ">LFV</div>
        <div class="action-btn" data-key="c">DIG<br>RIGHT</div>
      </div>
    </div>
```

Replace with:
```html
    <div id="touch-right" class="touch-controls">
      <div class="action-buttons">
        <div class="action-btn" data-key=" ">LFV</div>
        <div class="action-btn" data-key="z">DIG<br>LEFT</div>
        <div class="action-btn" data-key="c">DIG<br>RIGHT</div>
      </div>
    </div>
```

**Step 4: Commit**

```bash
git add index.html
git commit -m "Show touch controls on has-touch, activate rotate prompt in portrait, move LFV to top of right rail"
```

---

### Task 9: Wire `MobileBoot` into `main.ts` and remove the UA block

**Why:** This is the task that actually flips mobile on. After this commit, mobile works.

**Files:**
- Modify: `src/main.ts` (remove lines 46–63, add MobileBoot import + init)

**Step 1: Remove the UA block**

Open `src/main.ts`. Find this block (around lines 45–63):

```typescript
// ── Mobile Detection ──
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
  document.getElementById('loading-screen')?.remove();
  document.getElementById('menu-screen')!.style.display = 'none';
  document.getElementById('game')!.style.display = 'none';
  const mobileMsg = document.createElement('div');
  mobileMsg.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0a0a0a;z-index:999;gap:16px';
  const title = document.createElement('div');
  title.style.cssText = "font-family:'Brice',sans-serif;font-weight:900;font-size:28px;color:#F5D76E;text-align:center;image-rendering:pixelated";
  title.textContent = 'MOBILE COMING SOON';
  const sub = document.createElement('div');
  sub.style.cssText = "font-family:'Brice',sans-serif;font-weight:700;font-size:14px;color:#888;text-align:center";
  sub.textContent = 'Play on desktop for now';
  mobileMsg.appendChild(title);
  mobileMsg.appendChild(sub);
  document.body.appendChild(mobileMsg);
}
```

Delete it entirely.

**Step 2: Import `initMobile`**

Find the existing `GameManager` import (near the top, around line 6). Add this line after the other `@/engine/*` imports:

```typescript
import { initMobile } from '@/engine/MobileBoot';
```

**Step 3: Initialize MobileBoot after the `GameManager` is created**

Find where `game` is instantiated (around line 65 in the current file, or wherever it ended up after the UA block was removed):

```typescript
const game = new GameManager(input);
const renderer = new Renderer(ctx);
```

Add immediately after those lines:

```typescript
initMobile({ game, input });
```

**Step 4: Verify build**

Run: `npm run build`
Expected: compiles cleanly.

**Step 5: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass.

**Step 6: Desktop smoke test**

With `npm run dev` running: open `http://localhost:3337` in a desktop browser. Load, play Level 1 with keyboard, submit a score. Verify nothing broke for desktop users.
Expected: unchanged desktop experience.

**Step 7: Mobile emulation test**

In Chrome DevTools: toggle device toolbar, select iPhone 14 Pro. Reload `http://localhost:3337`. Rotate to landscape.
Expected:
- No "MOBILE COMING SOON" block.
- In portrait: rotate prompt visible.
- In landscape: D-pad and action buttons visible, game visible.
- Click PLAY with the mouse (DevTools simulates touch). Audio plays.
- Hold ArrowLeft → character moves left. Tap z → digs.

**Step 8: Commit**

```bash
git add src/main.ts
git commit -m "Wire MobileBoot and remove MOBILE COMING SOON UA block"
```

---

### Task 10: Phase 1 deploy + real-device verification

**Why:** Phase 1 is meant to ship mid-week. We push to main (auto-deploys to Vercel) and verify on real devices per the design doc's test matrix.

**Files:** none modified — deployment only.

**Step 1: Push to main**

Run: `git push origin main`
Expected: Vercel webhook triggers an auto-deploy. Check https://vercel.com for build status.

**Step 2: Wait for deploy to finish**

Run: `npx vercel ls vibetown-runner 2>/dev/null | head -5` or just watch the Vercel dashboard.
Expected: new deployment shows "Ready" within ~2 minutes.

**Step 3: Verify on one iPhone and one Android**

On each device, run the Phase 1 test script from `docs/plans/2026-04-21-mobile-pwa-design.md` section "Phase 1 manual tests":
1. Load `vibetownrunner.com` → no MOBILE COMING SOON
2. Portrait → rotate prompt visible
3. Landscape → game playable
4. PLAY → audio starts
5. Complete Level 1 using only touch
6. LFV button works at 100 vibe
7. Drag finger UP → LEFT across D-pad
8. Submit score, see leaderboard
9. Home-swipe → pauses; return → resumes
10. Trigger pointercancel (edge swipe during hold) → no stuck direction

**Step 4: If any test fails, file a fix as a follow-up task**

If anything fails, document it in this plan file under a new "Phase 1 hotfixes" section before continuing to Phase 2.

**Step 5: Phase 1 is complete when all 10 tests pass on at least iPhone + one Android.**

---

# Phase 2 — PWA install polish (Days 3–5)

Goal: proper icons, splash, offline caching, themed install prompt after Level 1. Lighthouse PWA score ≥ 90.

---

### Task 11: Generate icon set and splash screens

**Why:** Current `public/icons/` only has 192 and 512. iOS needs Apple touch icons, maskable icons, and ~10 per-device splash screens. Hand-generating all of these wastes hours; `pwa-asset-generator` does it in minutes from one master.

**Files:**
- Need: one master icon (1024×1024 PNG)
- Need: one master splash (2048×2048 PNG, center-cropped by the generator)
- Create: `public/icons/*.png` (many)
- Create: `public/splash/*.png` (many)

**Step 1: Prepare master images**

The current `public/icons/icon-512.png` can upscale to master temporarily. Ideally Taylor provides a 1024×1024. For now:

Run: `npx --yes pwa-asset-generator public/icons/icon-512.png public/icons --icon-only --background "#0a0a0a" --opaque false --maskable true 2>&1 | tail -30`

Expected: generates icons at 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512 sizes, plus `icon-1024-1024.png` and maskable variants.

**Step 2: Generate splash screens**

Run: `npx --yes pwa-asset-generator public/icons/icon-512.png public/splash --splash-only --background "#0a0a0a" --padding "calc(50vh - 15%) calc(50vw - 15%)" 2>&1 | tail -20`

Expected: ~10 `apple-splash-*.jpg` files in `public/splash/`. The command outputs HTML `<link>` tags — **save the output**, you'll paste them into `index.html` in Task 13.

**Step 3: Verify the files exist**

Run: `ls public/icons/ && ls public/splash/`
Expected: multiple icon PNGs and ~10 splash JPGs.

**Step 4: Commit**

```bash
git add public/icons/ public/splash/
git commit -m "Generate full icon set and iOS splash screens via pwa-asset-generator"
```

---

### Task 12: Update `manifest.json`

**Files:**
- Modify: `public/manifest.json`

**Step 1: Replace the manifest**

Replace the current contents of `public/manifest.json` with:

```json
{
  "name": "Vibetown Runner",
  "short_name": "Vibetown",
  "description": "A GVC-themed Lode Runner game",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "categories": ["games"],
  "icons": [
    { "src": "/icons/manifest-icon-192.maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/manifest-icon-512.maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

**Step 2: Verify paths match what `pwa-asset-generator` actually produced**

Run: `ls public/icons/ | grep -E "192|512|maskable"`
Expected: the filenames referenced above exist. If the generator used different names, update the manifest to match the real filenames.

**Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "Expand manifest with full icon set, scope, and games category"
```

---

### Task 13: Update `index.html` `<head>` with iOS splash + Apple touch icons

**Files:**
- Modify: `index.html` (the `<head>` section)

**Step 1: Paste the generator output into `<head>`**

Find the existing `<link rel="apple-touch-icon" ...>` in `index.html` (around line 10). Replace that line **and** add immediately after it all the `<link>` tags printed by `pwa-asset-generator` in Task 11 Step 2. The output looks like a block of `<link rel="apple-touch-icon" ...>` and `<link rel="apple-touch-startup-image" ...>` tags.

If you lost the output, re-run:
Run: `npx --yes pwa-asset-generator public/icons/icon-512.png public/splash --splash-only --background "#0a0a0a" --path "." 2>&1 | grep "<link"`

**Step 2: Add the `theme-color` meta if absent**

Find the other `<meta>` tags in `<head>`. Add if not already present:
```html
<meta name="theme-color" content="#0a0a0a">
```

**Step 3: Verify the dev server serves the splash images**

With `npm run dev` running: open `http://localhost:3337/splash/` in a browser. You should see a directory listing or a 403 — not a 404 — confirming the files are served.
Expected: files accessible.

**Step 4: Commit**

```bash
git add index.html
git commit -m "Link Apple touch icons and iOS splash screens in <head>"
```

---

### Task 14: Rewrite `service-worker.js` with two-strategy caching

**Files:**
- Modify: `public/service-worker.js`

**Step 1: Replace the entire file contents**

Replace `public/service-worker.js` with:

```javascript
// Vibetown Runner Service Worker
// Strategies:
//   - Stale-while-revalidate: /assets/index-*.{js,css} (hashed bundle)
//   - Cache-first: /assets/sprites/, /assets/tilesets/, /assets/audio/, /assets/backgrounds/, /assets/fonts/
//   - Network-only: Convex RPC, /api/*

const CACHE = 'vibetown-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function isBundle(url) {
  return /\/assets\/index-[^/]+\.(js|css)$/.test(url.pathname);
}

function isCacheableAsset(url) {
  return /\/assets\/(sprites|tilesets|audio|backgrounds|fonts)\//.test(url.pathname)
    || /\/icons\//.test(url.pathname)
    || /\/splash\//.test(url.pathname);
}

function isNetworkOnly(url) {
  return /\.convex\.cloud$/.test(url.hostname) || /^\/api\//.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (isNetworkOnly(url)) return; // default network
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return res;
      }))
    );
    return;
  }
  if (isBundle(url) || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(hit => {
        const fetchPromise = fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return res;
        }).catch(() => hit);
        return hit || fetchPromise;
      })
    );
  }
});
```

**Step 2: Bump the `CACHE` constant whenever the SW changes**

The constant `'vibetown-v1'` becomes `'vibetown-v2'`, etc., on future edits. This ensures clients adopt the new strategy.

**Step 3: Verify syntax**

Run: `node --check public/service-worker.js`
Expected: no output = no syntax errors.

**Step 4: Commit**

```bash
git add public/service-worker.js
git commit -m "Rewrite service worker with SWR bundle + cache-first assets + network-only Convex"
```

---

### Task 15: Build the install prompt card (HTML + CSS)

**Files:**
- Modify: `index.html`

**Step 1: Add the card markup**

Open `index.html`. Find the closing `</div>` of `#game-wrapper` (near the bottom). Add this block immediately after:

```html
<!-- PWA Install Card -->
<div id="install-card" class="install-card hidden" role="dialog" aria-label="Install Vibetown Runner">
  <div class="install-card-inner">
    <img src="/icons/icon-192.png" alt="" class="install-card-icon">
    <div class="install-card-title">INSTALL VIBETOWN RUNNER</div>
    <div class="install-card-body">Add to your home screen to play faster and offline.</div>
    <div class="install-card-actions">
      <button id="install-yes" class="install-btn primary">INSTALL</button>
      <button id="install-no" class="install-btn">NOT NOW</button>
    </div>
  </div>
</div>

<!-- iOS Install Instructions Card -->
<div id="ios-install-card" class="install-card hidden" role="dialog" aria-label="Add to Home Screen">
  <div class="install-card-inner">
    <div class="install-card-title">ADD TO HOME SCREEN</div>
    <div class="install-card-body">
      Tap <strong>Share</strong> below, then <strong>Add to Home Screen</strong>.
    </div>
    <div class="install-card-actions">
      <button id="ios-install-close" class="install-btn primary">GOT IT</button>
    </div>
  </div>
</div>
```

**Step 2: Add the CSS**

In the `<style>` block of `index.html` (before `</style>`), add:

```css
    .install-card {
      position: fixed; inset: 0; z-index: 500;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    }
    .install-card.hidden { display: none; }
    .install-card-inner {
      background: #141414;
      border: 2px solid #F5D76E;
      border-radius: 8px;
      padding: 24px;
      max-width: 320px;
      text-align: center;
      font-family: 'Brice', sans-serif;
    }
    .install-card-icon {
      width: 64px; height: 64px; image-rendering: pixelated;
    }
    .install-card-title {
      color: #F5D76E; font-weight: 900; font-size: 16px; margin: 12px 0 8px;
    }
    .install-card-body {
      color: #D4C5A9; font-size: 12px; line-height: 1.5; margin-bottom: 16px;
    }
    .install-card-actions {
      display: flex; gap: 8px; justify-content: center;
    }
    .install-btn {
      font-family: 'Brice', sans-serif; font-weight: 700; font-size: 11px;
      padding: 8px 16px; border: 1px solid rgba(245,215,110,0.4);
      background: transparent; color: #F5D76E; cursor: pointer; border-radius: 4px;
    }
    .install-btn.primary {
      background: #F5D76E; color: #141414;
    }
```

**Step 3: Commit**

```bash
git add index.html
git commit -m "Add install prompt and iOS add-to-home-screen cards"
```

---

### Task 16: Wire install prompt capture + show-after-level-1

**Files:**
- Modify: `src/engine/MobileBoot.ts`
- Modify: `src/main.ts`

**Step 1: Add the install-prompt logic to `MobileBoot.ts`**

In `src/engine/MobileBoot.ts`, add these helpers above `initMobile`:

```typescript
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
```

**Step 2: Call `captureInstallPrompt` from `initMobile`**

Inside `initMobile`, add before any conditional returns:

```typescript
  captureInstallPrompt();
```

Note: this call should be OUTSIDE the `if (!detectTouch()) return;` check — we want to capture the event on all devices, not just touch.

**Step 3: Wire the trigger from `main.ts`**

In `src/main.ts`, find the existing `game.onLevelComplete = sfxLevelComplete;` line (around line 75). Change it to:

```typescript
import { showInstallPromptIfEligible } from '@/engine/MobileBoot'; // add near top with other imports

// ...

game.onLevelComplete = () => {
  sfxLevelComplete();
  showInstallPromptIfEligible();
};
```

Also find the later `game.onLevelComplete = sfxLevelComplete;` at line 553 and apply the same wrapping.

**Step 4: Build and verify**

Run: `npm run build`
Expected: clean compile.

**Step 5: Commit**

```bash
git add src/engine/MobileBoot.ts src/main.ts
git commit -m "Capture beforeinstallprompt and show install card after level 1 complete"
```

---

### Task 17: Phase 2 deploy + Lighthouse audit

**Files:** none — deploy and verify only.

**Step 1: Push to main**

Run: `git push origin main`
Expected: Vercel deploys.

**Step 2: Wait for deploy, then run Lighthouse**

In Chrome on desktop:
1. Open `https://vibetownrunner.com` in an incognito window.
2. DevTools → Lighthouse tab.
3. Mode: Navigation. Device: Mobile. Categories: check only "Progressive Web App."
4. Run audit.

Expected: PWA score ≥ 90. Capture a screenshot for the spec record.

**Step 3: Address any Lighthouse failures**

Common issues you may hit and their fixes:
- "Does not register a service worker" → SW registration is already in `main.ts:1-4`; verify it's firing on the live site.
- "Icons are not maskable" → verify `"purpose": "maskable"` is set in manifest for at least one icon.
- "Start URL does not respond with 200" → check for console errors at `/`.
- "Does not provide valid `theme_color`" → verify `<meta name="theme-color">` is in `<head>`.

File any fixes as additional commits to main.

**Step 4: Offline test on a real phone**

1. Open `vibetownrunner.com` on the phone, play Level 1 to ensure assets are cached.
2. Enable airplane mode.
3. Close the browser/app.
4. Reopen `vibetownrunner.com`.
Expected: the game loads and is playable.

**Step 5: Install test on a real phone**

1. On iOS Safari: play Level 1 → iOS instructions card appears → dismiss → manually tap Share → Add to Home Screen → verify the installed app launches standalone with correct icon and splash.
2. On Android Chrome: play Level 1 → install card appears → tap INSTALL → verify install completes and PWA launches standalone.

**Step 6: Phase 2 is complete when all 16 Phase 2 manual tests from the design doc pass on at least 3 of the 5 device classes.**

---

## Final cleanup

**Step 1: Update the project `CLAUDE.md` to reflect mobile readiness**

If `CLAUDE.md` still lists "Mobile controls: Touch D-pad exists in HTML but not wired to game logic. Shows 'MOBILE COMING SOON'." under "Known Issues / TODOs," remove it and add a short note under "Architecture" about `MobileBoot.ts`.

**Step 2: Commit the doc update**

```bash
git add CLAUDE.md
git commit -m "Mark mobile PWA as shipped in project docs"
```

**Step 3: Push**

```bash
git push origin main
```

---

## Appendix — common failure modes and recovery

**"Audio doesn't play on iPhone after tapping PLAY."**
Verify `resumeAudio()` is actually being called. Open Safari Web Inspector (connect iPhone → Mac), add a `console.log('audio unlocked')` at the top of `resumeAudio()`, reload, tap PLAY. If the log doesn't appear, the first-gesture listener isn't firing — check that `bindFirstGestureUnlock` is called from `initMobile`.

**"Direction gets stuck after an incoming call / notification on iPhone."**
This is the `pointercancel` handler not firing, or not clearing the right pointerId. Add `console.log` to the `handleUp` handler for `pointercancel` events. Verify the handler is attached to all touch buttons.

**"Service worker won't register — DevTools shows 'SecurityError'."**
Service workers require HTTPS except on `localhost`. On the live site this is fine (Vercel = HTTPS). In local dev, `http://localhost:3337` is allowed by browser as a secure context.

**"Lighthouse says 'No maskable icon available'."**
The manifest must reference an icon with `"purpose": "maskable"`. Verify the file the manifest points to was actually generated with the maskable flag (look for transparent padding in the image).

**"Rotate prompt flickers on/off during orientation change."**
The `matchMedia` change event on iOS Safari sometimes fires multiple times during rotation. Add a `requestAnimationFrame` guard around the body class toggle to debounce visually.

**"D-pad finger-slide works on Android but feels broken on iOS."**
iOS Safari has historically had quirks with `document.elementFromPoint` during active gestures. Verify that `setPointerCapture` is NOT held during the move — pointer capture locks events to the original element, which defeats finger-slide. The current implementation uses `setPointerCapture?.()` with optional chaining; if this turns out to misbehave on iOS, remove that line entirely.

---

## Plan complete

Saved to `docs/plans/2026-04-21-mobile-pwa-implementation.md`.
