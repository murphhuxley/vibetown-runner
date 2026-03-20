import { WeatherType } from '@/types';

export interface WeatherEffects {
  particles: boolean;
  particleType: 'rain' | 'sunshine' | 'wind' | 'none';
  floodRows: number;
  ropesSway: boolean;
}

export function getSpeedMultiplier(
  weather: WeatherType,
  entity: 'player' | 'duck'
): number {
  switch (weather) {
    case WeatherType.Sunshine:
      return 1.15;
    case WeatherType.Rain:
      return 0.8;
    case WeatherType.TradeWinds:
      return entity === 'duck' ? 0.75 : 1;
    default:
      return 1;
  }
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
