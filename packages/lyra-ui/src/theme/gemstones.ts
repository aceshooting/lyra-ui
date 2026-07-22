import { html, type TemplateResult } from 'lit';

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

/** The canonical faceted gemstone glyph used by `lr-swatch-picker mode="gemstone"`. `color`
 * defaults to `currentColor` so the glyph can inherit its fill from CSS `color` (matching the
 * `1em` sizing convention of `src/internal/icons.ts`) when a caller doesn't need a baked-in
 * literal fill. */
export function gemstoneGlyph(color = 'currentColor'): TemplateResult {
  return html`<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
    <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" fill=${color} />
    <path d="M7 3 8 9 2.6 9 4.6 4.3Z" fill="rgba(255,255,255,0.42)" />
    <path d="M12 9 12 22 16 9Z" fill="rgba(0,0,0,0.14)" />
    <g fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="0.85" stroke-linejoin="round" stroke-linecap="round">
      <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />
      <path d="M2.4 9h19.2" />
    </g>
  </svg>`;
}
