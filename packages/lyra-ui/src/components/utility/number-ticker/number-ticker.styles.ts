import { css } from 'lit';
import { visuallyHidden } from '../../../internal/a11y.js';

export const styles = css`
  :host {
    display: inline-block;
    position: relative;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  [part='base'] {
    display: inline;
  }

  /* While counting, only the final value is copyable. */
  [aria-hidden='true'] {
    user-select: none;
    -webkit-user-select: none;
  }

  .sr-only {
    ${visuallyHidden}
  }
`;
