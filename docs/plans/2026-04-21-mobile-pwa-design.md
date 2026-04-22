# Mobile PWA — Design Doc

**Date:** 2026-04-21
**Status:** Approved (awaiting implementation plan)
**Supersedes:** `2026-03-20-mobile-controls-design.md` (partially shipped — HTML scaffold exists, game logic still blocks mobile via UA sniff)
**Target ship window:** This week. Phase 1 Mon–Tue, Phase 2 Wed–Fri.

---

## Goal

Take Vibetown Runner from "MOBILE COMING SOON" placeholder to a playable, installable PWA on iOS and Android. Two sequential phases in one week:

- **Phase 1 — Unblock mobile.** Game plays on phones via touch controls. End state: `vibetownrunner.com` is actually useful on a phone.
- **Phase 2 — PWA install polish.** Proper icons, splash screens, offline play, themed install prompt. End state: Lighthouse PWA score ≥ 90, installable from Safari/Chrome and launches standalone.

**Phase 3 (explicitly out of scope this week)** — menu reflow, leaderboard name-entry rework, brand-token adoption (Mundial + shaka + GVC color audit), perf tuning for older Android. Scoped separately after Phase 2 ships and generates real-user data.

## Non-goals

- **No native app (iOS App Store / Play Store).** Architected so Capacitor wrap is a 1–2 day future option, but we don't do it now.
- **No wallet connect / GVC wallet-based auth.** Parked as Phase 2+ option. Current Convex-backed username/password auth stays.
- **No game logic changes.** Zero touches to `GameManager`, `Player`, `Physics`, `Duck`, `Dig`, `Renderer`, levels, or Convex schemas.
- **No redesign of menus or leaderboard UX for mobile.** They'll be small but functional.
- **No new runtime dependencies.** `pwa-asset-generator` is used at setup time, its output is committed, it doesn't ship in the bundle.

---

## Locked decisions (from brainstorming session)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Scope | PWA-first, Capacitor-optional later | Lowest-friction distribution (URL share on X/Discord), preserves store-listing optionality |
| 2 | Orientation | Landscape-locked + rotate prompt | Preserves 28×20 grid and all existing levels; matches mobile-arcade convention |
| 3 | Input model | D-pad (4) + action buttons (3) in side rails; LFV at top of right rail; finger-slide across D-pad; Android haptics | Grid movement is binary → D-pad > joystick; side rails preserve full grid visibility; LFV-to-top prevents fat-finger misfires |
| 4 | GVC integration | None in Phase 1/2. Wallet connect and GVC badge leaderboard parked. | Not the fastest path to a working mobile experience; adds a 2–3 day WalletConnect rabbit hole |
| 5 | Ship scope | Phase 1 (unblock) + Phase 2 (install polish) this week; Phase 3 later | Phase 1 alone removes the embarrassing mobile-block page; Phase 2 adds install UX after real usage shapes the polish work |

---

## Architecture

Three subsystems change. Game logic is untouched.

### Subsystem A — Input pipeline (modified, small)

`InputManager` gains two new methods:

```ts
pressTouch(key: string): void
releaseTouch(key: string): void
```

Internally these call the existing `handleKeyDown` / `handleKeyUp`. The distinction is semantic — they let pointer handlers stay decoupled from the keyboard listener code path, and make the call sites scannable. Existing getters (`.left`, `.right`, `.digLeft`, `.activateLFV`, etc.) work unchanged; they read from the same `Set<string>` of pressed keys regardless of source.

### Subsystem B — PWA shell (modified + rewritten)

- `public/service-worker.js` rewritten from the current placeholder to a real two-strategy SW:
  - **Stale-while-revalidate** for the JS/CSS bundle (`/assets/index-*.{js,css}`).
  - **Cache-first** for sprites, tilesets, audio, fonts, backgrounds (large immutable assets).
  - **Network-only** for Convex RPC calls and `/api/*` (leaderboard must never be stale).
- `public/manifest.json` expanded: full icon array, `scope`, `categories: ["games"]`, iOS-specific additions.
- `index.html` `<head>` gains Apple touch icons and per-resolution iOS splash screen links.

### Subsystem C — `MobileBoot.ts` (new, ~80 lines)

One new module in `src/engine/MobileBoot.ts` centralizing every piece of mobile-specific logic:

- **Feature detection.** On boot: sets `body.has-touch` iff `('ontouchstart' in window) || navigator.maxTouchPoints > 0`. CSS reveals `.touch-controls` only when this class is present.
- **Rotate prompt toggle.** `matchMedia('(orientation: portrait)')` change listener adds/removes `body.portrait`; CSS uses that to show `#rotate-prompt`. `GameManager.pause()`/`resume()` wired to the same transitions.
- **Orientation lock.** Best-effort `screen.orientation.lock('landscape')` on first user gesture. Silently fails on iOS Safari (no API support) — rotate prompt handles that case.
- **Audio unlock.** On first user gesture, call `Audio.unlock()` to `resume()` the `AudioContext`. Retries silently on next gesture if the promise rejects.
- **Pointer tracking.** A `Map<pointerId, string>` maps active pointer IDs to pressed keys. `pointerdown` adds; `pointerup`/`pointercancel` remove. Multi-touch falls out naturally (each finger has its own pointerId).
- **Finger-slide on D-pad.** `pointermove` handler runs `document.elementFromPoint` → if the target button changed since last move, it releases the prior key and presses the new one without the user lifting their finger.
- **Install prompt capture.** `beforeinstallprompt` event captured and stashed; fired on level 1 complete (via `GameManager.onLevelComplete` subscription). iOS fallback: detect `navigator.standalone === false && isIOS && !localStorage.installDismissed`, show themed "Add to Home Screen" instructions card on same trigger.
- **App visibility.** `document.visibilitychange` → pause on hidden (home swipe, app switcher), resume on visible.

### What's explicitly not touched

`GameLoop`, `GameManager`, `Renderer`, `Player`, `Physics`, `Duck`, `Dig`, `VibeMeter`, `Scoring`, `Weather`, `Level`, `LevelGenerator`, `Projectile`, all of `convex/`, `Themes`, `SpriteSheet`, `Audio` (except adding a public `unlock()` method if one doesn't exist), and all 25 level JSON files.

---

## File-level changes

| File | Status | Change |
|---|---|---|
| `src/engine/Input.ts` | modified | Add `pressTouch(key)` / `releaseTouch(key)` methods (~15 lines) |
| `src/engine/MobileBoot.ts` | **NEW** | Feature detection, rotate prompt, orientation lock, audio unlock, pointer tracking, finger-slide, install prompt, visibility handling (~80 lines) |
| `src/engine/Audio.ts` | modified (only if needed) | Expose public `unlock()` that calls `AudioContext.resume()` if not already exposed |
| `src/main.ts` | modified | Remove UA block at `:46-63`. Import + initialize `MobileBoot`. Wire `onLevelComplete` subscriber for install prompt. |
| `index.html` | modified | CSS: `.touch-controls { display: none }` → `body.has-touch .touch-controls { display: flex }`. Rotate prompt activated via `body.portrait`. Right-rail button order: LFV / DIG-LEFT / DIG-RIGHT. Add `<head>` tags for Apple touch icons + iOS splash screens. |
| `public/manifest.json` | modified | Full icon array (72, 96, 128, 144, 152, 192, 384, 512, 1024), maskable variants, `scope: "/"`, `categories: ["games"]` |
| `public/service-worker.js` | rewritten | ~60 lines. Install event precaches manifest + shell. Fetch handler routes by URL pattern to SWR / cache-first / network-only |
| `public/icons/` | expanded | Generated via `pwa-asset-generator`. 9 standard sizes + maskable variants + Apple touch icon (180) + favicons |
| `public/splash/` | **NEW directory** | ~10 iOS device-resolution splash images, generated, committed |
| `tests/` | none | No new tests required — we're not touching game logic and existing Vitest suite must still pass |

**Estimated delta:** ~200 net lines of TypeScript/CSS added; ~20 lines removed (the UA block). Plus generated image assets (one-time commit).

---

## Phase split

### Phase 1 — "Unblock mobile" (Days 1–2, ships to prod at end)

In scope:
- Remove UA block (`main.ts:46-63`)
- Create `MobileBoot.ts` (feature detect, rotate prompt, audio unlock, orientation lock, pointer tracking, finger-slide)
- Extend `InputManager` with `pressTouch` / `releaseTouch`
- Wire touch handlers to D-pad and action buttons
- CSS: show `.touch-controls` on `body.has-touch`, activate rotate prompt on `body.portrait`, reorder right rail (LFV to top)
- Smoke-test on two real devices (one iPhone, one Android)
- Deploy to `vibetownrunner.com` via Vercel

Out of Phase 1: icon set beyond current 192/512, splash screens, install prompt, offline caching, perf tuning.

**Exit criteria:**
1. No "MOBILE COMING SOON" page on any mobile UA.
2. Portrait → rotate prompt shown; landscape → game playable.
3. Touch D-pad and action buttons functional, including finger-slide between D-pad directions.
4. Audio plays after first user tap.
5. LFV activates correctly on touch.
6. Score submits successfully from mobile.
7. No regressions on desktop play-through.

### Phase 2 — "PWA install polish" (Days 3–5, ships to prod at end)

In scope:
- Generate full icon set via `pwa-asset-generator` from one 1024×1024 master
- Generate iOS splash screens (~10 resolutions)
- Expand `manifest.json` (icons, scope, categories, shortcuts)
- Rewrite `service-worker.js` (stale-while-revalidate + cache-first strategies)
- Implement `beforeinstallprompt` capture + themed install card shown after level 1 complete
- Implement iOS "Add to Home Screen" fallback card (same trigger)
- Verify offline-capable play (airplane mode test)
- Lighthouse PWA audit ≥ 90

Out of Phase 2: menu reflow, leaderboard UX rework, brand tokens, perf tuning.

**Exit criteria:**
1. Lighthouse PWA score ≥ 90 on mobile simulation (screenshot in PR).
2. Installed PWA launches in standalone mode with correct icon and splash.
3. Airplane-mode cold start loads and plays in under 3 seconds from cache.
4. Install prompt card triggers post-level-1; accepting installs the PWA successfully.
5. iOS instructions card appears for iOS users at the same trigger.
6. No regressions vs Phase 1.

---

## Data flow

### Touch press → game action

```
finger lands on .dpad-btn[data-key="ArrowLeft"]
  → pointerdown → pointerIdMap.set(e.pointerId, 'ArrowLeft')
                → InputManager.pressTouch('ArrowLeft')
  → GameManager.update(dt): input.left is true
  → Player moves left this tick
finger lifts
  → pointerup → pointerIdMap.get(e.pointerId) returns 'ArrowLeft'
              → InputManager.releaseTouch('ArrowLeft')
              → pointerIdMap.delete(e.pointerId)
```

### Finger-slide across D-pad

```
finger on UP starts moving toward LEFT
  → pointermove fires repeatedly
  → document.elementFromPoint(x, y) → .dpad-btn[data-key="ArrowLeft"]
  → if target key differs from pointerIdMap.get(e.pointerId):
       InputManager.releaseTouch(oldKey)
       InputManager.pressTouch(newKey)
       pointerIdMap.set(e.pointerId, newKey)
  → no lift required; direction flows smoothly
```

### Multi-touch dig-while-moving (load-bearing mechanic)

```
left thumb on ArrowLeft (pointerId=1), right thumb taps 'z' (pointerId=2)
  → each pointer has its own entry in pointerIdMap
  → both keys in InputManager keys Set
  → GameManager sees input.left AND input.digLeft → Player digs while running
  → if user lifts right thumb: only 'z' released, ArrowLeft remains
```

### Install prompt lifecycle

```
[page load]
  window 'beforeinstallprompt' event
    → e.preventDefault()
    → installPromptEvent = e (stashed)

[player completes level 1]
  GameManager.onLevelComplete fires
    → MobileBoot subscriber checks:
       - if installPromptEvent: show themed install card
         - on YES: installPromptEvent.prompt(), await userChoice, clear stash
         - on NO: localStorage.installDismissed = '1', never show again
       - elif isIOS && !navigator.standalone && !localStorage.installDismissed:
         - show "Add to Home Screen" instructions card with arrow pointing to Safari share button
```

### Service worker cache

```
[first visit]
  SW install: precache index.html, manifest.json, service-worker.js
  runtime fetch sprites/audio/fonts/tilesets/backgrounds:
    → cache-first: check cache → miss → fetch from network → cache response → return
  runtime fetch /assets/index-HASH.js:
    → stale-while-revalidate: return cached (if any) immediately → background fetch → update cache
  runtime fetch Convex URL or /api/*:
    → network-only: no caching

[subsequent visit, online]
  bundle served from cache instantly; fresh bundle fetched in background; applied on next reload
  assets served from cache (content-hashed filenames mean cache is self-busting on real change)

[subsequent visit, offline]
  bundle served from cache
  assets served from cache
  Convex calls fail → leaderboard submission queued or shown as "offline" message
```

### Orientation change

```
user rotates phone to portrait
  → matchMedia('(orientation: portrait)') change event
  → body.classList.add('portrait')
  → CSS: #rotate-prompt becomes visible, #game-wrapper hidden
  → GameManager.pause() called

user rotates back to landscape
  → same matcher fires, matches = false
  → body.classList.remove('portrait')
  → CSS: prompt hidden, game visible
  → GameManager.resume() called → game picks up exactly where paused
```

---

## Error handling

| # | Failure mode | Detection | Recovery |
|---|---|---|---|
| 1 | `AudioContext.resume()` rejects on iOS (first-load edge case) | `.resume().catch(...)` | Retry silently on next user gesture; never surface to UI |
| 2 | `screen.orientation.lock()` unsupported (iOS Safari) or rejected | try/catch | Silently swallow; rotate prompt serves as fallback UX |
| 3 | Service worker registration fails (older browsers, local file protocol) | `.register().catch(...)` | Log to console; app continues without offline |
| 4 | `beforeinstallprompt` never fires (iOS Safari; some Android edge cases) | Boolean flag checked on install-card trigger | Show iOS-style "Add to Home Screen" instructions card instead |
| 5 | **`pointercancel`** — phone call, edge swipe, or notification interrupts active touch | `pointercancel` event on any tracked pointer | Release that specific pointer's key; leave other pointers untouched. **Critical to prevent "stuck direction" bug.** |
| 6 | User backgrounds the app mid-game | `document.visibilitychange` → hidden | Pause GameManager; on visible, resume |
| 7 | Multi-touch with simultaneous D-pad + action button | Each pointer tracked by `pointerId` | Each pointer gets its own entry in `pointerIdMap`; finger-lift releases only that finger's key |
| 8 | `document.elementFromPoint` returns null during finger-slide (pointer off-screen or over non-button) | Defensive null check | No-op; keep current pressed key until pointer returns to a button or lifts |
| 9 | Install prompt shown but user navigates away before deciding | `userChoice` promise never resolves | Clear stashed event on next page load; don't retry install card same session |

**Two load-bearing ones: #5 (pointercancel) and #7 (multi-touch via `pointerId` tracking).** These determine whether the game feels broken on real devices. Both are standard `PointerEvent` API patterns — no hacks required.

---

## Testing + verification

### Manual device test matrix

| Device class | Target | Why |
|---|---|---|
| iPhone — flagship | iPhone 14+ / Safari 17+ | Expected majority share of audience |
| iPhone — small screen | iPhone SE 3rd gen or 13 mini | D-pad sizing sanity on 4.7" class |
| iPad | iPad 9th+ / Safari | Hybrid touch/keyboard; `has-touch` feature-detect edge case |
| Android — flagship | Pixel 7+ / Chrome | Different `PointerEvent` quirks from Safari |
| Android — mid-range | 3-year-old Samsung / Chrome | Perf floor (60fps target) |

### Phase 1 manual tests (run on each device)

1. Load `vibetownrunner.com` → no "MOBILE COMING SOON" block
2. Portrait → rotate prompt visible
3. Rotate to landscape → prompt hides, menu visible
4. Tap PLAY → audio starts (SFX audible on click)
5. Complete Level 1 via touch only — move, climb ladder, dig, collect badge
6. Reach 100 vibe, tap LFV button → LFV activates
7. Drag finger UP → LEFT across D-pad without lifting → direction changes smoothly
8. Submit score → leaderboard entry persists
9. Background app mid-game (home swipe) → game pauses; return → resumes
10. Trigger `pointercancel` via edge swipe during direction hold → no stuck direction

### Phase 2 manual tests (additive)

11. Lighthouse mobile audit in Chrome DevTools → PWA score ≥ 90
12. Complete Level 1 → install card appears
13. Accept install → PWA installs; launches standalone; correct icon on home screen
14. Airplane mode → close app → relaunch → loads and plays offline
15. iOS splash → correct per-device image during launch; no white flash
16. Submit score while offline → queued or graceful offline message (either acceptable)

### Automated verification

- `npm run build` — TypeScript compiles with zero new errors; no `any` escapes introduced
- `npm run test` — Vitest suite passes unchanged (we haven't touched game logic, so no test changes should be needed)

### Definition of done

**Phase 1:**
- Deployed to `vibetownrunner.com` via Vercel
- All 10 Phase 1 tests pass on at least iPhone flagship + one Android
- No regressions on desktop (quick play-through)
- Taylor has played a level on his phone

**Phase 2:**
- Deployed to `vibetownrunner.com`
- All 16 tests pass on at least 3 of the 5 device classes
- Lighthouse PWA ≥ 90 (screenshot captured)
- Install card triggers correctly; installed PWA launches standalone
- Taylor has installed the PWA and played at least one full level offline

---

## Risks and open questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mid-range Android can't hold 60fps | Medium | We already use Canvas 2D with no shaders; worst case we ship anyway and tune in Phase 3. Perf is a Phase 3 concern by design. |
| iOS Safari PWA quirks (e.g., service worker scope oddities) | Medium | Test on real iPhone early in Phase 2. Keep SW simple (~60 lines) for auditability. |
| `pwa-asset-generator` output needs brand polish | Low | It generates from our master source; quality matches source. If needed, we tweak the master once and re-run. |
| Phase 1 takes longer than 2 days | Medium | Phase 1 is explicitly the "dumb version" — if we slip into day 3, we still cut Phase 2 scope before pushing Phase 1 later. |
| "MOBILE COMING SOON" UA block may be a belt-and-suspenders flag somewhere else | Low | One grep confirmed it's only in `main.ts:46-63`. We remove it there and verify no other UA sniffs exist. |

**Open items (non-blocking):**
- Does Taylor have custom pixel-art D-pad sprites from the March 20 plan? If yes, drop them in during Phase 1; if no, proceed with current Unicode arrow glyphs (acceptable).
- Should Phase 2 include Vercel Web Analytics to start generating data for Phase 3 scoping? (Recommended yes — free, one line of code.)

---

## Deferred to Phase 3

These are all real work, but explicitly out of scope this week:

- Menu screen reflow for portrait and narrow-landscape phone widths
- Leaderboard name-entry UX rework (avoid virtual keyboard popping over the game viewport)
- Settings panel layout for mobile
- Brand token adoption from `create-gvc-app` (Mundial font, shaka asset, GVC color audit)
- Performance tuning for 3-year-old Android devices
- Optional wallet-connect + GVC badge leaderboard integration (if product direction favors it after Phase 2 data)
- Haptic tuning (Android-only; iOS doesn't support web haptics)

---

## What changed from the March 20 mobile-controls design

The March doc (`2026-03-20-mobile-controls-design.md`) covered roughly the same touch-control layout but stalled with only HTML/CSS scaffolding. This doc supersedes it with:

- Explicit `pressTouch` / `releaseTouch` methods on `InputManager` (rather than hijacking `handleKeyDown` / `handleKeyUp`)
- **New:** `MobileBoot.ts` module as the single home for mobile-specific logic
- **New:** multi-touch via `pointerId` tracking (the March doc didn't cover concurrent finger-held direction + button)
- **New:** finger-slide across D-pad (critical for ladder / mid-air direction changes)
- **New:** `pointercancel` handling
- **New:** LFV button moved to top of right rail to prevent fat-finger activation
- **New:** entire Phase 2 (icons, splash, service worker, install prompt UX, offline)
- **New:** explicit test matrix + exit criteria per phase
