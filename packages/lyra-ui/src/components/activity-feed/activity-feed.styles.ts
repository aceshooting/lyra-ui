import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-activity-feed-max-height: var(--lr-size-16rem);
  }
  [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: none;
    background: none;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='status-dot'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-text-quiet);
  }
  :host([mode='live']) [part='status-dot'] {
    background: var(--lr-color-brand);
    animation: lr-activity-feed-pulse var(--lr-transition-ambient) infinite;
  }
  [part='label'] {
    flex: 0 0 auto;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='summary'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    max-block-size: var(--lr-activity-feed-max-height);
    overflow-y: auto;
    overscroll-behavior: contain;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='body'][hidden] {
    display: none;
  }
  lr-virtual-list {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-activity-feed-max-height);
  }
  [part='entry'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-2xs) var(--lr-space-m);
  }
  [part='entry-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    inline-size: var(--lr-size-1em);
  }
  .tone-dot {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-text-quiet);
  }
  [part='entry'][data-tone='brand'] .tone-dot {
    background: var(--lr-color-brand);
  }
  [part='entry'][data-tone='success'] .tone-dot {
    background: var(--lr-color-success);
  }
  [part='entry'][data-tone='warning'] .tone-dot {
    background: var(--lr-color-warning);
  }
  [part='entry'][data-tone='danger'] .tone-dot {
    background: var(--lr-color-danger);
  }
  [part='entry-text'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    font-size: var(--lr-font-size-sm);
  }
  [part='entry-timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  @keyframes lr-activity-feed-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] {
      transition: none !important;
    }
    [part='status-dot'] {
      animation: none !important;
    }
  }
`;
