import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-page-rail-height: var(--lr-size-24rem);
  }
  [part='base'] {
    display: block;
  }
  [part='pages'] {
    --lr-virtual-list-height: var(--lr-page-rail-height);
  }
  [part='page'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
    box-sizing: border-box;
  }
  [part='page']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='page']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='page'][aria-current='true'] {
    background: var(--lr-color-brand-quiet);
  }
  [part='thumbnail'] {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-4rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='page-number'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='heat'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    inset-inline-end: var(--lr-space-xs);
  }
  [part='heat-dot'] {
    inline-size: var(--lr-size-6px);
    block-size: var(--lr-size-6px);
    border-radius: 50%;
    background: var(--lr-color-brand);
    font-size: var(--lr-font-size-2xs);
  }
  [part='heat-dot'][data-tone='success'] {
    background: var(--lr-color-success);
  }
  [part='heat-dot'][data-tone='warning'] {
    background: var(--lr-color-warning);
  }
  [part='heat-dot'][data-tone='danger'] {
    background: var(--lr-color-danger);
  }
  [part='heat-dot'][data-tone='neutral'] {
    background: var(--lr-color-text-quiet);
  }
  [part='heat-dot'][data-overflow='true'] {
    inline-size: auto;
    block-size: auto;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
  }
`;
