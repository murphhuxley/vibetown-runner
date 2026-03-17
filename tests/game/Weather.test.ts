import { describe, it, expect } from 'vitest';
import { getSpeedMultiplier, getWeatherEffects } from '@/game/Weather';
import { WeatherType } from '@/types';

describe('Weather', () => {
  it('no modifier for none weather', () => {
    expect(getSpeedMultiplier(WeatherType.None, 'player')).toBe(1);
  });

  it('sunshine stays visual-only for player movement', () => {
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'player')).toBe(1);
  });

  it('sunshine stays visual-only for ducks too', () => {
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'duck')).toBe(1);
  });

  it('rain stays visual-only for movement', () => {
    expect(getSpeedMultiplier(WeatherType.Rain, 'player')).toBe(1);
    expect(getSpeedMultiplier(WeatherType.Rain, 'duck')).toBe(1);
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
