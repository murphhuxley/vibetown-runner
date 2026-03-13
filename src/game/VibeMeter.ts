import { VIBE_MAX, VIBE_PER_BADGE, VIBE_PER_TRAP, LFV_DURATION } from '@/constants';

export interface VibeMeterState {
  meter: number;
  lfvTimer: number;
}

export function createVibeMeter(): VibeMeterState {
  return { meter: 0, lfvTimer: 0 };
}

export function addVibe(vm: VibeMeterState, source: 'badge' | 'trap'): void {
  const amount = source === 'badge' ? VIBE_PER_BADGE : VIBE_PER_TRAP;
  vm.meter = Math.min(vm.meter + amount, VIBE_MAX);
}

export function isLFVReady(vm: VibeMeterState): boolean {
  return vm.meter >= VIBE_MAX;
}

export function isLFVActive(vm: VibeMeterState): boolean {
  return vm.lfvTimer > 0;
}

export function activateLFV(vm: VibeMeterState): boolean {
  if (!isLFVReady(vm)) return false;
  vm.meter = 0;
  vm.lfvTimer = LFV_DURATION;
  return true;
}

export function updateLFV(vm: VibeMeterState, dt: number): void {
  if (vm.lfvTimer > 0) {
    vm.lfvTimer = Math.max(0, vm.lfvTimer - dt);
  }
}
