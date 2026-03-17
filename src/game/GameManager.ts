import { GameState, GamePhase, TileType, Direction, DuckState, ProjectileState } from '@/types';
import { GRID_ROWS, GRID_COLS, PLAYER_SPEED, PLAYER_FALL_SPEED, DUCK_TRAP_ESCAPE_TIME, DUCK_TRAP_SUPPORT_DELAY, HOLE_OPEN_ANIM, POWER_HELMET_SHOTS } from '@/constants';
import { parseLevel, countBadges, findSpawnPosition, findAllSpawnPositions, cloneGrid, ensureHiddenExit } from '@/game/Level';
import { createPlayer, movePlayer, canClimb, canTraverseRope } from '@/game/Player';
import { createDuck, moveDuckToward, trapDuck, updateTrappedDuck, respawnDuck } from '@/game/Duck';
import { isSupported, getTile } from '@/game/Physics';
import { canDig, getDigTarget, createHole, updateHoles } from '@/game/Dig';
import { createVibeMeter, addVibe, activateLFV, updateLFV, isLFVActive, isLFVReady, VibeMeterState } from '@/game/VibeMeter';
import { collectDrop, updateDrops, VibestrDrop } from '@/game/Vibestr';
import { createDuckDeathEffect, updateDuckDeathEffects, DuckDeathEffect } from '@/game/DuckDeath';
import { createConfettiBurst, updateConfetti, ConfettiPiece } from '@/game/Confetti';
import { getSpeedMultiplier } from '@/game/Weather';
import { createProjectile, isProjectileExpired, projectileCrossesDuck, projectileHitsSolid, updateProjectile } from '@/game/Projectile';
import { createScoring, collectBadge as scoreBadge, trapDuck as scoreTrap, killDuck as scoreKill, collectVibestr as scoreVibestr, completeLevel as scoreComplete, ScoringState } from '@/game/Scoring';
import { InputManager } from '@/engine/Input';
import { LEVELS, randomizeLevels } from '@/levels/catalog';

export class GameManager {
  state!: GameState;
  scoring!: ScoringState;
  vibeMeter!: VibeMeterState;
  drops: VibestrDrop[] = [];
  duckDeaths: DuckDeathEffect[] = [];
  confetti: ConfettiPiece[] = [];
  projectiles: ProjectileState[] = [];
  input: InputManager;

  // SFX callbacks — set from outside to avoid coupling audio into game logic
  onDig?: () => void;
  onCollect?: () => void;
  onTrap?: () => void;
  onKill?: () => void;
  onDeath?: () => void;
  onLFV?: () => void;
  onLevelComplete?: () => void;
  onVibestr?: () => void;
  onRevealLadders?: () => void;
  onLand?: () => void;

  // Tick-based movement accumulators
  private playerMoveAccum = 0;
  private duckMoveAccum = 0;
  private readonly PLAYER_MOVE_INTERVAL = 1000 / PLAYER_SPEED;
  private readonly PLAYER_FALL_INTERVAL = 1000 / PLAYER_FALL_SPEED;
  private readonly DUCK_MOVE_INTERVAL = 250;
  private playerRenderFrom = { x: 0, y: 0 };
  private playerRenderTo = { x: 0, y: 0 };
  private playerRenderProgress = 1;
  private playerRenderDuration = this.PLAYER_MOVE_INTERVAL;

  // Duck render interpolation
  private duckRenderFrom: Map<number, { x: number; y: number }> = new Map();
  private duckRenderTo: Map<number, { x: number; y: number }> = new Map();
  private duckRenderProgress = 1;
  private usedLFVThisLevel = false;

  constructor(input: InputManager) {
    this.input = input;
    this.scoring = createScoring();
    this.vibeMeter = createVibeMeter();
    this.loadLevel(0);
    this.state.phase = GamePhase.Menu;
  }

  startGame(): void {
    this.state.phase = GamePhase.Playing;
  }

  loadLevel(index: number): boolean {
    const raw = LEVELS[index];
    if (!raw) return false;

    const level = parseLevel(raw);
    const grid = cloneGrid(level.grid);
    const playerSpawn = findSpawnPosition(grid, TileType.PlayerSpawn) ?? { x: 0, y: 0 };
    const duckSpawns = findAllSpawnPositions(grid, TileType.DuckSpawn);

    // Clear spawn markers from grid
    grid[playerSpawn.y][playerSpawn.x] = TileType.Empty;
    for (const ds of duckSpawns) {
      grid[ds.y][ds.x] = TileType.Empty;
    }

    // Prefer authored exits so puzzle solutions stay deterministic.
    ensureHiddenExit(grid, level.exitColumn);

    // Active LFV should not carry across retries or level transitions.
    this.vibeMeter.lfvTimer = 0;
    this.usedLFVThisLevel = false;

    this.state = {
      phase: GamePhase.Playing,
      level,
      grid,
      player: createPlayer(playerSpawn),
      ducks: duckSpawns.map((pos, i) => createDuck(i, pos)),
      holes: [],
      score: this.scoring.score,
      lives: this.scoring.lives,
      badgesCollected: 0,
      badgesTotal: countBadges(grid),
      vibestr: this.scoring.vibestr,
      vibeMeter: this.vibeMeter.meter,
      lfvTimer: 0,
      currentLevel: index + 1,
      weather: level.weather,
      powerHelmetPos: this.resolvePowerHelmetSpawn(level.id, grid, playerSpawn, level.powerHelmet),
      powerHelmetCollected: false,
      powerHelmetActive: false,
      powerHelmetShots: 0,
    };

    this.drops = [];
    this.duckDeaths = [];
    this.confetti = [];
    this.projectiles = [];
    this.playerMoveAccum = 0;
    this.duckMoveAccum = 0;
    this.playerRenderFrom = { ...playerSpawn };
    this.playerRenderTo = { ...playerSpawn };
    this.playerRenderProgress = 1;
    this.playerRenderDuration = this.PLAYER_MOVE_INTERVAL;

    // Init duck render positions
    this.duckRenderFrom.clear();
    this.duckRenderTo.clear();
    this.duckRenderProgress = 1;
    for (const duck of this.state.ducks) {
      this.duckRenderFrom.set(duck.id, { ...duck.pos });
      this.duckRenderTo.set(duck.id, { ...duck.pos });
    }
    return true;
  }

  update(dt: number): void {
    if (this.state.phase !== GamePhase.Playing) return;

    const weatherMult = getSpeedMultiplier(this.state.weather, 'player');
    const lfvActive = isLFVActive(this.vibeMeter);
    const lfvMult = lfvActive ? 1.5 : 1;
    const playerSpeedMult = weatherMult * lfvMult;
    const player = this.state.player;
    const playerOnLadder = canClimb(this.state.grid, player.pos);
    const playerOnRope = canTraverseRope(this.state.grid, player.pos);
    const playerWillFall = !isSupported(this.state.grid, player.pos, playerOnLadder, playerOnRope);
    const activePlayerInterval =
      (player.isFalling || playerWillFall ? this.PLAYER_FALL_INTERVAL : this.PLAYER_MOVE_INTERVAL);
    let digLockedThisFrame = this.state.player.isDigging;

    this.advancePlayerRender(dt);

    // Update LFV timer
    updateLFV(this.vibeMeter, dt);
    this.state.player.isLFV = isLFVActive(this.vibeMeter);

    // Tick down dig animation timer
    if (this.digTimer > 0) {
      this.digTimer -= dt;
      if (this.digTimer <= 0) {
        this.digTimer = 0;
        this.state.player.isDigging = false;
      }
    }

    // Update facing direction instantly (not tick-gated) so sprite responds immediately
    if (!digLockedThisFrame) {
      if (this.input.left) this.state.player.facing = Direction.Left;
      else if (this.input.right) this.state.player.facing = Direction.Right;
    }

    // Digging — checked every frame so justPressed isn't missed
    if (!digLockedThisFrame && this.input.justPressed('z')) {
      digLockedThisFrame = this.tryDig(Direction.Left) || digLockedThisFrame;
    }
    if (!digLockedThisFrame && (this.input.justPressed('x') || this.input.justPressed('c'))) {
      digLockedThisFrame = this.tryDig(Direction.Right) || digLockedThisFrame;
    }

    const spacePressed = this.input.justPressed(' ');
    this.handlePowerHelmetInput(spacePressed);

    // LFV is disabled while the helmet power-up is active.
    if (spacePressed && !this.state.powerHelmetActive && isLFVReady(this.vibeMeter)) {
      activateLFV(this.vibeMeter);
      this.usedLFVThisLevel = true;
      this.onLFV?.();
    }

    // Player movement (tick-based)
    if (digLockedThisFrame) {
      this.playerMoveAccum = 0;
      this.updatePlayer(true);
    } else {
      this.playerMoveAccum += dt * playerSpeedMult;
    }

    if (!digLockedThisFrame && this.playerMoveAccum >= activePlayerInterval) {
      const previousPos = { ...this.state.player.pos };
      this.playerMoveAccum -= activePlayerInterval;
      this.updatePlayer(false);
      const playerRenderDuration = (
        this.state.player.isFalling ? this.PLAYER_FALL_INTERVAL : this.PLAYER_MOVE_INTERVAL
      ) / playerSpeedMult;
      this.startPlayerRender(previousPos, this.state.player.pos, playerRenderDuration);
    }

    // Duck movement
    const duckWeatherMult = getSpeedMultiplier(this.state.weather, 'duck');
    this.duckMoveAccum += dt * duckWeatherMult;
    if (this.duckMoveAccum >= this.DUCK_MOVE_INTERVAL) {
      this.duckMoveAccum = 0;
      if (!isLFVActive(this.vibeMeter)) {
        // Snapshot positions before move
        for (const duck of this.state.ducks) {
          this.duckRenderFrom.set(duck.id, { ...duck.pos });
        }
        this.updateDucks();
        // Set targets after move
        for (const duck of this.state.ducks) {
          this.duckRenderTo.set(duck.id, { ...duck.pos });
        }
        this.duckRenderProgress = 0;
      }
    }

    // Advance duck render interpolation
    if (this.duckRenderProgress < 1) {
      this.duckRenderProgress = Math.min(this.duckRenderProgress + dt / this.DUCK_MOVE_INTERVAL, 1);
    }

    // Update trapped ducks
    this.updateTrappedDucks(dt);

    // Update power projectiles
    this.updateProjectiles(dt);

    // Update holes (regeneration timers and lifecycle)
    const holeUpdate = updateHoles(this.state.holes, this.state.grid, dt);
    this.state.holes = holeUpdate.holes;
    if (holeUpdate.closed.some((pos) => pos.x === this.state.player.pos.x && pos.y === this.state.player.pos.y)) {
      this.playerDeath();
      return;
    }

    // Check for ducks killed by closing holes
    this.checkHoleKills();

    // Update $VIBESTR drops
    this.drops = updateDrops(this.drops);
    this.duckDeaths = updateDuckDeathEffects(this.duckDeaths, dt);
    this.confetti = updateConfetti(this.confetti, dt);

    // Sync scoring state → game state
    this.state.score = this.scoring.score;
    this.state.lives = this.scoring.lives;
    this.state.vibestr = this.scoring.vibestr;
    this.state.vibeMeter = this.vibeMeter.meter;
    this.state.lfvTimer = this.vibeMeter.lfvTimer;
  }

  private updatePlayer(digLocked = false): void {
    const { player, grid } = this.state;

    // Trapped ducks act as solid ground (classic Lode Runner bridge mechanic).
    // Temporarily mark their positions as Sand so all isSupported/canMoveTo
    // calls see them as solid during the entire player update.
    const trappedPositions: { x: number; y: number }[] = [];
    for (const duck of this.state.ducks) {
      if (duck.isTrapped) {
        trappedPositions.push({ x: duck.pos.x, y: duck.pos.y });
        grid[duck.pos.y][duck.pos.x] = TileType.Sand;
      }
    }

    // Update ladder/rope awareness BEFORE gravity check
    // (prevents falling through ropes/ladders when landing on them)
    player.isOnLadder = canClimb(grid, player.pos);
    player.isOnRope = canTraverseRope(grid, player.pos);

    // Apply gravity — if not supported, fall
    if (!isSupported(grid, player.pos, player.isOnLadder, player.isOnRope)) {
      const fallen = movePlayer(player, grid, Direction.Down);
      Object.assign(player, fallen);
      player.isFalling = true;
      this.restoreTrappedTiles(grid, trappedPositions);
      // Fell into a hole and stuck (solid below) → death
      // Fell through a hole with open space below → keep falling, survive
      const inHole = this.state.holes.some(
        h => h.x === player.pos.x && h.y === player.pos.y
      );
      if (inHole && isSupported(grid, player.pos, false, false)) {
        this.playerDeath();
        return;
      }
      this.checkPlayerCollisions();
      return;
    }
    player.isFalling = false;

    if (digLocked) {
      this.restoreTrappedTiles(grid, trappedPositions);
      this.checkBadgeCollection();

      if (collectDrop(this.drops, player.pos)) {
        scoreVibestr(this.scoring);
        this.onVibestr?.();
      }

      this.checkPowerHelmetCollection();

      this.checkPlayerCollisions();

      if (this.state.badgesCollected >= this.state.badgesTotal) {
        this.revealHiddenLadders();
        if (player.pos.y === 0) {
          this.completeLevel();
        }
      }
      return;
    }

    // Process directional input
    let dir = Direction.None;
    if (this.input.left) dir = Direction.Left;
    else if (this.input.right) dir = Direction.Right;
    else if (this.input.up) dir = Direction.Up;
    else if (this.input.down) dir = Direction.Down;

    if (dir !== Direction.None) {
      const moved = movePlayer(player, grid, dir);
      Object.assign(player, moved);
    }

    // Restore grid before badge/collision checks
    this.restoreTrappedTiles(grid, trappedPositions);

    // Badge collection
    this.checkBadgeCollection();

    // $VIBESTR collection
    if (collectDrop(this.drops, player.pos)) {
      scoreVibestr(this.scoring);
      this.onVibestr?.();
    }

    this.checkPowerHelmetCollection();

    // Player-duck collision
    this.checkPlayerCollisions();

    // Level completion check
    if (this.state.badgesCollected >= this.state.badgesTotal) {
      this.revealHiddenLadders();
      if (player.pos.y === 0) {
        this.completeLevel();
      }
    }
  }

  private restoreTrappedTiles(grid: TileType[][], positions: { x: number; y: number }[]): void {
    for (const pos of positions) {
      grid[pos.y][pos.x] = TileType.Empty;
    }
  }

  private digTimer = 0;

  private tryDig(direction: Direction): boolean {
    const { player, grid } = this.state;
    if (player.isDigging) return false;
    const target = getDigTarget(player.pos, direction);
    if (!target) return false;
    if (this.state.holes.some((hole) => hole.x === target.x && hole.y === target.y)) return false;
    if (canDig(grid, player.pos, direction, player.isOnRope)) {
      const hole = createHole(grid, target, direction as Direction.Left | Direction.Right);
      this.state.holes.push(hole);
      player.isDigging = true;
      player.facing = direction;
      this.digTimer = HOLE_OPEN_ANIM;
      this.playerMoveAccum = 0;
      this.onDig?.();
      return true;
    }
    return false;
  }

  private updateDucks(): void {
    const { grid } = this.state;

    // Trapped ducks act as solid ground for other ducks (can't fall in occupied hole)
    const trappedPositions: { x: number; y: number }[] = [];
    for (const duck of this.state.ducks) {
      if (this.isDuckProvidingSupport(duck)) {
        trappedPositions.push({ x: duck.pos.x, y: duck.pos.y });
        grid[duck.pos.y][duck.pos.x] = TileType.Sand;
      }
    }

    for (const duck of this.state.ducks) {
      if (duck.isTrapped) continue;

      const moved = moveDuckToward(
        duck, this.state.grid, this.state.player.pos, this.state.ducks
      );
      Object.assign(duck, moved);

      // Duck picks up badge from ground
      const tile = getTile(this.state.grid, duck.pos);
      if (tile === TileType.Badge && !duck.carryingBadge) {
        duck.carryingBadge = true;
        this.state.grid[duck.pos.y][duck.pos.x] = TileType.Empty;
      }

      // Duck falls into hole
      for (const hole of this.state.holes) {
        if (duck.pos.x === hole.x && duck.pos.y === hole.y) {
          const hadBadge = duck.carryingBadge;
          trapDuck(duck);
          if (hadBadge) {
            // Drop the badge above the hole so the player can collect it
            this.state.grid[duck.pos.y - 1][duck.pos.x] = TileType.Badge;
          }
          scoreTrap(this.scoring);
          addVibe(this.vibeMeter, 'trap');
          this.onTrap?.();
        }
      }
    }

    // Restore trapped tile positions
    this.restoreTrappedTiles(grid, trappedPositions);
  }

  private checkBadgeCollection(): void {
    const { player, grid } = this.state;
    const tile = getTile(grid, player.pos);
    if (tile === TileType.Badge) {
      grid[player.pos.y][player.pos.x] = TileType.Empty;
      this.state.badgesCollected++;
      scoreBadge(this.scoring);
      addVibe(this.vibeMeter, 'badge');
      this.onCollect?.();
    }
  }

  private checkPowerHelmetCollection(): void {
    if (!this.state.powerHelmetPos || this.state.powerHelmetCollected) return;

    const { player, powerHelmetPos } = this.state;
    if (player.pos.x === powerHelmetPos.x && player.pos.y === powerHelmetPos.y) {
      this.state.powerHelmetCollected = true;
      this.state.powerHelmetActive = true;
      this.state.powerHelmetShots = POWER_HELMET_SHOTS;
      this.state.powerHelmetPos = null;
      this.vibeMeter.lfvTimer = 0;
      this.vibeMeter.meter = 0;
      this.state.player.isLFV = false;
      this.onCollect?.();
    }
  }

  private checkPlayerCollisions(): void {
    for (const duck of this.state.ducks) {
      if (duck.isTrapped) continue;
      if (duck.pos.x === this.state.player.pos.x && duck.pos.y === this.state.player.pos.y) {
        this.playerDeath();
        return;
      }
    }
  }

  private checkHoleKills(): void {
    for (const duck of this.state.ducks) {
      if (!duck.isTrapped) continue;
      const tile = getTile(this.state.grid, duck.pos);
      if (tile === TileType.Sand || tile === TileType.TrapSand) {
        this.killDuck(duck);
      }
    }
  }

  private handlePowerHelmetInput(spacePressed: boolean): void {
    if (!spacePressed) return;
    if (!this.state.powerHelmetActive) return;

    if (this.state.powerHelmetShots <= 0) return;

    const facing = this.state.player.facing === Direction.Left
      ? Direction.Left
      : Direction.Right;

    this.projectiles.push(createProjectile(this.state.player.pos, facing));
    this.state.powerHelmetShots--;

    if (this.state.powerHelmetShots <= 0) {
      this.state.powerHelmetActive = false;
      this.state.powerHelmetCollected = false;
    }
  }

  private updateProjectiles(dt: number): void {
    const remaining: ProjectileState[] = [];

    for (const projectile of this.projectiles) {
      updateProjectile(projectile, dt);

      if (isProjectileExpired(projectile) || projectileHitsSolid(projectile, this.state.grid)) {
        continue;
      }

      let hitDuck: DuckState | null = null;
      for (const duck of this.state.ducks) {
        if (duck.isTrapped) continue;
        if (projectileCrossesDuck(projectile, duck.pos)) {
          hitDuck = duck;
          break;
        }
      }

      if (hitDuck) {
        this.killDuck(hitDuck);
        continue;
      }

      remaining.push(projectile);
    }

    this.projectiles = remaining;
  }

  private killDuck(duck: DuckState): void {
    const impactPos = { ...duck.pos };
    this.duckDeaths.push(createDuckDeathEffect(impactPos));
    this.confetti.push(...createConfettiBurst(impactPos));

    if (duck.carryingBadge) {
      const dropPos = this.resolveDuckBadgeDropPosition(impactPos);
      if (dropPos) {
        this.state.grid[dropPos.y][dropPos.x] = TileType.Badge;
      }
    }

    scoreKill(this.scoring);
    this.onKill?.();
    respawnDuck(duck, this.state.grid, this.state.player.pos);
    this.duckRenderFrom.set(duck.id, { ...duck.pos });
    this.duckRenderTo.set(duck.id, { ...duck.pos });
  }

  private resolveDuckBadgeDropPosition(origin: { x: number; y: number }): { x: number; y: number } | null {
    const searchOrders: TileType[][] = [
      [TileType.Empty],
      [TileType.Empty, TileType.Rope, TileType.Ladder],
    ];

    for (const allowedTiles of searchOrders) {
      for (let y = origin.y; y < GRID_ROWS; y++) {
        const pos = { x: origin.x, y };
        const tile = getTile(this.state.grid, pos);

        if (!allowedTiles.includes(tile)) continue;
        if (!isSupported(this.state.grid, pos, tile === TileType.Ladder, tile === TileType.Rope)) continue;

        return pos;
      }
    }

    return null;
  }

  private resolvePowerHelmetSpawn(
    levelId: number,
    grid: TileType[][],
    playerSpawn: { x: number; y: number },
    authored: { x: number; y: number } | undefined,
  ): { x: number; y: number } | null {
    if (authored) return authored;
    if (levelId <= 3) return null;

    const candidates: { x: number; y: number }[] = [];
    for (let y = 1; y < GRID_ROWS - 1; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (grid[y][x] !== TileType.Empty) continue;
        if (x === playerSpawn.x && y === playerSpawn.y) continue;

        const pos = { x, y };
        if (!isSupported(grid, pos, canClimb(grid, pos), canTraverseRope(grid, pos))) continue;
        candidates.push(pos);
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private updateTrappedDucks(dt: number): void {
    for (const duck of this.state.ducks) {
      if (!duck.isTrapped) continue;

      const holePos = { ...duck.pos };
      const escaped = updateTrappedDuck(duck, dt);
      if (!escaped) continue;

      if (this.state.player.pos.x === holePos.x && this.state.player.pos.y === holePos.y - 1) {
        const previousPos = { ...this.state.player.pos };
        this.state.player.pos = { ...holePos };
        this.state.player.isOnLadder = false;
        this.state.player.isOnRope = false;
        this.state.player.isFalling = false;
        this.startPlayerRender(previousPos, this.state.player.pos, this.PLAYER_FALL_INTERVAL);
      }
    }
  }

  private isDuckProvidingSupport(duck: DuckState): boolean {
    return duck.isTrapped && duck.trapTimer <= DUCK_TRAP_ESCAPE_TIME - DUCK_TRAP_SUPPORT_DELAY;
  }

  private revealHiddenLadders(): void {
    let revealed = false;
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (this.state.grid[y][x] === TileType.HiddenLadder) {
          this.state.grid[y][x] = TileType.Ladder;
          revealed = true;
        }
      }
    }
    if (revealed) this.onRevealLadders?.();
  }

  private completeLevel(): void {
    const lfvUnused = !this.usedLFVThisLevel;
    scoreComplete(this.scoring, lfvUnused);
    this.scoring.lives++;
    this.state.phase = GamePhase.LevelComplete;
    this.onLevelComplete?.();
  }

  private playerDeath(): void {
    this.scoring.lives--;
    this.onDeath?.();
    if (this.scoring.lives <= 0) {
      this.state.phase = GamePhase.GameOver;
    } else {
      this.state.phase = GamePhase.Dead;
    }
  }

  restart(): void {
    randomizeLevels(); // Reset the live campaign from the authored level set.
    this.scoring = createScoring();
    this.vibeMeter = createVibeMeter();
    this.loadLevel(0);
  }

  getDuckRenderPos(duckId: number): { x: number; y: number } {
    const from = this.duckRenderFrom.get(duckId);
    const to = this.duckRenderTo.get(duckId);
    if (!from || !to || this.duckRenderProgress >= 1) {
      return to ?? { x: 0, y: 0 };
    }
    const t = this.duckRenderProgress;
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  }

  getPlayerRenderPos(): { x: number; y: number } {
    if (this.playerRenderProgress >= 1) {
      return { ...this.playerRenderTo };
    }

    const t = this.playerRenderProgress;
    return {
      x: this.playerRenderFrom.x + (this.playerRenderTo.x - this.playerRenderFrom.x) * t,
      y: this.playerRenderFrom.y + (this.playerRenderTo.y - this.playerRenderFrom.y) * t,
    };
  }

  private startPlayerRender(from: { x: number; y: number }, to: { x: number; y: number }, duration: number): void {
    if (from.x === to.x && from.y === to.y) {
      this.playerRenderFrom = { ...to };
      this.playerRenderTo = { ...to };
      this.playerRenderProgress = 1;
      return;
    }

    this.playerRenderFrom = { ...from };
    this.playerRenderTo = { ...to };
    this.playerRenderProgress = 0;
    this.playerRenderDuration = Math.max(duration, 1);
  }

  private advancePlayerRender(dt: number): void {
    if (this.playerRenderProgress >= 1) return;

    this.playerRenderProgress = Math.min(
      this.playerRenderProgress + dt / this.playerRenderDuration,
      1
    );
  }
}
