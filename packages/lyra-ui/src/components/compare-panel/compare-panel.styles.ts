import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    --lyra-compare-panel-max-height: var(--lyra-size-24rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-m);
    color: var(--lyra-color-text);
  }

  [part='prompt'] {
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface-raised);
  }
  [part='prompt'][hidden] {
    display: none;
  }

  [part='panes'] {
    display: flex;
    gap: var(--lyra-space-m);
    align-items: stretch;
  }

  [part='pane-a'],
  [part='pane-b'] {
    flex: 1 1 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-space-m);
    max-block-size: var(--lyra-compare-panel-max-height);
    overflow-y: auto;
  }
  [part='pane-a']:focus-visible,
  [part='pane-b']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }

  [part='pane-header'] {
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-02em);
  }

  [part='vote-bar'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
  }

  [part='vote-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    border-radius: var(--lyra-radius-pill);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    transition: background-color var(--lyra-transition-fast), border-color var(--lyra-transition-fast);
  }
  [part='vote-button'][data-selected] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='vote-button']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  [part='vote-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  @container (max-width: 639.98px) {
    [part='panes'] {
      flex-direction: column;
    }
  }
`;
