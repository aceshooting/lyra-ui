import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; }
  button { display: inline-flex; align-items: center; justify-content: center; inline-size: var(--lyra-icon-button-size); block-size: var(--lyra-icon-button-size); padding: 0; border: 0; border-radius: var(--lyra-radius); background: transparent; color: inherit; cursor: pointer; }
  button:hover { background: var(--lyra-color-surface); }
  button:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  button:disabled { opacity: var(--lyra-opacity-disabled); cursor: not-allowed; }
`;
