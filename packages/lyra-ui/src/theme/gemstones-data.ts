/** Stable identifiers for the built-in gemstone accent palette. */
export const GEMSTONE_KEYS = [
  'emerald',
  'peridot',
  'topaz',
  'ruby',
  'tourmaline',
  'amethyst',
  'aquamarine',
  'sapphire',
  'hematite',
] as const;

export type GemstoneKey = (typeof GEMSTONE_KEYS)[number];

/** Shared visual data for a gemstone accent. Labels intentionally stay in the consumer so they
 * can use the application's localization catalog and can be presented in any order. */
export interface GemstoneAccent {
  key: GemstoneKey;
  fill: string;
  deep: string;
}

/** The canonical gemstone accent palette. Consumers may choose a different order and default
 * value when mapping this record into `lr-swatch-picker` options. */
export const GEMSTONES: Readonly<Record<GemstoneKey, GemstoneAccent>> = {
  emerald: { key: 'emerald', fill: '#34d399', deep: '#1d4f3b' },
  peridot: { key: 'peridot', fill: '#a8d84a', deep: '#3a4a1a' },
  topaz: { key: 'topaz', fill: '#f0a83c', deep: '#5c421a' },
  ruby: { key: 'ruby', fill: '#e63950', deep: '#5c1626' },
  tourmaline: { key: 'tourmaline', fill: '#ec4899', deep: '#5c1f3a' },
  amethyst: { key: 'amethyst', fill: '#9d6df0', deep: '#3a1f5c' },
  aquamarine: { key: 'aquamarine', fill: '#22d3ee', deep: '#164e63' },
  sapphire: { key: 'sapphire', fill: '#4f8ff7', deep: '#1b2f57' },
  hematite: { key: 'hematite', fill: '#94a3b8', deep: '#334155' },
};

/** Recommended shared default. A consumer can choose another default by passing `value`. */
export const DEFAULT_GEMSTONE: GemstoneKey = 'emerald';
