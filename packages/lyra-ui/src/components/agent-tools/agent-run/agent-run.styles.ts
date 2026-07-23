import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-agent-run-spin: var(--lr-transition-ambient);
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
  /* Density escape -- same convention as lr-empty's compact. The tuned values sit behind inline
     var() fallbacks (rather than a :host declaration, which every instance would re-declare and so
     shadow any ancestor value) so a consumer can retune them from outside without restating the
     whole rule; the fallbacks are the pre-existing values, so an unset run renders unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-agent-run-compact-padding, var(--lr-space-s));
    gap: var(--lr-agent-run-compact-gap, var(--lr-space-s));
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding/gap wins when a run is both compact
     and plain. plain is the stronger statement ("no chrome at all"), so it goes last. The built-in
     Cancel/Retry buttons keep their own border/background -- that chrome is theirs, not the card's,
     so a chrome-less run still has a visible interactive affordance. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
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
  [part='summary'][hidden] {
    display: none;
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
  [part='metric-value'][data-variant='danger'] {
    color: var(--lr-agent-run-metric-danger-color, var(--lr-color-danger));
  }
  [part='metric-value'][data-variant='success'] {
    color: var(--lr-agent-run-metric-success-color, var(--lr-color-success));
  }
  [part='metric-value'][data-variant='warning'] {
    color: var(--lr-agent-run-metric-warning-color, var(--lr-color-warning));
  }
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
