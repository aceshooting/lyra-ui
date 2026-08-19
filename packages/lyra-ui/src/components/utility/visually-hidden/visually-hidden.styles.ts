import { css } from 'lit';

export const styles = css`
  /* The clip-rect + 1px-box technique, not display: none or visibility: hidden -- those drop the
     content from the accessibility tree as well as the viewport, and the point here is that
     assistive technology still reaches it. */
  :host {
    position: absolute !important;
    inline-size: var(--lr-size-1px) !important;
    block-size: var(--lr-size-1px) !important;
    clip-path: inset(50%) !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    padding: 0 !important;
    border: none !important;
  }

  /* Skip-link behaviour: once something inside takes focus the content must become visible, or a
     keyboard user lands on a control they cannot see. */
  :host(:focus-within) {
    position: static !important;
    inline-size: auto !important;
    block-size: auto !important;
    clip-path: none !important;
    overflow: visible !important;
    white-space: normal !important;
  }
`;
