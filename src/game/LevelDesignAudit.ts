import { GRID_COLS, GRID_ROWS } from '@/constants';
import { Position, TileType } from '@/types';

export type LevelDesignSeverity = 'blocker' | 'warning' | 'note';

export interface LevelDesignIssue {
  code: string;
  message: string;
  severity: LevelDesignSeverity;
  x?: number;
  y?: number;
}

export interface LevelDesignMetrics {
  levelId: number;
  badgeCount: number;
  duckCount: number;
  playableFloorRows: number[];
  ladderColumns: number[];
  ropeSpanCount: number;
  ropeTileCount: number;
  digOpportunityCount: number;
  badgeRows: number[];
  longestPlatformRun: number;
  minDuckDistanceFromSpawn: number | null;
  branchScore: number;
}

export interface LevelDesignReport {
  metrics: LevelDesignMetrics;
  issues: LevelDesignIssue[];
}

interface LevelDesignInput {
  id: number;
  grid: number[][];
  powerHelmet?: Position;
}

interface Segment {
  y: number;
  start: number;
  end: number;
  length: number;
}

const SOLID_TILES = new Set<TileType>([TileType.Sand, TileType.Coral, TileType.TrapSand]);
const WALKABLE_TILES = new Set<TileType>([
  TileType.Empty,
  TileType.Badge,
  TileType.DuckSpawn,
  TileType.PlayerSpawn,
  TileType.Ladder,
  TileType.Rope,
  TileType.HiddenLadder,
]);

export function auditLevelDesign(level: LevelDesignInput): LevelDesignReport {
  const grid = level.grid.map((row) => row.map((tile) => tile as TileType));
  const issues: LevelDesignIssue[] = [];
  const playerSpawn = findFirst(grid, TileType.PlayerSpawn);
  const badges = findAll(grid, TileType.Badge);
  const ducks = findAll(grid, TileType.DuckSpawn);
  const platformSegments = findPlatformSegments(grid);
  const playableFloorRows = unique(
    platformSegments
      .map((segment) => segment.y)
      .filter((y) => y < GRID_ROWS - 2),
  );
  const ladderColumns = findLadderColumns(grid);
  const ropeSpans = findRopeSpans(grid);
  const digOpportunityCount = countDigOpportunities(grid);
  const badgeRows = unique(badges.map((badge) => badge.y));
  const longestPlatformRun = platformSegments.reduce((longest, segment) => Math.max(longest, segment.length), 0);
  const minDuckDistanceFromSpawn = playerSpawn
    ? minDistance(playerSpawn, ducks)
    : null;

  auditSpacing(level.id, grid, issues);
  auditTraversal(level.id, grid, playableFloorRows, ladderColumns, ropeSpans, digOpportunityCount, issues);
  auditPickups(level.id, grid, badges, level.powerHelmet, issues);
  auditEnemyPressure(level.id, ducks, minDuckDistanceFromSpawn, issues);
  auditProgressionTexture(level.id, playableFloorRows, badgeRows, longestPlatformRun, issues);

  return {
    metrics: {
      levelId: level.id,
      badgeCount: badges.length,
      duckCount: ducks.length,
      playableFloorRows,
      ladderColumns,
      ropeSpanCount: ropeSpans.length,
      ropeTileCount: ropeSpans.reduce((count, span) => count + span.length, 0),
      digOpportunityCount,
      badgeRows,
      longestPlatformRun,
      minDuckDistanceFromSpawn,
      branchScore: ladderColumns.length + ropeSpans.length + Math.min(6, Math.floor(digOpportunityCount / 8)),
    },
    issues,
  };
}

export function getBlockingDesignIssues(level: LevelDesignInput): LevelDesignIssue[] {
  return auditLevelDesign(level).issues.filter((issue) => issue.severity === 'blocker');
}

function auditSpacing(levelId: number, grid: TileType[][], issues: LevelDesignIssue[]): void {
  const crampedRopeRows = new Set<number>();
  const tightLaneRows = new Set<number>();

  forEachTile(grid, (tile, x, y) => {
    if (tile === TileType.Rope) {
      if (isSolid(tileAt(grid, x, y + 1))) {
        issues.push(blocker('rope-body-blocked', `Level ${levelId} rope has a solid tile directly under the hanging body`, x, y));
      } else if (isSolid(tileAt(grid, x, y + 2)) && !crampedRopeRows.has(y)) {
        crampedRopeRows.add(y);
        issues.push(warning('rope-body-cramped', `Level ${levelId} rope only has one clear cell before the platform below`, x, y));
      }

      if (isSolid(tileAt(grid, x, y - 1)) || isSolid(tileAt(grid, x, y - 2))) {
        issues.push(blocker('rope-headroom-blocked', `Level ${levelId} rope does not have enough headroom above it`, x, y));
      }
    }

    if (!isStandableLaneTile(tile)) return;
    if (!isSolid(tileAt(grid, x, y + 1))) return;

    if (isSolid(tileAt(grid, x, y - 1))) {
      issues.push(blocker('lane-headroom-blocked', `Level ${levelId} running lane has a brick directly over the character`, x, y));
    } else if (isSolid(tileAt(grid, x, y - 2)) && !tightLaneRows.has(y)) {
      tightLaneRows.add(y);
      issues.push(note('lane-headroom-tight', `Level ${levelId} running lane has only one full clear row above the character`, x, y));
    }
  });
}

function auditTraversal(
  levelId: number,
  grid: TileType[][],
  playableFloorRows: number[],
  ladderColumns: number[],
  ropeSpans: Segment[],
  digOpportunityCount: number,
  issues: LevelDesignIssue[],
): void {
  if (playableFloorRows.length < 3 && levelId >= 6) {
    issues.push(warning('low-floor-variety', `Level ${levelId} has fewer than three playable platform bands before the ground`));
  }

  if (ladderColumns.length < 2) {
    issues.push(blocker('too-few-ladder-columns', `Level ${levelId} needs at least two ladder columns for route variety`));
  }

  if (levelId >= 6 && ropeSpans.length === 0) {
    issues.push(note('no-rope-route', `Level ${levelId} has no rope route; consider adding one alternate traversal lane`));
  }

  if (levelId >= 8 && digOpportunityCount < 6) {
    issues.push(warning('low-dig-texture', `Level ${levelId} has very few useful dig opportunities`));
  }

  for (const span of ropeSpans) {
    const hasNearbyLadder = ladderColumns.some((x) => x >= span.start - 1 && x <= span.end + 1);
    if (!hasNearbyLadder && span.length >= 8 && !hasDropAccess(grid, span)) {
      issues.push(note('rope-needs-access-hook', `Level ${levelId} has a long rope span without an obvious ladder/drop access`, span.start, span.y));
    }
  }
}

function auditPickups(
  levelId: number,
  grid: TileType[][],
  badges: Position[],
  powerHelmet: Position | undefined,
  issues: LevelDesignIssue[],
): void {
  for (const badge of badges) {
    if (interruptsTraversalRun(grid, badge)) {
      issues.push(blocker('pickup-interrupts-traversal', `Level ${levelId} money bag interrupts a ladder or rope run`, badge.x, badge.y));
    }

    if (!isCollectiblePlacement(grid, badge)) {
      issues.push(warning('badge-floaty-placement', `Level ${levelId} money bag should sit on a clear platform/lane`, badge.x, badge.y));
    }
  }

  if (powerHelmet && interruptsTraversalRun(grid, powerHelmet)) {
    issues.push(blocker('powerup-interrupts-traversal', `Level ${levelId} power helmet interrupts a ladder or rope run`, powerHelmet.x, powerHelmet.y));
  }

  if (powerHelmet && !isCollectiblePlacement(grid, powerHelmet)) {
    issues.push(blocker('powerup-floaty-placement', `Level ${levelId} power helmet must sit on a clear platform/lane`, powerHelmet.x, powerHelmet.y));
  }

  const rowCounts = new Map<number, number>();
  for (const badge of badges) {
    rowCounts.set(badge.y, (rowCounts.get(badge.y) ?? 0) + 1);
  }

  const mostCrowdedRowCount = Math.max(0, ...Array.from(rowCounts.values()));
  if (badges.length >= 8 && mostCrowdedRowCount > Math.ceil(badges.length * 0.55)) {
    issues.push(note('badge-row-cluster', `Level ${levelId} puts most money bags on one row; spreading them improves routing`));
  }
}

function auditEnemyPressure(
  levelId: number,
  ducks: Position[],
  minDuckDistanceFromSpawn: number | null,
  issues: LevelDesignIssue[],
): void {
  if (levelId <= 5 && ducks.length !== 1) {
    issues.push(blocker('onboarding-duck-count', `Level ${levelId} should keep onboarding to one duck`));
  }

  if (levelId >= 6 && ducks.length < 2) {
    issues.push(blocker('low-duck-pressure', `Level ${levelId} needs at least two ducks after onboarding`));
  }

  if (levelId < 14 && ducks.length > 2) {
    issues.push(note('early-duck-overload', `Level ${levelId} may be using duck count before route design to create pressure`));
  }

  if (minDuckDistanceFromSpawn !== null && minDuckDistanceFromSpawn < 5) {
    issues.push(warning('duck-spawn-too-close', `Level ${levelId} starts a duck very close to the player spawn`));
  }
}

function auditProgressionTexture(
  levelId: number,
  playableFloorRows: number[],
  badgeRows: number[],
  longestPlatformRun: number,
  issues: LevelDesignIssue[],
): void {
  if (levelId >= 8 && badgeRows.length < Math.min(3, playableFloorRows.length)) {
    issues.push(warning('low-badge-route-spread', `Level ${levelId} money bags do not ask the player to visit enough floor bands`));
  }

  if (levelId >= 12 && longestPlatformRun >= GRID_COLS - 1) {
    issues.push(note('very-long-platform-run', `Level ${levelId} has a nearly full-width platform; consider breaking it into route choices`));
  }
}

function findPlatformSegments(grid: TileType[][]): Segment[] {
  const segments: Segment[] = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    let start: number | null = null;
    for (let x = 0; x <= GRID_COLS; x++) {
      const solid = x < GRID_COLS && isSolid(tileAt(grid, x, y));
      if (solid && start === null) start = x;
      if ((!solid || x === GRID_COLS) && start !== null) {
        const end = x - 1;
        const length = end - start + 1;
        if (length >= 2) segments.push({ y, start, end, length });
        start = null;
      }
    }
  }

  return segments;
}

function findRopeSpans(grid: TileType[][]): Segment[] {
  const spans: Segment[] = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    let start: number | null = null;
    for (let x = 0; x <= GRID_COLS; x++) {
      const isRope = x < GRID_COLS && tileAt(grid, x, y) === TileType.Rope;
      if (isRope && start === null) start = x;
      if ((!isRope || x === GRID_COLS) && start !== null) {
        const end = x - 1;
        spans.push({ y, start, end, length: end - start + 1 });
        start = null;
      }
    }
  }

  return spans;
}

function findLadderColumns(grid: TileType[][]): number[] {
  const columns: number[] = [];

  for (let x = 0; x < GRID_COLS; x++) {
    let ladderTiles = 0;
    for (let y = 0; y < GRID_ROWS; y++) {
      if (tileAt(grid, x, y) === TileType.Ladder || tileAt(grid, x, y) === TileType.HiddenLadder) {
        ladderTiles++;
      }
    }

    if (ladderTiles >= 3) columns.push(x);
  }

  return columns;
}

function countDigOpportunities(grid: TileType[][]): number {
  const opportunities = new Set<string>();

  forEachTile(grid, (tile, x, y) => {
    if (!isStandableLaneTile(tile)) return;
    if (!isSolid(tileAt(grid, x, y + 1))) return;

    for (const dx of [-1, 1]) {
      const digX = x + dx;
      const digY = y + 1;
      const stepX = x + dx;
      if (!inBounds(digX, digY) || !inBounds(stepX, y)) continue;
      if (!isDiggable(tileAt(grid, digX, digY))) continue;
      if (!WALKABLE_TILES.has(tileAt(grid, stepX, y))) continue;
      opportunities.add(`${x},${y},${dx}`);
    }
  });

  return opportunities.size;
}

function hasDropAccess(grid: TileType[][], span: Segment): boolean {
  for (let x = span.start; x <= span.end; x++) {
    for (let y = 0; y < span.y; y++) {
      if (isSolid(tileAt(grid, x, y))) return true;
    }
  }

  return false;
}

function isCollectiblePlacement(grid: TileType[][], pos: Position): boolean {
  const here = tileAt(grid, pos.x, pos.y);
  const below = tileAt(grid, pos.x, pos.y + 1);

  if (here === TileType.Ladder || here === TileType.Rope || here === TileType.HiddenLadder) {
    return false;
  }

  return isSolid(below) || isLadder(below);
}

function interruptsTraversalRun(grid: TileType[][], pos: Position): boolean {
  const above = tileAt(grid, pos.x, pos.y - 1);
  const below = tileAt(grid, pos.x, pos.y + 1);
  const left = tileAt(grid, pos.x - 1, pos.y);
  const right = tileAt(grid, pos.x + 1, pos.y);
  const interruptsLadder = isLadder(above) && isLadder(below);
  const interruptsRope = left === TileType.Rope && right === TileType.Rope;

  return interruptsLadder || interruptsRope;
}

function findFirst(grid: TileType[][], tileType: TileType): Position | null {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (tileAt(grid, x, y) === tileType) return { x, y };
    }
  }

  return null;
}

function findAll(grid: TileType[][], tileType: TileType): Position[] {
  const positions: Position[] = [];
  forEachTile(grid, (tile, x, y) => {
    if (tile === tileType) positions.push({ x, y });
  });
  return positions;
}

function minDistance(from: Position, positions: Position[]): number | null {
  if (positions.length === 0) return null;
  return Math.min(...positions.map((pos) => Math.abs(pos.x - from.x) + Math.abs(pos.y - from.y)));
}

function unique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function forEachTile(grid: TileType[][], fn: (tile: TileType, x: number, y: number) => void): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      fn(grid[y][x], x, y);
    }
  }
}

function tileAt(grid: TileType[][], x: number, y: number): TileType {
  if (!inBounds(x, y)) return TileType.Empty;
  return grid[y][x];
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function isSolid(tile: TileType): boolean {
  return SOLID_TILES.has(tile);
}

function isDiggable(tile: TileType): boolean {
  return tile === TileType.Sand || tile === TileType.TrapSand;
}

function isLadder(tile: TileType): boolean {
  return tile === TileType.Ladder || tile === TileType.HiddenLadder;
}

function isStandableLaneTile(tile: TileType): boolean {
  return tile !== TileType.Ladder && tile !== TileType.Rope && tile !== TileType.HiddenLadder && WALKABLE_TILES.has(tile);
}

function blocker(code: string, message: string, x?: number, y?: number): LevelDesignIssue {
  return { code, message, severity: 'blocker', x, y };
}

function warning(code: string, message: string, x?: number, y?: number): LevelDesignIssue {
  return { code, message, severity: 'warning', x, y };
}

function note(code: string, message: string, x?: number, y?: number): LevelDesignIssue {
  return { code, message, severity: 'note', x, y };
}
