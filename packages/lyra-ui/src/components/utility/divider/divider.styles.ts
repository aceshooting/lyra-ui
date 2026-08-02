import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] {
    border: 0;
    border-block-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border));
    margin-block: var(--spacing, 0);
    margin-inline: 0;
  }
  :host(:where([orientation='vertical'], [vertical])) { display: inline-block; block-size: 100%; }
  :host(:where([orientation='vertical'], [vertical])) [part='base'] {
    block-size: 100%;
    border-block-start: 0;
    border-inline-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border));
    margin-block: 0;
    margin-inline: var(--spacing, 0);
  }
`;
