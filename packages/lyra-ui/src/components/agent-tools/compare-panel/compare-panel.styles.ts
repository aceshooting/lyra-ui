import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    --lr-compare-panel-max-height: var(--lr-size-24rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    color: var(--lr-color-text);
  }

  [part='prompt'] {
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
  }
  [part='prompt'][hidden] {
    display: none;
  }

  [part='panes'] {
    display: flex;
    gap: var(--lr-space-m);
    align-items: stretch;
  }

  [part='pane-a'],
  [part='pane-b'] {
    flex: 1 1 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
    max-block-size: var(--lr-compare-panel-max-height);
    overflow-y: auto;
  }
  [part='pane-a']:focus-visible,
  [part='pane-b']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='pane-header'] {
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-02em);
  }

  [part='vote-bar'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }

  [part='vote-button'] {
    font: inherit;
    font-size: var(--lr-font-size-sm);
    border-radius: var(--lr-radius-pill);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), border-color var(--lr-transition-fast);
  }
  [part='vote-button'][data-selected] {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='vote-button']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  [part='vote-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @container (max-inline-size: 639.98px) {
    [part='panes'] {
      flex-direction: column;
    }
  }
`;
