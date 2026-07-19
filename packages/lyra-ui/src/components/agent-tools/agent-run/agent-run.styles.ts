import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-agent-run-spin: 1s linear;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    box-sizing: border-box;
    inline-size: 100%;
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--lr-space-m);
    row-gap: var(--lr-space-s);
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='status-message'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: var(--lr-size-16rem);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='elapsed'],
  [part='elapsed-static'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  [part='current-step'] {
    display: flex;
    align-items: center;
    gap: var(--lr-size-0-4em);
    min-inline-size: 0;
    flex: 1 1 auto;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='current-step-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--lr-color-brand);
  }
  [part='current-step-icon'] svg {
    display: block;
    animation: lr-agent-run-spin var(--lr-agent-run-spin) infinite;
  }
  [part='current-step-label'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  [part='summary'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    flex: 0 0 auto;
    font-size: var(--lr-font-size-sm);
  }
  [part='metric'] {
    display: inline-flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    white-space: nowrap;
  }
  [part='metric-label'] {
    color: var(--lr-color-text-quiet);
  }
  [part='metric-value'] {
    font-variant-numeric: tabular-nums;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='metric-value'][data-variant='danger'] { color: var(--lr-color-danger); }
  [part='metric-value'][data-variant='success'] { color: var(--lr-color-success); }
  [part='metric-value'][data-variant='warning'] { color: var(--lr-color-warning); }
  [part='model'] {
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
    margin-inline-start: auto;
  }
  [part='cancel-button'],
  [part='retry-button'] {
    box-sizing: border-box;
    min-block-size: var(--lr-size-1-75rem);
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  [part='cancel-button']:hover {
    border-color: var(--lr-color-danger);
    color: var(--lr-color-danger);
  }
  [part='retry-button']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  [part='cancel-button']:focus-visible,
  [part='retry-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
  }
  @keyframes lr-agent-run-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='cancel-button'],
    [part='retry-button'] {
      transition: none !important;
    }
    [part='current-step-icon'] svg {
      animation: none !important;
    }
  }
`;
