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
    z-index: 1000;
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
    max-inline-size: min(32rem, 100%);
    max-block-size: 100%;
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: auto;
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
