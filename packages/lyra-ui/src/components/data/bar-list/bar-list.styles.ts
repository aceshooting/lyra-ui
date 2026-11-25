import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  :host {
    display: block;
    font-family: var(--lr-font);
    color: var(--lr-color-text);
  }

  [part='base'] {
    min-inline-size: 0;
    /* Respond to the allocation the list actually receives, not to the viewport. The intrinsic
       size keeps a shrink-to-fit flex or grid placement from collapsing to zero once inline-size
       containment removes content-based sizing. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-16rem);
    box-sizing: border-box;
  }

  [part='list'] {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  /* The bar and the label share the first grid cell, so the label reads over its own bar and the
     value keeps a column of its own at the row's end. */
  [part='row'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: center;
    column-gap: var(--lr-space-s);
    min-inline-size: 0;
  }

  [part='bar'] {
    grid-row: 1;
    grid-column: 1;
    justify-self: start;
    block-size: var(--lr-bar-list-bar-size, var(--lr-size-2rem));
    background: var(--lr-bar-list-bar-color, var(--lr-color-brand-fill-quiet));
    border-radius: var(--lr-radius-xs);
    transition: inline-size var(--lr-transition-base);
  }

  [part='bar']:where([data-variant='neutral']) {
    background: var(--lr-color-neutral-fill-quiet);
  }
  [part='bar']:where([data-variant='brand']) {
    background: var(--lr-color-brand-fill-quiet);
  }
  [part='bar']:where([data-variant='success']) {
    background: var(--lr-color-success-fill-quiet);
  }
  [part='bar']:where([data-variant='warning']) {
    background: var(--lr-color-warning-fill-quiet);
  }
  [part='bar']:where([data-variant='danger']) {
    background: var(--lr-color-danger-fill-quiet);
  }

  [part='label'] {
    grid-row: 1;
    grid-column: 1;
    min-inline-size: 0;
    padding-inline: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    text-align: start;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='value'] {
    grid-row: 1;
    grid-column: 2;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    unicode-bidi: plaintext;
    text-align: end;
  }

  [part='empty'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }

  /* In a narrow allocation a long label wraps instead of truncating, so the row stays readable. */
  @container ${compactContainerQuery} {
    [part='label'] {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  @media (forced-colors: active) {
    [part='bar'] {
      forced-color-adjust: none;
      background: Canvas;
      border: var(--lr-border-width-thin) solid CanvasText;
      box-sizing: border-box;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='bar'] {
      transition: none;
    }
  }
`;
