import {
  SCORE_BADGE, SCORE_TRAP_DUCK, SCORE_KILL_DUCK,
  SCORE_VIBESTR, SCORE_LEVEL_COMPLETE, SCORE_LFV_BONUS,
  STARTING_LIVES
} from '@/constants';

export interface ScoringState {
  score: number;
  lives: number;
  badgesCollected: number;
  vibestr: number;
}

export function createScoring(): ScoringState {
  return {
    score: 0,
    lives: STARTING_LIVES,
    badgesCollected: 0,
    vibestr: 0,
  };
}

export function collectBadge(s: ScoringState): void {
  s.score += SCORE_BADGE;
  s.badgesCollected++;
}

export function trapDuck(s: ScoringState): void {
  s.score += SCORE_TRAP_DUCK;
}

export function killDuck(s: ScoringState): void {
  s.score += SCORE_KILL_DUCK;
}

export function collectVibestr(s: ScoringState): void {
  s.score += SCORE_VIBESTR;
  s.vibestr++;
}

export function completeLevel(s: ScoringState, lfvUnused: boolean): void {
  s.score += SCORE_LEVEL_COMPLETE;
  if (lfvUnused) s.score += SCORE_LFV_BONUS;
}
