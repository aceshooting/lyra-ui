import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .glyph {
    display: inline-flex;
    font-size: var(--lr-help-icon-size, var(--lr-size-1em));
  }
  [part~='popover'] {
    --lr-overlay-max-inline-size: var(--lr-help-max-inline-size, var(--lr-size-20rem));
  }
`;
