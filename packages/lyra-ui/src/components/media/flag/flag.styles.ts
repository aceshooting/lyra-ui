import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    aspect-ratio: var(--lr-flag-aspect-ratio, 4 / 3);
    block-size: var(--lr-size-1em);
    line-height: 0;
    vertical-align: middle;
  }
  [part='image'] {
    display: block;
    block-size: 100%;
    inline-size: 100%;
    border-radius: var(--lr-flag-radius, calc(var(--lr-radius) * 0.33));
    box-shadow: 0 0 0 var(--lr-size-1px) var(--lr-color-border) inset;
    object-fit: var(--lr-flag-object-fit, cover);
  }
  [part='error'] {
    display: inline-block;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  :host([round]) {
    block-size: var(--lr-size-1em);
    inline-size: var(--lr-size-1em);
  }
  :host([round]) [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
  }
`;
