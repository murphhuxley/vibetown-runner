/**
 * Room templates for procedural level generation.
 *
 * Each template is a 7×5 tile grid that represents one "room" in a 4×4 room grid.
 * The full 28×20 playfield is divided into 4 columns × 4 rows of rooms.
 *
 * Connection types:
 *   0 = Off-path (optional content, accessible via ladders from path rooms)
 *   1 = Horizontal (left ↔ right)
 *   2 = Horizontal + descends (left ↔ right + down)
 *   3 = Horizontal + ascends (left ↔ right + up from below)
 *   4 = Vertical shaft (up + down)
 *
 * Tile codes: 0=Empty, 1=Sand, 2=Coral, 3=Ladder, 4=Rope
 *
 * Difficulty tiers: 'easy' | 'medium' | 'hard'
 */

export interface RoomTemplate {
  type: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tiles: number[][];
}

// Helper to define templates concisely
function T(type: number, difficulty: 'easy' | 'medium' | 'hard', ...rows: number[][]): RoomTemplate {
  return { type, difficulty, tiles: rows };
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // ═══════════════════════════════════════
  // TYPE 0: Off-path (optional content)
  // No required connections — just interesting terrain
  // ═══════════════════════════════════════

  T(0, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(0, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,1,1,1,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(0, 'medium',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,0,0,0,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(0, 'medium',
    [0,0,0,0,0,0,0],
    [0,0,1,1,1,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,0,1,1,1],
  ),
  T(0, 'hard',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [2,1,0,0,0,1,2],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(0, 'hard',
    [0,0,0,0,0,0,0],
    [0,2,1,1,1,2,0],
    [0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0],
    [1,1,0,0,0,1,1],
  ),

  // ═══════════════════════════════════════
  // TYPE 1: Horizontal path (left ↔ right)
  // Platforms span the full width, maybe with small gaps
  // ═══════════════════════════════════════

  T(1, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(1, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,0,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(1, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0],
  ),
  T(1, 'medium',
    [0,0,0,0,0,0,0],
    [4,4,4,4,4,4,4],
    [0,0,0,0,0,0,0],
    [1,1,1,0,1,1,1],
    [0,0,0,0,0,0,0],
  ),
  T(1, 'medium',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,0,0,0,1,1],
    [0,0,0,0,0,0,0],
    [0,4,4,4,4,4,0],
  ),
  T(1, 'hard',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,2,0,0,0,2,1],
    [0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0],
  ),
  T(1, 'hard',
    [0,0,0,0,0,0,0],
    [2,1,0,0,0,1,2],
    [0,0,0,0,0,0,0],
    [0,0,1,0,1,0,0],
    [0,0,0,0,0,0,0],
  ),

  // ═══════════════════════════════════════
  // TYPE 2: Horizontal + Descends (path goes down)
  // Must have gap or ladder for downward movement
  // ═══════════════════════════════════════

  T(2, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,3,1,1,1],
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
  ),
  T(2, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,0,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(2, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,3,1,1,1,1],
    [0,0,3,0,0,0,0],
    [0,0,3,0,0,0,0],
  ),
  T(2, 'medium',
    [0,0,0,0,0,0,0],
    [4,4,4,4,4,0,0],
    [1,1,0,0,1,3,1],
    [0,0,0,0,0,3,0],
    [0,0,0,0,0,3,0],
  ),
  T(2, 'medium',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,0,0,1,1],
    [0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0],
  ),
  T(2, 'hard',
    [0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0],
    [2,1,0,0,0,1,2],
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
  ),
  T(2, 'hard',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,2,1,0,1,2,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),

  // ═══════════════════════════════════════
  // TYPE 3: Horizontal + Ascends (path comes from below)
  // Must have ladder going up or open top
  // ═══════════════════════════════════════

  T(3, 'easy',
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
    [1,1,1,3,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(3, 'easy',
    [0,0,3,0,0,0,0],
    [0,0,3,0,0,0,0],
    [1,1,3,1,1,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(3, 'easy',
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1],
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
  ),
  T(3, 'medium',
    [0,0,0,0,0,3,0],
    [0,0,0,0,0,3,0],
    [1,1,0,0,1,3,1],
    [0,0,0,0,0,0,0],
    [0,4,4,4,4,0,0],
  ),
  T(3, 'medium',
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
    [1,1,0,3,0,1,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),
  T(3, 'hard',
    [0,0,0,0,3,0,0],
    [0,0,0,0,3,0,0],
    [2,1,0,0,3,1,2],
    [0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0],
  ),
  T(3, 'hard',
    [0,3,0,0,0,0,0],
    [0,3,0,0,0,0,0],
    [1,3,1,0,1,2,1],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
  ),

  // ═══════════════════════════════════════
  // TYPE 4: Vertical shaft (up + down)
  // Ladder runs through the room vertically
  // ═══════════════════════════════════════

  T(4, 'easy',
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
    [1,1,1,3,1,1,1],
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
  ),
  T(4, 'easy',
    [0,0,3,0,0,0,0],
    [0,0,3,0,0,0,0],
    [0,0,3,1,1,1,0],
    [0,0,3,0,0,0,0],
    [0,0,3,0,0,0,0],
  ),
  T(4, 'medium',
    [0,0,0,0,3,0,0],
    [0,0,0,0,3,0,0],
    [1,1,0,0,3,0,1],
    [0,0,0,0,3,0,0],
    [0,0,0,0,3,0,0],
  ),
  T(4, 'medium',
    [0,0,0,3,0,0,0],
    [0,0,0,3,0,0,0],
    [0,1,0,3,0,1,0],
    [0,0,0,3,0,0,0],
    [0,4,4,3,4,4,0],
  ),
  T(4, 'hard',
    [0,0,0,0,0,3,0],
    [0,0,0,0,0,3,0],
    [2,1,0,0,0,3,2],
    [0,0,0,0,0,3,0],
    [0,0,4,4,4,3,0],
  ),
  T(4, 'hard',
    [0,3,0,0,0,0,0],
    [0,3,0,0,0,0,0],
    [0,3,2,0,2,1,0],
    [0,3,0,0,0,0,0],
    [0,3,0,0,0,0,0],
  ),
];

/**
 * Select a random template matching the given type and difficulty ceiling.
 * At difficulty 0.0: only 'easy'. At 0.5: easy + medium. At 1.0: all.
 */
export function selectTemplate(type: number, difficulty: number): RoomTemplate {
  let maxTier: 'easy' | 'medium' | 'hard' = 'easy';
  if (difficulty > 0.6) maxTier = 'hard';
  else if (difficulty > 0.3) maxTier = 'medium';

  const tiers: Set<string> = new Set(['easy']);
  if (maxTier === 'medium' || maxTier === 'hard') tiers.add('medium');
  if (maxTier === 'hard') tiers.add('hard');

  const candidates = ROOM_TEMPLATES.filter(t => t.type === type && tiers.has(t.difficulty));
  if (candidates.length === 0) {
    // Fallback: any template of this type
    const fallback = ROOM_TEMPLATES.filter(t => t.type === type);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
