import { html, type TemplateResult } from 'lit';

export {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
} from './gemstones-data.js';
export type { GemstoneAccent, GemstoneKey } from './gemstones-data.js';

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
