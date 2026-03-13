import { describe, it, expect } from 'vitest';
import {
  createVibeMeter, addVibe, activateLFV, updateLFV, isLFVReady, isLFVActive,
} from '@/game/VibeMeter';
import { VIBE_MAX, VIBE_PER_BADGE, VIBE_PER_TRAP, LFV_DURATION } from '@/constants';

describe('VibeMeter', () => {
  it('starts empty', () => {
    const vm = createVibeMeter();
    expect(vm.meter).toBe(0);
    expect(vm.lfvTimer).toBe(0);
  });

  it('fills on badge collection', () => {
    const vm = createVibeMeter();
    addVibe(vm, 'badge');
    expect(vm.meter).toBe(VIBE_PER_BADGE);
  });

  it('fills on duck trap', () => {
    const vm = createVibeMeter();
    addVibe(vm, 'trap');
    expect(vm.meter).toBe(VIBE_PER_TRAP);
  });

  it('caps at VIBE_MAX', () => {
    const vm = createVibeMeter();
    for (let i = 0; i < 20; i++) addVibe(vm, 'badge');
    expect(vm.meter).toBe(VIBE_MAX);
  });

  it('is ready when meter is full', () => {
    const vm = createVibeMeter();
    vm.meter = VIBE_MAX;
    expect(isLFVReady(vm)).toBe(true);
  });

  it('activates LFV when ready', () => {
    const vm = createVibeMeter();
    vm.meter = VIBE_MAX;
    const activated = activateLFV(vm);
    expect(activated).toBe(true);
    expect(vm.lfvTimer).toBe(LFV_DURATION);
    expect(vm.meter).toBe(0);
    expect(isLFVActive(vm)).toBe(true);
  });

  it('does not activate when meter not full', () => {
    const vm = createVibeMeter();
    vm.meter = 50;
    const activated = activateLFV(vm);
    expect(activated).toBe(false);
    expect(vm.lfvTimer).toBe(0);
  });

  it('LFV timer counts down', () => {
    const vm = createVibeMeter();
    vm.lfvTimer = LFV_DURATION;
    updateLFV(vm, 1000);
    expect(vm.lfvTimer).toBe(LFV_DURATION - 1000);
    expect(isLFVActive(vm)).toBe(true);
  });

  it('LFV deactivates when timer hits 0', () => {
    const vm = createVibeMeter();
    vm.lfvTimer = 500;
    updateLFV(vm, 600);
    expect(vm.lfvTimer).toBe(0);
    expect(isLFVActive(vm)).toBe(false);
  });
});
