import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part='base'] {
    max-inline-size: 100%;
  }
  .row {
    display: flex;
    gap: var(--lyra-space-xs);
  }
  :host([wrap]) .row {
    flex-wrap: wrap;
  }
  [part~='chip'] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lyra-space-2xs);
    flex: 0 0 auto;
    max-inline-size: 16rem;
    padding-inline: var(--lyra-space-m);
    padding-block: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
    min-block-size: var(--lyra-size-2-5rem);
  }
  [part~='chip']:hover {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
  [part~='chip']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='chip-label'] {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    inline-size: 100%;
  }
  [part='chip-detail'] {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    inline-size: 100%;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }
`;
