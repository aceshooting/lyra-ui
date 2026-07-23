import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }

  [part='plot'] {
    display: block;
    inline-size: 100%;
    block-size: auto;
    overflow: visible;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }

  [part='point'] {
    cursor: pointer;
    outline: none;
  }

  [part='point']:hover,
  [part='point']:focus-visible {
    outline: none;
  }

  [part='point']:hover .point-marker,
  [part='point']:focus-visible .point-marker {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-medium);
  }

  [part='point'][data-selected='true'] .point-marker {
    stroke: var(--lr-embedding-explorer-selected-stroke, var(--lr-color-brand));
    stroke-width: var(--lr-border-width-medium);
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }

  @container (max-inline-size: 319.98px) {
    [part='plot'] {
      min-block-size: var(--lr-size-12rem);
    }
  }
`;
