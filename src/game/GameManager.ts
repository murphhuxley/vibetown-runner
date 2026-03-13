import { GameState, GamePhase, TileType, Direction, WeatherType } from '@/types';
import { GRID_COLS, GRID_ROWS, STARTING_LIVES } from '@/constants';
import { parseLevel, countBadges, findSpawnPosition, findAllSpawnPositions, cloneGrid } from '@/game/Level';
import { createPlayer, movePlayer, canClimb, canTraverseRope } from '@/game/Player';
import { createDuck, moveDuckToward, trapDuck, updateTrappedDuck, respawnDuck } from '@/game/Duck';
import { isSupported, getTile } from '@/game/Physics';
import { canDig, getDigTarget, createHole, updateHoles } from '@/game/Dig';
import { createVibeMeter, addVibe, activateLFV, updateLFV, isLFVActive, isLFVReady, VibeMeterState } from '@/game/VibeMeter';
import { createDrop, collectDrop, updateDrops, VibestrDrop } from '@/game/Vibestr';
import { getSpeedMultiplier } from '@/game/Weather';
import { createScoring, collectBadge as scoreBadge, trapDuck as scoreTrap, killDuck as scoreKill, collectVibestr as scoreVibestr, completeLevel as scoreComplete, ScoringState } from '@/game/Scoring';
import { InputManager } from '@/engine/Input';

import levelData01 from '@/levels/level-01.json';

const LEVELS = [levelData01];

export class GameManager {
  state!: GameState;
  scoring!: ScoringState;
  vibeMeter!: VibeMeterState;
  drops: VibestrDrop[] = [];
  input: InputManager;

  // Tick-based movement accumulators
  private playerMoveAccum = 0;
  private duckMoveAccum = 0;
  private readonly PLAYER_MOVE_INTERVAL = 150; // ms between moves
  private readonly DUCK_MOVE_INTERVAL = 250;

  constructor(input: InputManager) {
    this.input = input;
    this.scoring = createScoring();
    this.vibeMeter = createVibeMeter();
    this.loadLevel(0);
  }

  loadLevel(index: number): void {
    const raw = LEVELS[index];
    if (!raw) return;

    const level = parseLevel(raw);
    const grid = cloneGrid(level.grid);
    const playerSpawn = findSpawnPosition(grid, TileType.PlayerSpawn) ?? { x: 0, y: 0 };
    const duckSpawns = findAllSpawnPositions(grid, TileType.DuckSpawn);

    // Clear spawn markers from grid
    grid[playerSpawn.y][playerSpawn.x] = TileType.Empty;
    for (const ds of duckSpawns) {
      grid[ds.y][ds.x] = TileType.Empty;
    }

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
    };

    this.drops = [];
    this.playerMoveAccum = 0;
    this.duckMoveAccum = 0;
  }

  update(dt: number): void {
    if (this.state.phase !== GamePhase.Playing) return;

    const weatherMult = getSpeedMultiplier(this.state.weather, 'player');
    const lfvActive = isLFVActive(this.vibeMeter);
    const lfvMult = lfvActive ? 1.5 : 1;

    // Update LFV timer
    updateLFV(this.vibeMeter, dt);
    this.state.player.isLFV = isLFVActive(this.vibeMeter);

    // Player movement (tick-based)
    this.playerMoveAccum += dt * weatherMult * lfvMult;
    if (this.playerMoveAccum >= this.PLAYER_MOVE_INTERVAL) {
      this.playerMoveAccum = 0;
      this.updatePlayer();
    }

    // Duck movement
    const duckWeatherMult = getSpeedMultiplier(this.state.weather, 'duck');
    this.duckMoveAccum += dt * duckWeatherMult;
    if (this.duckMoveAccum >= this.DUCK_MOVE_INTERVAL) {
      this.duckMoveAccum = 0;
      if (!isLFVActive(this.vibeMeter)) {
        this.updateDucks();
      }
    }

    // Update holes (regeneration timers)
    this.state.holes = updateHoles(this.state.holes, this.state.grid, dt);

    // Check for ducks killed by closing holes
    this.checkHoleKills();

    // Update trapped ducks
    for (const duck of this.state.ducks) {
      updateTrappedDuck(duck, dt);
    }

    // Update $VIBESTR drops
    this.drops = updateDrops(this.drops);

    // Sync scoring state → game state
    this.state.score = this.scoring.score;
    this.state.lives = this.scoring.lives;
    this.state.vibestr = this.scoring.vibestr;
    this.state.vibeMeter = this.vibeMeter.meter;
    this.state.lfvTimer = this.vibeMeter.lfvTimer;
  }

  private updatePlayer(): void {
    const { player, grid } = this.state;

    // Apply gravity — if not supported, fall
    if (!isSupported(grid, player.pos, player.isOnLadder, player.isOnRope)) {
      const fallen = movePlayer(player, grid, Direction.Down);
      Object.assign(player, fallen);
      player.isFalling = true;
      this.checkPlayerCollisions();
      return;
    }
    player.isFalling = false;

    // Update ladder/rope awareness
    player.isOnLadder = canClimb(grid, player.pos);
    player.isOnRope = canTraverseRope(grid, player.pos);

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

    // Digging (Z = left, X = right)
    if (this.input.justPressed('z')) {
      this.tryDig(Direction.Left);
    }
    if (this.input.justPressed('x')) {
      this.tryDig(Direction.Right);
    }

    // LFV activation (spacebar)
    if (this.input.justPressed(' ') && isLFVReady(this.vibeMeter)) {
      activateLFV(this.vibeMeter);
    }

    // Badge collection
    this.checkBadgeCollection();

    // $VIBESTR collection
    if (collectDrop(this.drops, player.pos)) {
      scoreVibestr(this.scoring);
    }

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

  private tryDig(direction: Direction): void {
    const { player, grid } = this.state;
    if (canDig(grid, player.pos, direction, player.isOnRope)) {
      const target = getDigTarget(player.pos, direction)!;
      const hole = createHole(grid, target);
      this.state.holes.push(hole);
    }
  }

  private updateDucks(): void {
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
          // Check badge BEFORE trapping (trapDuck clears carryingBadge)
          const wasBadgeless = !duck.carryingBadge;
          trapDuck(duck);
          if (wasBadgeless) {
            // Spawn $VIBESTR drop above the hole
            this.drops.push(createDrop({ x: duck.pos.x, y: duck.pos.y - 1 }));
          }
          scoreTrap(this.scoring);
          addVibe(this.vibeMeter, 'trap');
        }
      }
    }
  }

  private checkBadgeCollection(): void {
    const { player, grid } = this.state;
    const tile = getTile(grid, player.pos);
    if (tile === TileType.Badge) {
      grid[player.pos.y][player.pos.x] = TileType.Empty;
      this.state.badgesCollected++;
      scoreBadge(this.scoring);
      addVibe(this.vibeMeter, 'badge');
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
      // Hole regenerated with duck still in it → duck dies
      const tile = getTile(this.state.grid, duck.pos);
      if (tile === TileType.Sand) {
        scoreKill(this.scoring);
        respawnDuck(duck, this.state.grid);
      }
    }
  }

  private revealHiddenLadders(): void {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (this.state.grid[y][x] === TileType.HiddenLadder) {
          this.state.grid[y][x] = TileType.Ladder;
        }
      }
    }
  }

  private completeLevel(): void {
    const lfvUnused = this.vibeMeter.meter >= 0 && this.vibeMeter.lfvTimer === 0;
    scoreComplete(this.scoring, lfvUnused);
    this.state.phase = GamePhase.LevelComplete;
  }

  private playerDeath(): void {
    this.scoring.lives--;
    if (this.scoring.lives <= 0) {
      this.state.phase = GamePhase.GameOver;
    } else {
      this.state.phase = GamePhase.Dead;
    }
  }
}
