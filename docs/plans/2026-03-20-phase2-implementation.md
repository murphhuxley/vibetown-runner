# Phase 2: Juice & Feedback — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every action in Vibetown Runner feel impactful through visual and audio feedback — floating score popups, trap timer on ducks, duck escape animation, screen shake on death, vibe meter pulse, and landing dust particles.

**Architecture:** Changes span Renderer (new draw methods), GameManager (new callbacks), and main.ts (wiring). The existing Confetti particle system provides the pattern for new effects.

**Tech Stack:** TypeScript, HTML5 Canvas, Vitest

---

### Task 1: Floating Score Popups

**Files:**
- Create: `src/game/ScorePopup.ts`
- Modify: `src/engine/Renderer.ts` (add drawScorePopups method)
- Modify: `src/game/GameManager.ts` (emit popups on badge collect, duck trap/kill)
- Modify: `src/main.ts` (pass popups to renderer)

**Implementation:**

ScorePopup.ts — lightweight particle:
```typescript
export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  elapsed: number;
  duration: number;
}

export function createScorePopup(x: number, y: number, text: string, color: string): ScorePopup {
  return { x, y, text, color, elapsed: 0, duration: 1000 };
}

export function updateScorePopups(popups: ScorePopup[], dt: number): ScorePopup[] {
  return popups.filter(p => {
    p.elapsed += dt;
    return p.elapsed < p.duration;
  });
}
```

Renderer — new method drawScorePopups:
- Draw each popup at `(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE - elapsed * 0.03)` (floats up)
- Alpha: `1 - elapsed / duration` (fades out)
- Font: bold 12px Brice, color from popup
- Green (#5AE05A) for badge collect, red (#E05A5A) for kills, gold (#F5D76E) for traps

GameManager — add `scorePopups: ScorePopup[]` array, push on badge/trap/kill events.

main.ts — call `renderer.drawScorePopups(game.scorePopups)` after drawing entities, call `game.scorePopups = updateScorePopups(game.scorePopups, dt)` in update.

---

### Task 2: Trap Timer Visual on Ducks

**Files:**
- Modify: `src/engine/Renderer.ts` (enhance drawDuck for trapped state)

**Implementation:**

When a duck is trapped, draw a small progress bar above the duck sprite showing time remaining before escape.

In `drawDuck()`, when `isTrapped` is true, after drawing the duck sprite:
- Bar width: `TILE_SIZE * 0.6` centered above duck
- Bar height: 3px
- Background: rgba(0,0,0,0.5)
- Fill: green → yellow → red based on `trapTimer / DUCK_TRAP_ESCAPE_TIME`
  - >66% = green (#4CAF50)
  - >33% = yellow (#FFC107)
  - ≤33% = red (#F44336)
- Position: 4px above duck sprite top

Requires passing `trapTimer` to drawDuck — update the signature to accept it.

---

### Task 3: Screen Shake on Death

**Files:**
- Modify: `src/engine/Renderer.ts` (add shake state and method)
- Modify: `src/main.ts` (trigger shake on death, apply in render)

**Implementation:**

Renderer — add properties and methods:
```typescript
private shakeTimer = 0;
private shakeIntensity = 0;

triggerShake(intensity: number, duration: number): void {
  this.shakeIntensity = intensity;
  this.shakeTimer = duration;
}

updateShake(dt: number): { dx: number; dy: number } {
  if (this.shakeTimer <= 0) return { dx: 0, dy: 0 };
  this.shakeTimer -= dt;
  const progress = this.shakeTimer / 200; // 200ms default duration
  const magnitude = this.shakeIntensity * progress;
  return {
    dx: (Math.random() - 0.5) * 2 * magnitude,
    dy: (Math.random() - 0.5) * 2 * magnitude,
  };
}
```

main.ts — in render function, before drawing anything:
```typescript
const shake = renderer.updateShake(lastDt);
ctx.save();
ctx.translate(shake.dx, shake.dy);
// ... all rendering ...
ctx.restore();
```

Trigger on death: `renderer.triggerShake(4, 200)` when game.onDeath fires.

---

### Task 4: Vibe Meter Pulse When Ready

**Files:**
- Modify: `src/engine/Renderer.ts` (enhance drawHUD vibe meter section)

**Implementation:**

When `vibeMeter.meter >= VIBE_MAX` and LFV hasn't been used, pulse the meter bar:
- Scale the bar height by `1 + Math.sin(bgTime * 8) * 0.15` (subtle throb)
- Add a glow overlay: second fillRect with gold at 20% opacity, slightly larger
- The "LFV READY!" text already exists — make it pulse alpha: `0.7 + Math.sin(bgTime * 6) * 0.3`

---

### Task 5: Landing Dust Particles

**Files:**
- Create: `src/game/LandingDust.ts`
- Modify: `src/engine/Renderer.ts` (add drawLandingDust method)
- Modify: `src/game/GameManager.ts` (fire onLand callback)
- Modify: `src/main.ts` (wire landing to dust effect)

**Implementation:**

The `onLand` callback is already declared on GameManager but never fired. Wire it up.

GameManager — in `updatePlayer()`, track previous falling state:
```typescript
const wasFalling = player.isFalling;
// ... existing movement logic ...
if (wasFalling && !player.isFalling) {
  this.onLand?.();
}
```

LandingDust.ts — simple particle system:
```typescript
export interface DustParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

export function createLandingDust(x: number, y: number): DustParticle[] {
  const particles: DustParticle[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 30 + Math.random() * 40;
    particles.push({
      x: x * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * 8,
      y: y * TILE_SIZE + TILE_SIZE - 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      life: 300 + Math.random() * 150,
      maxLife: 300 + Math.random() * 150,
      size: 2 + Math.random() * 2,
    });
  }
  return particles;
}
```

Renderer — drawLandingDust: simple filled circles with fading alpha.

---

### Task 6: Duck Escape Warning Animation

**Files:**
- Modify: `src/engine/Renderer.ts` (enhance drawDuck trapped rendering)

**Implementation:**

When a trapped duck's `trapTimer` is below 800ms (last ~25% of escape time), make the duck sprite bob up and down rapidly to signal imminent escape:

In `drawDuck()` when trapped and `trapTimer < 800`:
- Add vertical offset: `Math.sin(elapsed * 15) * 2` pixels (fast bobbing)
- This gives a visible "struggling" effect without needing new sprite frames

---

### Task 7: Integration Test & Deploy

Run full test suite, TypeScript check, push, deploy to Vercel.
