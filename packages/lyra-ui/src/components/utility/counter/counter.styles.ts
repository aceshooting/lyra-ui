import { css } from 'lit';
import { visuallyHidden } from '../../../internal/a11y.js';

export const styles = css`
  :host {
    display: inline-flex;
    position: relative;
    font-variant-numeric: tabular-nums;
  }

  [part='base'] {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--lr-counter-gap, var(--lr-size-0-5em));
    line-height: var(--lr-line-height-compact);
    min-inline-size: 0;
  }

  .sr-only {
    ${visuallyHidden}
    user-select: none;
    -webkit-user-select: none;
  }

  [part='unit'] {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  [part='label'] {
    font-size: max(var(--lr-size-0-5em), var(--lr-font-size-2xs));
  }

  /* A clock reads left to right even in a right-to-left page. */
  :host([without-labels]) [part='base'] {
    direction: ltr;
  }

  :host([without-labels]) [part='label'] {
    display: none;
  }

  /* The visible label is stacked over the widest label of every unit so the width stays steady. */
  .label-stack {
    display: inline-grid;
    justify-items: center;
  }

  .label-stack > * {
    grid-area: 1 / 1;
  }

  .sizer {
    visibility: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  [part='delimiter'] {
    margin-inline: calc(var(--lr-counter-gap, var(--lr-size-0-5em)) * -0.5);
  }

  [part='finished'] {
    display: contents;
  }

  [part='finished'][hidden] {
    display: none;
  }
`;
