import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-widget's --lyra-widget-overlay-color). */
    --lyra-dialog-overlay-color: var(--lyra-color-overlay);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    padding-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    padding-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
    padding-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    /* --lyra-dialog-width is an assertive width (unset/auto by default -- the panel shrink-wraps to
       content, unchanged) capped by the same max-inline-size below and by the viewport. */
    inline-size: var(--lyra-dialog-width, auto);
    /* --lyra-dialog-max-width lets a consumer widen/narrow the panel per
       instance (e.g. inline on the host) without overriding the whole rule --
       same convention as lyra-media-card's --lyra-media-card-max-height. When
       --lyra-dialog-width is set but --lyra-dialog-max-width is left at its
       default, the cap falls back to the requested width itself (not the
       32rem default) so an assertive width isn't silently clipped by the
       old shrink-to-fit cap -- the viewport (100%) is still a hard limit. */
    max-inline-size: min(var(--lyra-dialog-max-width, var(--lyra-dialog-width, var(--lyra-size-32rem))), 100%);
    max-block-size: 100%;
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: auto;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    font-weight: var(--lyra-font-weight-semibold);
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
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='close-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='close-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='close-button'] svg {
    display: block;
  }
  [part='body'] {
    padding: var(--lyra-space-l);
    overflow: auto;
  }
  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
