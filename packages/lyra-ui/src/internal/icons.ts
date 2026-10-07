import { svg, type SVGTemplateResult } from 'lit';

/**
 * Shared inline-SVG icon set. Every component in this library previously
 * rendered functional icons (chevrons, close buttons, play/pause, the
 * date-input calendar toggle) as literal Unicode/HTML-entity/emoji text
 * glyphs — font-dependent, non-recolorable beyond plain text color, and
 * inconsistent in weight/size across the OS/browser font stack a host page
 * happens to ship. These replace all of them.
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

/** Paired vertical chevrons indicate a sortable column with no active direction. */
export function sortIcon(): SVGTemplateResult {
  return icon(svg`<polyline points="8 8 12 4 16 8"></polyline><polyline points="8 16 12 20 16 16"></polyline>`);
}

/** An "x" close/clear glyph. */
export function closeIcon(): SVGTemplateResult {
  return icon(svg`
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  `);
}

/** A three-bar "hamburger" glyph, for navigation and menu toggles. */
export function menuIcon(): SVGTemplateResult {
  return icon(svg`
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <line x1="4" y1="12" x2="20" y2="12"></line>
    <line x1="4" y1="17" x2="20" y2="17"></line>
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

/** Two circular arrows, for a refresh/"show another" action. */
export function refreshIcon(): SVGTemplateResult {
  return icon(svg`<path d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4m-4 4a8 8 0 0 0 14.9 4M20 19v-4h-4"></path>`);
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

/** A generic file/document glyph. */
export function fileIcon(): SVGTemplateResult {
  return icon(svg`<path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline>`);
}

/** A folder glyph. */
export function folderIcon(): SVGTemplateResult {
  return icon(svg`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>`);
}

/** A four-corner "expand to fullscreen" glyph. */
export function expandIcon(): SVGTemplateResult {
  return icon(svg`
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="9 21 3 21 3 15"></polyline>
    <line x1="21" y1="3" x2="14" y2="10"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
  `);
}

/** A three-quarter-arc spinner glyph. Rotate the wrapping part element via CSS animation for a loading state. */
export function spinnerIcon(): SVGTemplateResult {
  return icon(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

/** An open-eye glyph, for a password field's "show" toggle. */
export function eyeIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `);
}

/** A slashed-eye glyph, for a password field's "hide" toggle. */
export function eyeOffIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06"></path>
    <path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"></path>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  `);
}

/** A pinned conversation glyph. */
export function pinIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M12 17v5"></path>
    <path d="M9 3h6l1 6 3 3v2H5v-2l3-3Z"></path>
  `);
}

/** An archive box glyph. */
export function archiveIcon(): SVGTemplateResult {
  return icon(svg`
    <rect x="3" y="4" width="18" height="4" rx="1"></rect>
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path>
    <line x1="10" y1="13" x2="14" y2="13"></line>
  `);
}

/** A trash bin glyph. */
export function trashIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M4 7h16"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M6 7l1 14h10l1-14"></path>
    <path d="M9 7V4h6v3"></path>
  `);
}

/** A pencil glyph. */
export function pencilIcon(): SVGTemplateResult {
  return icon(svg`<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>`);
}

/** A paper-plane send glyph. */
export function sendIcon(): SVGTemplateResult {
  return icon(svg`<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>`);
}

/** A circular regenerate glyph. */
export function regenerateIcon(): SVGTemplateResult {
  return icon(svg`
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  `);
}

/** A retry glyph. */
export function retryIcon(): SVGTemplateResult {
  return icon(svg`<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>`);
}

/** A filled square stop glyph. */
export function stopIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${VIEW_BOX}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
    ><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
  `;
}

/** A conversation feedback thumb, with `filled` reserved for the pressed state. */
export function thumbIcon(direction: 'up' | 'down', filled: boolean): SVGTemplateResult {
  const cuff = direction === 'up'
    ? 'M7 11v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z'
    : 'M17 13V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v8h4Z';
  const hand = direction === 'up'
    ? 'M7 11l3.5-7A2 2 0 0 1 12 3a1 1 0 0 1 1 1v6h4.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.3 21H9a2 2 0 0 1-2-2v-8Z'
    : 'M17 13l-3.5 7A2 2 0 0 1 12 21a1 1 0 0 1-1-1v-6H6.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 7.7 3H15a2 2 0 0 1 2 2v8Z';
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${VIEW_BOX}
      fill=${filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width=${STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><path d=${cuff}></path><path d=${hand}></path></svg>
  `;
}
