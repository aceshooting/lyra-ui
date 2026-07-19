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
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-dialog-overlay-color);
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
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    overflow: auto;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
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
    padding: var(--lr-space-l);
    overflow: auto;
  }
  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
