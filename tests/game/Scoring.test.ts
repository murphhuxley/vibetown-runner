import { describe, it, expect } from 'vitest';
import { createScoring, collectBadge, trapDuck, killDuck, powerKillDuck, collectVibestr, completeLevel } from '@/game/Scoring';
import { SCORE_BADGE, SCORE_TRAP_DUCK, SCORE_KILL_DUCK, SCORE_POWER_KILL, SCORE_VIBESTR, SCORE_LEVEL_COMPLETE, SCORE_LFV_BONUS, STARTING_LIVES } from '@/constants';

describe('Scoring', () => {
  it('starts with zero score and starting lives', () => {
    const s = createScoring();
    expect(s.score).toBe(0);
    expect(s.lives).toBe(STARTING_LIVES);
  });

  it('awards points for collecting a badge', () => {
    const s = createScoring();
    collectBadge(s);
    expect(s.score).toBe(SCORE_BADGE);
    expect(s.badgesCollected).toBe(1);
  });

  it('awards points for trapping a duck', () => {
    const s = createScoring();
    trapDuck(s);
    expect(s.score).toBe(SCORE_TRAP_DUCK);
  });

  it('awards points for killing a duck', () => {
    const s = createScoring();
    killDuck(s);
    expect(s.score).toBe(SCORE_KILL_DUCK);
  });

  it('awards points for vibestr', () => {
    const s = createScoring();
    collectVibestr(s);
    expect(s.score).toBe(SCORE_VIBESTR);
    expect(s.vibestr).toBe(1);
  });

  it('awards level completion bonus without changing lives directly', () => {
    const s = createScoring();
    completeLevel(s, false);
    expect(s.score).toBe(SCORE_LEVEL_COMPLETE);
    expect(s.lives).toBe(STARTING_LIVES);
  });

  it('awards premium points for power helmet kill', () => {
    const s = createScoring();
    powerKillDuck(s);
    expect(s.score).toBe(SCORE_POWER_KILL);
  });

  it('awards LFV bonus when meter unused', () => {
    const s = createScoring();
    completeLevel(s, true);
    expect(s.score).toBe(SCORE_LEVEL_COMPLETE + SCORE_LFV_BONUS);
  });
});
