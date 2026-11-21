import { svg, type SVGTemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { REFRESH_ICON_PATH, SEARCH_ICON_PATH } from './icon-paths.js';

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

/**
 * The library's decorative inline-SVG frame: a 24-unit viewBox, 1.75 stroke, `1em` square, hidden
 * from assistive technology. Wraps `paths`; an optional `part` names the svg element itself.
 */
export function iconFrame(paths: SVGTemplateResult, part?: string): SVGTemplateResult {
  return svg`
    <svg
      part=${ifDefined(part)}
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
  return iconFrame(svg`<polyline points="9 6 15 12 9 18"></polyline>`);
}

/** A downward arrow into a tray. */
export function downloadIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M12 3v12 M7 11l5 5 5-5 M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>`);
}

/** Paired vertical chevrons indicate a sortable column with no active direction. */
export function sortIcon(): SVGTemplateResult {
  return iconFrame(svg`<polyline points="8 8 12 4 16 8"></polyline><polyline points="8 16 12 20 16 16"></polyline>`);
}

/** An "x" close/clear glyph. */
export function closeIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  `);
}

/** A three-bar "hamburger" glyph, for navigation and menu toggles. */
export function menuIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <line x1="4" y1="12" x2="20" y2="12"></line>
    <line x1="4" y1="17" x2="20" y2="17"></line>
  `);
}

/** A right-pointing play triangle. */
export function playIcon(): SVGTemplateResult {
  return iconFrame(svg`<polygon points="6 4 20 12 6 20 6 4"></polygon>`);
}

/** Two vertical pause bars. */
export function pauseIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
  `);
}

/** Two circular arrows, for a refresh/"show another" action. */
export function refreshIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d=${REFRESH_ICON_PATH}></path>`);
}

/** A calendar/date glyph, for date-input's open-calendar toggle. */
export function calendarIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <rect x="3" y="5" width="18" height="16" rx="2"></rect>
    <line x1="16" y1="3" x2="16" y2="7"></line>
    <line x1="8" y1="3" x2="8" y2="7"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  `);
}

/** A generic file/document glyph. */
export function fileIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><polyline points="14 2 14 8 20 8"></polyline>`);
}

/** A folder glyph. */
export function folderIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>`);
}

/** A four-corner "expand to fullscreen" glyph. */
export function expandIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="9 21 3 21 3 15"></polyline>
    <line x1="21" y1="3" x2="14" y2="10"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
  `);
}

/** A three-quarter-arc spinner glyph. Rotate the wrapping part element via CSS animation for a loading state. */
export function spinnerIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

/** An open-eye glyph, for a password field's "show" toggle. */
export function eyeIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `);
}

/** A slashed-eye glyph, for a password field's "hide" toggle. */
export function eyeOffIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06"></path>
    <path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"></path>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  `);
}

/** A pinned conversation glyph. */
export function pinIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M12 17v5"></path>
    <path d="M9 3h6l1 6 3 3v2H5v-2l3-3Z"></path>
  `);
}

/** An archive box glyph. */
export function archiveIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <rect x="3" y="4" width="18" height="4" rx="1"></rect>
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path>
    <line x1="10" y1="13" x2="14" y2="13"></line>
  `);
}

/** A trash bin glyph. */
export function trashIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M4 7h16"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M6 7l1 14h10l1-14"></path>
    <path d="M9 7V4h6v3"></path>
  `);
}

/** A pencil glyph. */
export function pencilIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>`);
}

/** A paper-plane send glyph. */
export function sendIcon(): SVGTemplateResult {
  return iconFrame(svg`<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>`);
}

/** A circular regenerate glyph. */
export function regenerateIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  `);
}

/** A retry glyph. */
export function retryIcon(): SVGTemplateResult {
  return iconFrame(svg`<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>`);
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

/** A confirmation checkmark; the library's one "done" glyph (copy confirmation, checked state). */
export function checkIcon(): SVGTemplateResult {
  return iconFrame(svg`<polyline points="5 12.5 10 17.5 19 6.5"></polyline>`);
}

/** A generic two-rectangle "copy" glyph. */
export function copyIcon(): SVGTemplateResult {
  return iconFrame(svg`<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`);
}

/** A circle with a clock hand: a step that has not started. */
export function statusPendingIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>`);
}

/** A three-quarter arc, spun by each component's running-status CSS animation; a full circle would not convey rotation. */
export function statusRunningIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M21 12a9 9 0 1 1-9-9"></path>`);
}

/** A circle with a checkmark: succeeded or approved. */
export function statusSuccessIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline>`);
}

/** A circle with a cross: failed or denied by the user. */
export function statusErrorIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="9" y1="9" x2="15" y2="15"></line>
    <line x1="15" y1="9" x2="9" y2="15"></line>
  `);
}

/** A circle with a diagonal slash: blocked by policy rather than failed at run time. */
export function statusDeniedIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><line x1="6" y1="18" x2="18" y2="6"></line>`);
}

/** A circle with a level dash: stopped short, neither succeeded nor failed. */
export function statusIncompleteIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><line x1="8" y1="12" x2="16" y2="12"></line>`);
}

/** A magnifier, for search fields. */
export function searchIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d=${SEARCH_ICON_PATH}></path>`);
}

/** A question mark in a circle, for a help or explanation disclosure. */
export function helpIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9.3a2.5 2.5 0 0 1 4.85.85c0 1.65-2.45 2.2-2.45 3.6"></path><path d="M12 16.9v.01"></path>`);
}

/** An exclamation mark in a circle: a failure state legible without relying on colour. */
export function errorCircleIcon(): SVGTemplateResult {
  return iconFrame(svg`<circle cx="12" cy="12" r="9"></circle><path d="M12 7.25v5.5"></path><path d="M12 16.4v.01"></path>`);
}

/** An exclamation mark in a triangle, for a warning or failed-action state. */
export function warningIcon(): SVGTemplateResult {
  return iconFrame(svg`<path d="M12 3 2 21h20L12 3Z M12 9v5 M12 17h.01"></path>`);
}

/** A plus sign, for zoom-in and add actions. */
export function plusIcon(): SVGTemplateResult {
  return iconFrame(svg`<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`);
}

/** A minus sign, for zoom-out and remove actions. */
export function minusIcon(): SVGTemplateResult {
  return iconFrame(svg`<line x1="5" y1="12" x2="19" y2="12"></line>`);
}

/** Four corner brackets, for a "fit to view" action. */
export function fitIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <polyline points="9 3 3 3 3 9"></polyline>
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="3 15 3 21 9 21"></polyline>
    <polyline points="21 15 21 21 15 21"></polyline>
  `);
}

/** A closed padlock. */
export function lockClosedIcon(): SVGTemplateResult {
  return iconFrame(svg`<rect x="4" y="11" width="16" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>`);
}

/** An open padlock. */
export function lockOpenIcon(): SVGTemplateResult {
  return iconFrame(svg`<rect x="4" y="11" width="16" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 7.4-2"></path>`);
}
