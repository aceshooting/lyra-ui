import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width when it's a flex/grid
       item in a consumer's own narrow layout -- the default min-width:auto for flex
       items would otherwise force the scroll container wide. */
    min-inline-size: 0;
    max-inline-size: 100%;
    --lyra-segmented-track-min-height: auto;
    --lyra-segmented-segment-padding: var(--lyra-size-0-125rem) var(--lyra-space-s);
    --lyra-segmented-font-size: var(--lyra-font-size-sm);
  }
  :host([size='2xs']) {
    --lyra-segmented-track-min-height: var(--lyra-size-1-25rem);
    --lyra-segmented-segment-padding: var(--lyra-size-0-0625rem) var(--lyra-space-2xs);
    --lyra-segmented-font-size: var(--lyra-font-size-2xs);
  }
  :host([size='xs']) {
    --lyra-segmented-track-min-height: var(--lyra-size-1-5rem);
    --lyra-segmented-segment-padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    --lyra-segmented-font-size: var(--lyra-font-size-xs);
  }
  :host([size='s']) {
    --lyra-segmented-track-min-height: var(--lyra-size-1-875rem);
    --lyra-segmented-segment-padding: var(--lyra-space-xs) var(--lyra-space-xs);
    --lyra-segmented-font-size: var(--lyra-font-size-sm);
  }
  :host([size='l']) {
    --lyra-segmented-track-min-height: var(--lyra-size-3rem);
    --lyra-segmented-segment-padding: var(--lyra-space-s) var(--lyra-space-m);
    --lyra-segmented-font-size: var(--lyra-font-size-lg);
  }
  :host([size='xl']) {
    --lyra-segmented-track-min-height: var(--lyra-size-3-5rem);
    --lyra-segmented-segment-padding: var(--lyra-space-m) var(--lyra-space-l);
    --lyra-segmented-font-size: var(--lyra-font-size-xl);
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
    min-block-size: var(--lyra-segmented-track-min-height);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-size-0-125rem);
    gap: var(--lyra-size-0-125rem);
    /* This is intentionally static: the edge fade is a low-cost affordance for an overflowing
       row and does not need scroll-position JavaScript or observers. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lyra-color-shadow) var(--lyra-scroll-fade-size),
      var(--lyra-color-shadow) calc(100% - var(--lyra-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lyra-color-shadow) var(--lyra-scroll-fade-size),
      var(--lyra-color-shadow) calc(100% - var(--lyra-scroll-fade-size)),
      transparent
    );
  }
  [part='segment'] {
    min-inline-size: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.7);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: var(--lyra-segmented-font-size);
    padding: var(--lyra-segmented-segment-padding);
    cursor: pointer;
  }
  [part='segment-icon'] {
    display: inline-flex;
    align-items: center;
    margin-inline-end: var(--lyra-space-xs);
    block-size: var(--lyra-size-1em);
    max-inline-size: var(--lyra-size-2-5rem);
  }
  [part='segment'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='segment']:hover:not([aria-disabled='true']):not([aria-checked='true']) {
    color: var(--lyra-color-text);
  }
  [part='segment']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='segment'][aria-checked='true'] {
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
    box-shadow: var(--lyra-shadow);
  }
`;
