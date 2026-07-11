import { svg, type SVGTemplateResult } from 'lit';

/**
 * Shared inline-SVG icon set. Every component in this library previously
 * rendered functional icons (chevrons, close buttons, play/pause, the
 * date-input calendar toggle) as literal Unicode/HTML-entity/emoji text
 * glyphs — font-dependent, non-recolorable beyond plain text color, and
 * inconsistent in weight/size across the OS/browser font stack a host page
 * happens to ship (2026-07-10 design review). These replace all of them.
 *
 * Every icon shares one 24x24 viewBox and one stroke-width so the whole set
 * reads as one visual language; each renders at `1em` so it inherits the
 * caller's own font-size instead of imposing a fixed pixel size. None bakes
 * in a direction/rotation — callers needing "up"/"left"/"open" etc. rotate
 * the *wrapping part element* via CSS `transform: rotate(...)`, not the svg.
 */

const STROKE_WIDTH = '1.75';
const VIEW_BOX = '0 0 24 24';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

/** A single right-pointing chevron. Rotate the wrapping element for other directions. */
export function chevronIcon(): SVGTemplateResult {
  return icon(svg`<polyline points="9 6 15 12 9 18"></polyline>`);
}

/** An "x" close/clear glyph. */
export function closeIcon(): SVGTemplateResult {
  return icon(svg`
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  `);
}

/** A right-pointing play triangle. */
export function playIcon(): SVGTemplateResult {
  return icon(svg`<polygon points="6 4 20 12 6 20 6 4"></polygon>`);
}

/** Two vertical pause bars. */
export function pauseIcon(): SVGTemplateResult {
  return icon(svg`
    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
  `);
}

/** A calendar/date glyph, for date-input's open-calendar toggle. */
export function calendarIcon(): SVGTemplateResult {
  return icon(svg`
    <rect x="3" y="5" width="18" height="16" rx="2"></rect>
    <line x1="16" y1="3" x2="16" y2="7"></line>
    <line x1="8" y1="3" x2="8" y2="7"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  `);
}
