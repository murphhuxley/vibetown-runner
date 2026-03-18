import { COLORS } from '@/constants';

export type AnimStyle = 'rotate' | 'wave' | 'drift' | 'rainbow' | 'pulse' | 'bloom' | 'sweep' | 'shimmer' | 'cosmic';

export interface LevelTheme {
  name: string;
  district: string;
  animStyle: AnimStyle;
  bgTop: string;
  bgBottom: string;
  sandFill: string;
  sandLine: string;
  sandHighlight: string;
  sandShadow: string;
  coralFill: string;
  coralHighlight: string;
  coralShadow: string;
  ladder: string;
  rope: string;
  badgeFill: string;
  badgeGlow: string;
  badgeText: string;
}

// Shared brick palettes per district
const BRICKS = {
  nature:    { sandFill: '#6B4830', sandLine: '#5A3820', sandHighlight: '#886040', sandShadow: '#3A2010', coralFill: '#4A3018', coralHighlight: '#6B4830', coralShadow: '#3A2010' },
  beach:     { sandFill: '#A0724A', sandLine: '#8A5E38', sandHighlight: '#C09060', sandShadow: '#704828', coralFill: '#8A5E38', coralHighlight: '#A0724A', coralShadow: '#604020' },
  city:      { sandFill: '#505860', sandLine: '#404850', sandHighlight: '#687078', sandShadow: '#303838', coralFill: '#383840', coralHighlight: '#505860', coralShadow: '#282830' },
  rainbow:   { sandFill: '#383838', sandLine: '#282828', sandHighlight: '#505050', sandShadow: '#181818', coralFill: '#202020', coralHighlight: '#383838', coralShadow: '#181818' },
  gray:      { sandFill: '#282828', sandLine: '#1A1A1A', sandHighlight: '#404040', sandShadow: '#101010', coralFill: '#141414', coralHighlight: '#282828', coralShadow: '#0A0A0A' },
  flower:    { sandFill: '#603848', sandLine: '#502838', sandHighlight: '#785060', sandShadow: '#381828', coralFill: '#402028', coralHighlight: '#603848', coralShadow: '#301018' },
  future:    { sandFill: '#283840', sandLine: '#182830', sandHighlight: '#405060', sandShadow: '#101820', coralFill: '#202830', coralHighlight: '#283840', coralShadow: '#101820' },
  gold:      { sandFill: '#5A2818', sandLine: '#4A1810', sandHighlight: '#784030', sandShadow: '#301008', coralFill: '#3A1808', coralHighlight: '#5A2818', coralShadow: '#2A1000' },
  cosmic:    { sandFill: '#282048', sandLine: '#1A1038', sandHighlight: '#403860', sandShadow: '#100828', coralFill: '#141028', coralHighlight: '#282048', coralShadow: '#0A0818' },
};

function theme(
  name: string,
  district: string,
  animStyle: AnimStyle,
  bgTop: string,
  bgBottom: string,
  bricks: typeof BRICKS.nature,
  ladder: string,
  rope: string,
): LevelTheme {
  return {
    name, district, animStyle, bgTop, bgBottom,
    ...bricks,
    ladder, rope,
    badgeFill: COLORS.gold,
    badgeGlow: COLORS.vibestrGold,
    badgeText: COLORS.black,
  };
}

export const THEMES: Record<string, LevelTheme> = {
  // ── District 1: Vibetown Nature (Levels 1-3) ──
  'nature-1': theme('Vibetown Grove',     'Vibetown Nature', 'rotate', '#A8E8B0', '#F8B8A8', BRICKS.nature, '#8B6040', '#80E040'),
  'nature-2': theme('Emerald Canopy',     'Vibetown Nature', 'rotate', '#90E8C0', '#F8A8D0', BRICKS.nature, '#8B6040', '#80E040'),
  'nature-3': theme('Golden Meadow',       'Vibetown Nature', 'rotate', '#F8E0A0', '#A8B8F0', BRICKS.nature, '#8B6040', '#80E040'),

  // ── District 2: Beach (Levels 4-6) ──
  'beach-1':  theme('Beach Boardwalk',     'Beach', 'wave', '#A0D0F8', '#F8C8A0', BRICKS.beach, '#D4A860', '#A08050'),
  'beach-2':  theme('Turquoise Cove',      'Beach', 'wave', '#F8A8B8', '#A0F0D0', BRICKS.beach, '#D4A860', '#A08050'),
  'beach-3':  theme('Coral Sunset',        'Beach', 'wave', '#F8D8A0', '#C8A8F0', BRICKS.beach, '#D4A860', '#A08050'),

  // ── District 3: City (Levels 7-9) ──
  'city-1':   theme('Urban Dusk',          'City', 'drift', '#A8B8E0', '#F0C0A8', BRICKS.city, '#8090A0', '#505860'),
  'city-2':   theme('Neon Alley',          'City', 'drift', '#F0E8A8', '#B0A8E8', BRICKS.city, '#8090A0', '#505860'),
  'city-3':   theme('Violet District',     'City', 'drift', '#D0A8F0', '#A8E8B8', BRICKS.city, '#8090A0', '#505860'),

  // ── District 4: Rainbow District (Levels 10-12) ──
  'rainbow-1': theme('Warm Spectrum',      'Rainbow District', 'rainbow', '#F8A8A8', '#A8D8F8', BRICKS.rainbow, '#FF60A0', '#A060FF'),
  'rainbow-2': theme('Cool Spectrum',      'Rainbow District', 'rainbow', '#A8F0B8', '#D8A8F8', BRICKS.rainbow, '#FF60A0', '#A060FF'),
  'rainbow-3': theme('Full Spectrum',      'Rainbow District', 'rainbow', '#F8E8A8', '#A8B0F8', BRICKS.rainbow, '#FF60A0', '#A060FF'),

  // ── District 5: Grayscale District (Levels 13-15) ──
  'gray-1':   theme('Silver Fog',          'Grayscale District', 'pulse', '#F0F0F0', '#909090', BRICKS.gray, '#707070', '#404040'),
  'gray-2':   theme('Charcoal Depths',     'Grayscale District', 'pulse', '#D8D8D8', '#585858', BRICKS.gray, '#707070', '#404040'),
  'gray-3':   theme('Steel Twilight',      'Grayscale District', 'pulse', '#C8D0E0', '#484858', BRICKS.gray, '#707070', '#404040'),

  // ── District 6: Flower District (Levels 16-18) ──
  'flower-1': theme('Rose Garden',         'Flower District', 'bloom', '#F8A0C0', '#A0F8D8', BRICKS.flower, '#E080A0', '#50A060'),
  'flower-2': theme('Lavender Fields',     'Flower District', 'bloom', '#C8A8F8', '#F8E8A0', BRICKS.flower, '#E080A0', '#50A060'),
  'flower-3': theme('Magenta Bloom',       'Flower District', 'bloom', '#F0A0E0', '#A0F8B0', BRICKS.flower, '#E080A0', '#50A060'),

  // ── District 7: Futuristic District (Levels 19-21) ──
  'future-1': theme('Neon Core',           'Futuristic District', 'sweep', '#D8A0F8', '#A0F8E0', BRICKS.future, '#40E0F0', '#FF40A0'),
  'future-2': theme('Synth Grid',          'Futuristic District', 'sweep', '#A0F8B8', '#F8A0C8', BRICKS.future, '#40E0F0', '#FF40A0'),
  'future-3': theme('Electric Dawn',       'Futuristic District', 'sweep', '#A0B8F8', '#F8C8A0', BRICKS.future, '#40E0F0', '#FF40A0'),

  // ── District 8: Chateau de Gold (Levels 22-23) ──
  'gold-1':   theme('Grand Ballroom',      'Chateau de Gold', 'shimmer', '#F8E0A0', '#B8A0E8', BRICKS.gold, '#E0B030', '#B03030'),
  'gold-2':   theme('Amber Vault',         'Chateau de Gold', 'shimmer', '#F8D0A0', '#A0B0E8', BRICKS.gold, '#E0B030', '#B03030'),

  // ── District 9: Cosmic District (Levels 24-25) ──
  'cosmic-1': theme('Nebula Gate',         'Cosmic District', 'cosmic', '#C0A0F0', '#A0E8C8', BRICKS.cosmic, '#A060FF', '#4080FF'),
  'cosmic-2': theme('Event Horizon',       'Cosmic District', 'cosmic', '#A0B8F8', '#F8A8D0', BRICKS.cosmic, '#A060FF', '#4080FF'),
};

export function getTheme(name: string): LevelTheme {
  return THEMES[name] ?? THEMES['nature-1'];
}
