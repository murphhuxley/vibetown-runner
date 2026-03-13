import { describe, it, expect } from 'vitest';
import { getSpeedMultiplier, getWeatherEffects } from '@/game/Weather';
import { WeatherType } from '@/types';
import { SUNSHINE_SPEED_MULTIPLIER, RAIN_SPEED_MULTIPLIER } from '@/constants';

describe('Weather', () => {
  it('no modifier for none weather', () => {
    expect(getSpeedMultiplier(WeatherType.None, 'player')).toBe(1);
  });

  it('sunshine speeds up player', () => {
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'player')).toBe(SUNSHINE_SPEED_MULTIPLIER);
  });

  it('sunshine does not speed up ducks', () => {
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'duck')).toBe(1);
  });

  it('rain slows everyone', () => {
    expect(getSpeedMultiplier(WeatherType.Rain, 'player')).toBe(RAIN_SPEED_MULTIPLIER);
    expect(getSpeedMultiplier(WeatherType.Rain, 'duck')).toBe(RAIN_SPEED_MULTIPLIER);
  });

  it('returns weather visual effects config', () => {
    const effects = getWeatherEffects(WeatherType.Rain);
    expect(effects.particles).toBe(true);
    expect(effects.particleType).toBe('rain');
  });

  it('high tide returns flood config', () => {
    const effects = getWeatherEffects(WeatherType.HighTide);
    expect(effects.floodRows).toBeGreaterThan(0);
  });
});
