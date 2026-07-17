import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-activity-feed-max-height: var(--lyra-size-16rem);
  }
  [part='base'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: none;
    background: none;
    color: var(--lyra-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lyra-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='status-dot'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-text-quiet);
  }
  :host([mode='live']) [part='status-dot'] {
    background: var(--lyra-color-brand);
    animation: lyra-activity-feed-pulse var(--lyra-transition-ambient) infinite;
  }
  [part='label'] {
    flex: 0 0 auto;
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='summary'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
    text-align: start;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    max-block-size: var(--lyra-activity-feed-max-height);
    overflow-y: auto;
    overscroll-behavior: contain;
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='body'][hidden] {
    display: none;
  }
  lyra-virtual-list {
    display: block;
    inline-size: 100%;
    block-size: var(--lyra-activity-feed-max-height);
  }
  [part='entry'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-m);
  }
  [part='entry-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    inline-size: var(--lyra-size-1em);
  }
  .tone-dot {
    display: block;
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-text-quiet);
  }
  [part='entry'][data-tone='brand'] .tone-dot {
    background: var(--lyra-color-brand);
  }
  [part='entry'][data-tone='success'] .tone-dot {
    background: var(--lyra-color-success);
  }
  [part='entry'][data-tone='warning'] .tone-dot {
    background: var(--lyra-color-warning);
  }
  [part='entry'][data-tone='danger'] .tone-dot {
    background: var(--lyra-color-danger);
  }
  [part='entry-text'] {
    flex: 1 1 auto;
    min-inline-size: var(--lyra-size-3ch);
    font-size: var(--lyra-font-size-sm);
  }
  [part='entry-timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  @keyframes lyra-activity-feed-pulse {
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
