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
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-dialog-overlay-color);
    backdrop-filter: var(--lr-dialog-backdrop-filter, none);
    animation: lr-dialog-backdrop-in var(--lr-dialog-backdrop-duration, var(--lr-duration-fast))
      var(--lr-easing-standard) both;
  }
  :host([data-closing]) [part='backdrop'] {
    animation-name: lr-dialog-backdrop-out;
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    /* --lr-dialog-width is an assertive width (unset/auto by default -- the panel shrink-wraps to
       content, unchanged) capped by the same max-inline-size below and by the viewport. */
    inline-size: var(--lr-dialog-width, auto);
    /* --lr-dialog-max-width lets a consumer widen/narrow the panel per
       instance (e.g. inline on the host) without overriding the whole rule --
       same convention as lr-media-card's --lr-media-card-max-height. When
       --lr-dialog-width is set but --lr-dialog-max-width is left at its
       default, the cap falls back to the requested width itself (not the
       32rem default) so an assertive width isn't silently clipped by the
       old shrink-to-fit cap -- the viewport (100%) is still a hard limit. */
    max-inline-size: min(var(--lr-dialog-max-width, var(--lr-dialog-width, var(--lr-size-32rem))), 100%);
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
    /* Duration and easing are referenced as SEPARATE tokens: the compound --lr-transition-*
       tokens expand to a duration plus a timing function, which makes an animation shorthand
       that also names its own easing invalid, and the browser then drops the whole declaration
       silently. Both durations flatten to 0.001ms under prefers-reduced-motion through the
       shared token layer, so the animationend contract still resolves in that branch. */
    animation: lr-dialog-panel-in var(--lr-dialog-panel-duration, var(--lr-duration-base))
      var(--lr-easing-standard) both;
  }
  :host([data-closing]) [part='panel'] {
    animation-name: lr-dialog-panel-out;
  }
  @keyframes lr-dialog-backdrop-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes lr-dialog-backdrop-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes lr-dialog-panel-in {
    from {
      opacity: 0;
      transform: translateY(calc(-1 * var(--lr-size-0-5rem)));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes lr-dialog-panel-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(calc(-1 * var(--lr-size-0-5rem)));
    }
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-dialog-spacing-block, var(--lr-space-m)) var(--lr-dialog-spacing, var(--lr-space-l));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='heading'] {
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
  [part='close-button'] {
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
  [part='header-actions'] + [part='close-button'] {
    margin-inline-start: 0;
  }
  [part='close-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='close-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='close-button'] svg {
    display: block;
  }
  [part='body'] {
    padding: var(--lr-dialog-spacing, var(--lr-space-l));
    overflow: auto;
  }
  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-dialog-spacing-block, var(--lr-space-m)) var(--lr-dialog-spacing, var(--lr-space-l));
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
