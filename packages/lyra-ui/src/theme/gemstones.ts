import { css, html, type CSSResult, type TemplateResult } from 'lit';

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

/**
 * The shared "selected" presentation for a rendered `gemstoneGlyph()` -- a looping brightness
 * shine plus a themeable coloured drop-shadow halo -- applied to any element carrying the
 * `data-lr-gemstone-selected` boolean attribute (typically the element wrapping the glyph, since
 * `filter`/`drop-shadow` follows the alpha shape of everything painted inside it regardless of
 * which ancestor carries the declaration).
 *
 * `lr-swatch-picker mode="gemstone"` sets this same attribute on its own checked swatch icon and
 * includes this exact stylesheet rather than keeping a private copy, so the two presentations
 * cannot drift. A consumer rendering the same glyph outside a picker -- for example a header
 * trigger button showing the currently selected accent, which opens the picker in a popover --
 * gets the identical treatment by adding this export to their own component's `static styles` and
 * setting the attribute, with no need to fork the keyframes, the halo, or the reduced-motion rule.
 *
 * Genuinely stops the loop under `prefers-reduced-motion: reduce` (a hand-written
 * `animation: none`) rather than merely shortening it: the shared ambient duration token this
 * treatment defaults to already collapses to an imperceptibly fast, but still infinite, loop
 * under reduced motion, which is not the same as a stopped one.
 *
 * @cssprop [--lr-gemstone-selected-color=var(--lr-color-brand)] - Halo colour.
 * @cssprop [--lr-gemstone-selected-blur=var(--lr-size-0-5rem)] - Halo blur radius.
 * @cssprop [--lr-gemstone-selected-shine-duration=var(--lr-transition-ambient)] - Shine loop
 *   duration.
 */
export const gemstoneSelectedGlyphStyles: CSSResult = css`
  [data-lr-gemstone-selected] {
    filter: drop-shadow(
        0 0
          var(--lr-gemstone-selected-blur, var(--lr-size-0-5rem))
          var(--lr-gemstone-selected-color, var(--lr-color-brand))
      )
      brightness(1);
    animation: lr-gemstone-selected-shine
      var(--lr-gemstone-selected-shine-duration, var(--lr-transition-ambient))
      infinite;
  }
  @keyframes lr-gemstone-selected-shine {
    0%,
    100% {
      filter: drop-shadow(
          0 0
            var(--lr-gemstone-selected-blur, var(--lr-size-0-5rem))
            var(--lr-gemstone-selected-color, var(--lr-color-brand))
        )
        brightness(1);
    }
    50% {
      filter: drop-shadow(
          0 0
            var(--lr-gemstone-selected-blur, var(--lr-size-0-5rem))
            var(--lr-gemstone-selected-color, var(--lr-color-brand))
        )
        brightness(1.4);
    }
  }
  /* The shared ambient duration token this treatment defaults to only shrinks under reduced
     motion, per internal/tokens.styles.ts, to an imperceptibly fast loop -- still infinite, not
     stopped -- so the animation is hand-disabled here too, matching every other looping
     animation in this library. */
  @media (prefers-reduced-motion: reduce) {
    [data-lr-gemstone-selected] {
      animation: none;
    }
  }
`;
