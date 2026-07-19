import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    --lr-document-compare-pane-max-height: var(--lr-size-24rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    color: var(--lr-color-text);
  }

  [part='diff'] {
    display: block;
  }

  [part='panes'] {
    display: flex;
    gap: var(--lr-space-m);
    align-items: stretch;
  }

  [part='pane-old'],
  [part='pane-new'] {
    flex: 1 1 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
    max-block-size: var(--lr-document-compare-pane-max-height);
    overflow-y: auto;
  }
  [part='pane-old']:focus-visible,
  [part='pane-new']:focus-visible {
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

  [part='pane-empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  @container (max-inline-size: 639.98px) {
    [part='panes'] {
      flex-direction: column;
    }
  }
`;
