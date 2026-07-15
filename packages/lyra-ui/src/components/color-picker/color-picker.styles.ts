import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='form-control'] { display: inline-flex; flex-direction: column; gap: var(--lyra-space-xs); }
  [part='label'] { color: var(--lyra-color-text); font-size: var(--lyra-font-size-md-sm); }
  [part='input'] { inline-size: var(--lyra-size-2-5rem); block-size: var(--lyra-size-2-5rem); padding: var(--lyra-size-2px); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); cursor: pointer; }
  [part='hint'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
`;
