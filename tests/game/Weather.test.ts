import { describe, it, expect } from 'vitest';
import { getSpeedMultiplier, getWeatherEffects } from '@/game/Weather';
import { WeatherType } from '@/types';

describe('Weather', () => {
  it('no modifier for none weather', () => {
    expect(getSpeedMultiplier(WeatherType.None, 'player')).toBe(1);
    expect(getSpeedMultiplier(WeatherType.None, 'duck')).toBe(1);
  });

  it('sunshine speeds up both player and ducks', () => {
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'player')).toBe(1.15);
    expect(getSpeedMultiplier(WeatherType.Sunshine, 'duck')).toBe(1.15);
  });

  it('rain slows both player and ducks', () => {
    expect(getSpeedMultiplier(WeatherType.Rain, 'player')).toBe(0.8);
    expect(getSpeedMultiplier(WeatherType.Rain, 'duck')).toBe(0.8);
  });

  it('trade winds slow ducks but not player', () => {
    expect(getSpeedMultiplier(WeatherType.TradeWinds, 'player')).toBe(1);
    expect(getSpeedMultiplier(WeatherType.TradeWinds, 'duck')).toBe(0.75);
  });

  it('high tide has no speed effect', () => {
    expect(getSpeedMultiplier(WeatherType.HighTide, 'player')).toBe(1);
    expect(getSpeedMultiplier(WeatherType.HighTide, 'duck')).toBe(1);
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
