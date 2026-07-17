import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-page-rail-height: var(--lyra-size-24rem);
  }
  [part='base'] {
    display: block;
  }
  [part='pages'] {
    --lyra-virtual-list-height: var(--lyra-page-rail-height);
  }
  [part='page'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-s);
    border: none;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text);
    cursor: pointer;
    box-sizing: border-box;
  }
  [part='page']:hover {
    background: var(--lyra-color-surface-raised);
  }
  [part='page']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='page'][aria-current='true'] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='thumbnail'] {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lyra-size-4rem);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='page-number'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='heat'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    inset-inline-end: var(--lyra-space-xs);
  }
  [part='heat-dot'] {
    inline-size: var(--lyra-size-6px);
    block-size: var(--lyra-size-6px);
    border-radius: 50%;
    background: var(--lyra-color-brand);
    font-size: var(--lyra-font-size-2xs);
  }
  [part='heat-dot'][data-tone='success'] {
    background: var(--lyra-color-success);
  }
  [part='heat-dot'][data-tone='warning'] {
    background: var(--lyra-color-warning);
  }
  [part='heat-dot'][data-tone='danger'] {
    background: var(--lyra-color-danger);
  }
  [part='heat-dot'][data-tone='neutral'] {
    background: var(--lyra-color-text-quiet);
  }
  [part='heat-dot'][data-overflow='true'] {
    inline-size: auto;
    block-size: auto;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    color: var(--lyra-color-text-quiet);
  }
`;
