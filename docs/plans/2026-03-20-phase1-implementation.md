# Phase 1: Balance & Feel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tune game balance, wire up weather speed modifiers, improve duck AI, and rebalance scoring to make Vibetown Runner more challenging and addictive.

**Architecture:** All changes are in existing files — constants, Weather, Duck, Scoring, GameManager. No new files needed. Each task is independent and testable.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Score Rebalance (constants.ts)

**Files:**
- Modify: `src/constants.ts:30-35`
- Modify: `tests/game/Scoring.test.ts` (tests use constants, will auto-update)

**Step 1: Update score constants**

In `src/constants.ts`, change:
```typescript
export const SCORE_BADGE = 500;          // was 250
export const SCORE_TRAP_DUCK = 100;      // was 75
export const SCORE_KILL_DUCK = 100;      // was 75
export const SCORE_LEVEL_COMPLETE = 2_000; // was 1_500
export const SCORE_LFV_BONUS = 1_000;    // was 2_000
```

**Step 2: Run tests to verify nothing breaks**

Run: `npx vitest run`
Expected: All tests pass (Scoring tests reference constants, so they auto-update)

**Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "Rebalance scoring: badges 500, kills 100, LFV bonus 1000"
```

---

### Task 2: Shadow Funk Premium Kill Score

**Files:**
- Modify: `src/constants.ts` (add SCORE_POWER_KILL)
- Modify: `src/game/Scoring.ts` (add powerKillDuck function)
- Modify: `src/game/GameManager.ts` (use powerKillDuck for projectile kills)
- Modify: `tests/game/Scoring.test.ts` (add test for power kill)

**Step 1: Add constant and scoring function**

In `src/constants.ts`, add after SCORE_KILL_DUCK:
```typescript
export const SCORE_POWER_KILL = 150;
```

In `src/game/Scoring.ts`, add:
```typescript
import { ..., SCORE_POWER_KILL } from '@/constants';

export function powerKillDuck(s: ScoringState): void {
  s.score += SCORE_POWER_KILL;
}
```

**Step 2: Write test for power kill scoring**

In `tests/game/Scoring.test.ts`, add:
```typescript
import { ..., powerKillDuck } from '@/game/Scoring';
import { ..., SCORE_POWER_KILL } from '@/constants';

it('awards premium points for power helmet kill', () => {
  const s = createScoring();
  powerKillDuck(s);
  expect(s.score).toBe(SCORE_POWER_KILL);
});
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Wire into GameManager**

In `src/game/GameManager.ts`, import `powerKillDuck` as `scorePowerKill`:
```typescript
import { ..., powerKillDuck as scorePowerKill } from '@/game/Scoring';
```

In the `killDuck` method (~line 621), check if power helmet is active:
```typescript
if (this.state.powerHelmetActive) {
  scorePowerKill(this.scoring);
} else {
  scoreKill(this.scoring);
}
```

**Step 5: Run tests and commit**

Run: `npx vitest run`
```bash
git add src/constants.ts src/game/Scoring.ts src/game/GameManager.ts tests/game/Scoring.test.ts
git commit -m "Add premium 150pt score for shadow funk kills"
```

---

### Task 3: Power Helmet Spawn Rate

**Files:**
- Modify: `src/game/GameManager.ts:656-658`

**Step 1: Update spawn logic**

In `resolvePowerHelmetSpawn`, change:
```typescript
if (levelId <= 5) return null;        // was <= 3
if (spawnRoll > 0.25) return null;    // was > 0.35
```

**Step 2: Run tests and commit**

Run: `npx vitest run`
```bash
git add src/game/GameManager.ts
git commit -m "Power helmet: 25% spawn rate after level 5 (was 35% after 3)"
```

---

### Task 4: Weather Speed Modifiers

**Files:**
- Modify: `src/game/Weather.ts:10-18`
- Modify: `tests/game/Weather.test.ts`

**Step 1: Update weather tests first**

Replace the weather speed tests in `tests/game/Weather.test.ts`:
```typescript
it('no modifier for none weather', () => {
  expect(getSpeedMultiplier(WeatherType.None, 'player')).toBe(1);
  expect(getSpeedMultiplier(WeatherType.None, 'duck')).toBe(1);
});

it('sunshine speeds up both player and ducks', () => {
  expect(getSpeedMultiplier(WeatherType.Sunshine, 'player')).toBe(1.15);
  expect(getSpeedMultiplier(WeatherType.Sunshine, 'duck')).toBe(1.15);
});

it('rain slows both player and ducks', () => {
  expect(getSpeedMultiplier(WeatherType.Rain, 'player')).toBe(0.8);
  expect(getSpeedMultiplier(WeatherType.Rain, 'duck')).toBe(0.8);
});

it('trade winds slow ducks but not player', () => {
  expect(getSpeedMultiplier(WeatherType.TradeWinds, 'player')).toBe(1);
  expect(getSpeedMultiplier(WeatherType.TradeWinds, 'duck')).toBe(0.75);
});

it('high tide has no speed effect', () => {
  expect(getSpeedMultiplier(WeatherType.HighTide, 'player')).toBe(1);
  expect(getSpeedMultiplier(WeatherType.HighTide, 'duck')).toBe(1);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/game/Weather.test.ts`
Expected: FAIL (sunshine/rain/tradewinds return 1 instead of expected values)

**Step 3: Implement weather speed modifiers**

Replace `getSpeedMultiplier` in `src/game/Weather.ts`:
```typescript
export function getSpeedMultiplier(
  weather: WeatherType,
  entity: 'player' | 'duck'
): number {
  switch (weather) {
    case WeatherType.Sunshine:
      return 1.15;
    case WeatherType.Rain:
      return 0.8;
    case WeatherType.TradeWinds:
      return entity === 'duck' ? 0.75 : 1;
    default:
      return 1;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/game/Weather.ts tests/game/Weather.test.ts
git commit -m "Wire up weather speed modifiers: sunshine 1.15x, rain 0.8x, trade winds slow ducks"
```

---

### Task 5: Duck AI — Chase Acceleration

**Files:**
- Modify: `src/game/GameManager.ts` (duck movement tick logic)

**Step 1: Add chase acceleration to duck movement**

In `GameManager.ts`, the duck movement section (~line 263-280). Replace the fixed interval with per-duck acceleration when on same row and close to player:

Change the duck update loop. Instead of a single `duckMoveAccum >= DUCK_MOVE_INTERVAL` check, compute an effective interval per tick that's faster when any duck is chasing on the same row:

```typescript
// Duck movement
const duckWeatherMult = getSpeedMultiplier(this.state.weather, 'duck');
// Chase acceleration: if any duck is on same row within 8 tiles, speed up 20%
const chasing = this.state.ducks.some(d =>
  !d.isTrapped &&
  d.pos.y === this.state.player.pos.y &&
  Math.abs(d.pos.x - this.state.player.pos.x) <= 8
);
const effectiveDuckInterval = chasing ? this.DUCK_MOVE_INTERVAL * 0.8 : this.DUCK_MOVE_INTERVAL;
this.duckMoveAccum += dt * duckWeatherMult;
if (this.duckMoveAccum >= effectiveDuckInterval) {
  this.duckMoveAccum = 0;
```

Also update the render interpolation to use the effective interval:
```typescript
if (this.duckRenderProgress < 1) {
  this.duckRenderProgress = Math.min(this.duckRenderProgress + dt / effectiveDuckInterval, 1);
}
```

Note: `effectiveDuckInterval` needs to be stored as an instance variable so the render interpolation can access it outside the movement tick. Add:
```typescript
private currentDuckInterval = 250;
```
Set it each frame before the duck movement check, then use it in the render interpolation.

**Step 2: Run tests and commit**

Run: `npx vitest run`
```bash
git add src/game/GameManager.ts
git commit -m "Duck AI: 20% faster when chasing player on same row within 8 tiles"
```

---

### Task 6: Duck AI — Random Hesitation

**Files:**
- Modify: `src/game/Duck.ts` (moveDuckToward function)
- Modify: `tests/game/Duck.test.ts` (add hesitation test)

**Step 1: Add hesitation to duck movement**

In `src/game/Duck.ts`, at the top of `moveDuckToward`, after the trapped check, add a hesitation roll:

```typescript
export function moveDuckToward(
  duck: DuckState,
  grid: TileType[][],
  playerPos: Position,
  otherDucks: DuckState[],
  hesitationChance = 0.15
): DuckState {
  if (duck.isTrapped) return duck;

  // Random hesitation — duck pauses this tick
  if (Math.random() < hesitationChance) return duck;
```

**Step 2: Write test**

In `tests/game/Duck.test.ts`, add:
```typescript
it('hesitates when hesitation chance is 1', () => {
  const grid = floorGrid();
  const duck = createDuck(0, { x: 10, y: groundedY });
  const playerPos = { x: 5, y: groundedY };
  const moved = moveDuckToward(duck, grid, playerPos, [], 1.0);
  expect(moved.pos).toEqual(duck.pos);
});

it('never hesitates when hesitation chance is 0', () => {
  const grid = floorGrid();
  const duck = createDuck(0, { x: 10, y: groundedY });
  const playerPos = { x: 5, y: groundedY };
  const moved = moveDuckToward(duck, grid, playerPos, [], 0);
  expect(moved.pos.x).toBeLessThan(10);
});
```

**Step 3: Run tests and commit**

Run: `npx vitest run`
```bash
git add src/game/Duck.ts tests/game/Duck.test.ts
git commit -m "Duck AI: 15% random hesitation per move tick"
```

---

### Task 7: Duck AI — Smarter Ladder Choice

**Files:**
- Modify: `src/game/Duck.ts` (findLadderSeekDirection)

**Step 1: Update ladder seek to prefer closer-to-player horizontal direction**

The current `findLadderSeekDirection` already prefers the direction toward the player's X position (line 155). Review and confirm this is working correctly — if the player is to the left, it tries Left first, then Right.

This is actually already implemented. Verify by reading the code and checking the test coverage. If adequate, skip this task.

**Step 2: If already working, commit a no-op or skip**

---

### Task 8: Final Integration Test & Deploy

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit any remaining changes and push**

```bash
git push origin main
```

**Step 4: Deploy to Vercel**

```bash
npx vercel --prod --yes
```

**Step 5: Verify deployment**

```bash
curl -s https://vibetownrunner.com/ | grep -o "SCORE_BADGE"
```
