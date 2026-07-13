import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-widget's --lyra-widget-overlay-color). */
    --lyra-dialog-overlay-color: rgb(0 0 0 / 0.5);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, 1000);
    align-items: center;
    justify-content: center;
    padding: var(--lyra-space-l);
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
    /* --lyra-dialog-max-width lets a consumer widen/narrow the panel per
       instance (e.g. inline on the host) without overriding the whole rule --
       same convention as lyra-media-card's --lyra-media-card-max-height. */
    max-inline-size: min(var(--lyra-dialog-max-width, 32rem), 100%);
    max-block-size: 100%;
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: auto;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    font-weight: 600;
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
    border-block-start: 1px solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
