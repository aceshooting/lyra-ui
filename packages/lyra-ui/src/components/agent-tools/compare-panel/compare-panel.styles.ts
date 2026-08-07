import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
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
  [part='vote-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. Placed before the selected
     rule deliberately: once a vote is cast, the selected treatment is the state worth showing, and
     the button's own :hover already answers the pointer. */
  [part='vote-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='vote-button']:where([data-selected]) {
    background: var(--lr-compare-panel-selected-background, var(--lr-color-brand-quiet));
    border-color: var(--lr-compare-panel-selected-border-color, var(--lr-color-brand));
    color: var(--lr-compare-panel-selected-color, var(--lr-color-brand));
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='vote-button']:disabled {
    opacity: var(--lr-opacity-disabled);
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
