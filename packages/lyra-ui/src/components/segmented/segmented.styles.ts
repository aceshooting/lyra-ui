import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width when it's a flex/grid
       item in a consumer's own narrow layout -- the default min-width:auto for flex
       items would otherwise force the scroll container wide. */
    min-inline-size: 0;
    max-inline-size: 100%;
    --lr-segmented-track-min-height: auto;
    --lr-segmented-segment-padding: var(--lr-size-0-125rem) var(--lr-space-s);
    --lr-segmented-font-size: var(--lr-font-size-sm);
  }
  :host([size='2xs']) {
    --lr-segmented-track-min-height: var(--lr-size-1-25rem);
    --lr-segmented-segment-padding: var(--lr-size-0-0625rem) var(--lr-space-2xs);
    --lr-segmented-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-segmented-track-min-height: var(--lr-size-1-5rem);
    --lr-segmented-segment-padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    --lr-segmented-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-segmented-track-min-height: var(--lr-size-1-875rem);
    --lr-segmented-segment-padding: var(--lr-space-xs) var(--lr-space-xs);
    --lr-segmented-font-size: var(--lr-font-size-sm);
  }
  :host([size='l']) {
    --lr-segmented-track-min-height: var(--lr-size-3rem);
    --lr-segmented-segment-padding: var(--lr-space-s) var(--lr-space-m);
    --lr-segmented-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-segmented-track-min-height: var(--lr-size-3-5rem);
    --lr-segmented-segment-padding: var(--lr-space-m) var(--lr-space-l);
    --lr-segmented-font-size: var(--lr-font-size-xl);
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
    min-block-size: var(--lr-segmented-track-min-height);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-size-0-125rem);
    gap: var(--lr-size-0-125rem);
    /* This is intentionally static: the edge fade is a low-cost affordance for an overflowing
       row and does not need scroll-position JavaScript or observers. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part='segment'] {
    min-inline-size: 0;
    border: none;
    border-radius: calc(var(--lr-radius) * 0.7);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-segmented-font-size);
    padding: var(--lr-segmented-segment-padding);
    cursor: pointer;
  }
  [part='segment-icon'] {
    display: inline-flex;
    align-items: center;
    margin-inline-end: var(--lr-space-xs);
    block-size: var(--lr-size-1em);
    max-inline-size: var(--lr-size-2-5rem);
  }
  [part='segment'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='segment']:hover:not([aria-disabled='true']):not([aria-checked='true']) {
    color: var(--lr-color-text);
  }
  [part='segment']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='segment'][aria-checked='true'] {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    box-shadow: var(--lr-shadow);
  }
`;
