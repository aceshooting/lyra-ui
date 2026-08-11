import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-widget's --lr-widget-overlay-color). */
    --lr-dialog-overlay-color: var(--lr-color-overlay);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    /* The host is promoted into the browser top layer through the popover API while it is open,
       so no consumer stacking context can trap it. The z-index above is only the fallback for a
       user agent without popover support. These six declarations neutralize the user-agent
       styles that come with the popover attribute (a fit-content auto-margined box with a solid
       border, its own padding, and an opaque Canvas background), leaving the host exactly the
       full-viewport transparent frame it was before. */
    margin: 0;
    border: none;
    background: transparent;
    overflow: visible;
    inline-size: auto;
    block-size: auto;
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  /* The exit animation needs the panel to stay rendered after open flips to false. The attribute
     is written by the component for exactly as long as that animation runs, and is removed again
     before lr-after-hide fires. Pointer input is dead for that window so a dismissing dialog
     cannot swallow a click meant for the page underneath. */
  :host([data-closing]) {
    display: flex;
    pointer-events: none;
  }
  [part~='base'] {
    display: contents;
  }
  [part~='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-dialog-overlay-color);
    backdrop-filter: var(--backdrop-filter, var(--lr-dialog-backdrop-filter, none));
  }
  [part~='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* --lr-dialog-width is an assertive width (unset/auto by default -- the panel shrink-wraps to
       content, unchanged) capped by the same max-inline-size below and by the viewport. */
    inline-size: var(--width, var(--lr-dialog-width, auto));
    /* --lr-dialog-max-width lets a consumer widen/narrow the panel per
       instance (e.g. inline on the host) without overriding the whole rule --
       same convention as lr-media-card's --lr-media-card-max-height. When
       --lr-dialog-width is set but --lr-dialog-max-width is left at its
       default, the cap falls back to the requested width itself (not the
       32rem default) so an assertive width isn't silently clipped by the
       old shrink-to-fit cap -- the viewport (100%) is still a hard limit. */
    max-inline-size: min(var(--lr-dialog-max-width, var(--width, var(--lr-dialog-width, var(--lr-size-32rem)))), 100%);
    max-block-size: 100%;
    /* The modal-panel surface, NOT the page surface. In dark mode --lr-color-surface is the same
       near-black as the page behind the scrim, so a dialog painted with it reads as a scrim with
       text floating on it and no panel at all. In light mode the token still resolves to the page
       surface, so nothing changes there. */
    background: var(--lr-color-surface-overlay);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Modal layer, and the deepest one: a centered dialog floats free on all four edges over a
       scrim, so it takes the top step of the elevation scale. lr-drawer, which extends this rule,
       steps back down to --lr-shadow-l because three of its edges are flush with the viewport. */
    box-shadow: var(--lr-shadow-xl);
    overflow: auto;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    padding: var(--header-spacing, var(--spacing, var(--lr-dialog-spacing-block, var(--lr-space-m)) var(--lr-dialog-spacing, var(--lr-space-l))));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part~='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='header-actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    margin-inline-start: auto;
  }
  [part~='close-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  /* Once a header-actions group has claimed the auto margin, the close button must not claim a
     second one or it would be pushed away from the group it belongs beside. */
  [part='header-actions'] + [part~='close-button'] {
    margin-inline-start: 0;
  }
  [part~='close-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Pressed drives the hover's quiet brand fill further toward --lr-color-mix-partner (which
     follows the text colour), so it darkens on a light theme and lightens on a dark one without
     this rule knowing which is in force -- the property filter: brightness() never had. The glyph
     colour is restated rather than left to the hover rule because keyboard activation raises
     :active with no :hover. */
  [part~='close-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-brand);
  }
  [part~='close-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='close-button'] svg {
    display: block;
  }
  [part='body'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--body-spacing, var(--spacing, var(--lr-dialog-spacing, var(--lr-space-l))));
    overflow: auto;
    overflow-wrap: anywhere;
  }
  /* The body carries tabindex="-1" so an overflowing dialog can be scrolled from the keyboard;
     once it can hold focus it has to say so. Inset offset because the body is flush with the
     panel edges, where an outset ring would be clipped or would overlap the header rule. */
  [part='body']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    padding: var(--footer-spacing, var(--spacing, var(--lr-dialog-spacing-block, var(--lr-space-m)) var(--lr-dialog-spacing, var(--lr-space-l))));
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow-wrap: anywhere;
  }
  /* Footer content is consumer-owned light DOM, so the wrapper's responsive rules do not select
     it directly. Keep each assigned action capable of shrinking to the panel and inherit the
     same emergency-wrap policy for a localized or identifier-like label. */
  [part='footer'] ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
