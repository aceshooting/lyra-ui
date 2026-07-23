import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  [part='heading'],
  [part='runs-heading'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-lg);
  }
  [part='slices'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
  [part~='slice'],
  [part~='metric'],
  [part='run'] {
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part~='slice'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part~='metric'] {
    min-inline-size: 0;
    padding: var(--lr-space-xs);
    text-align: start;
  }
  [part~='slice-selected'],
  [part~='metric-selected'] {
    border-color: var(--lr-color-brand);
  }
  [part~='slice']:hover,
  [part~='metric']:hover,
  [part='run']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part~='slice']:focus-visible,
  [part~='metric']:focus-visible,
  [part='run']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='metrics'] {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--lr-size-10rem), 1fr));
    gap: var(--lr-space-s);
  }
  [part='chart'] {
    min-inline-size: 0;
  }
  [part='runs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='run'] {
    display: flex;
    justify-content: space-between;
    gap: var(--lr-space-s);
    align-items: center;
    inline-size: 100%;
    padding: var(--lr-space-s);
    text-align: start;
  }
  @container (max-inline-size: 319.98px) {
    [part='metrics'] {
      grid-template-columns: 1fr;
    }
    [part='run'] {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
