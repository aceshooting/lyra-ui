import { css } from 'lit';

export const styles = css`
  :host { display: inline-flex; vertical-align: middle; }
  [part='base'] { display: inline-flex; align-items: center; gap: var(--lyra-space-xs); min-inline-size: 0; }
  [part='icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-file-icon-size, var(--lyra-size-2rem));
    block-size: var(--lyra-file-icon-size, var(--lyra-size-2rem));
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-bold);
    line-height: var(--lyra-line-height-none);
    text-transform: uppercase;
  }
  [part='label'] { min-inline-size: 0; color: var(--lyra-color-text); }
`;
