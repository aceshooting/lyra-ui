import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: grid;
    gap: var(--lr-style-panel-gap, var(--lr-space-m));
    min-inline-size: 0;
  }

  [part='accent'] {
    display: grid;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='accent-label'] {
    font-size: var(--lr-form-control-label-font-size, inherit);
    font-weight: var(--lr-form-control-label-font-weight, var(--lr-font-weight-semibold));
    color: var(--lr-form-control-label-color, var(--lr-color-text));
  }

  [part='reset'] {
    justify-self: start;
  }
`;
