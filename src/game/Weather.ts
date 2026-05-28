import { WeatherType } from '@/types';

export interface WeatherEffects {
  particles: boolean;
  particleType: 'rain' | 'sunshine' | 'wind' | 'none';
  floodRows: number;
  ropesSway: boolean;
}

export function getSpeedMultiplier(
  _weather: WeatherType,
  _entity: 'player' | 'duck'
): number {
  return 1;
}

export function getWeatherEffects(weather: WeatherType): WeatherEffects {
  switch (weather) {
    case WeatherType.Rain:
      return { particles: true, particleType: 'rain', floodRows: 0, ropesSway: false };
    case WeatherType.Sunshine:
      return { particles: true, particleType: 'sunshine', floodRows: 0, ropesSway: false };
    case WeatherType.TradeWinds:
      return { particles: true, particleType: 'wind', floodRows: 0, ropesSway: true };
    case WeatherType.HighTide:
      return { particles: false, particleType: 'none', floodRows: 2, ropesSway: false };
    default:
      return { particles: false, particleType: 'none', floodRows: 0, ropesSway: false };
  }
}
