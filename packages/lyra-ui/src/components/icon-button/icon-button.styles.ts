import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; }
  button { display: inline-flex; align-items: center; justify-content: center; inline-size: var(--lr-icon-button-size); block-size: var(--lr-icon-button-size); padding: 0; border: 0; border-radius: var(--lr-radius); background: transparent; color: inherit; cursor: pointer; }
  button:hover { background: var(--lr-color-surface); }
  button:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  button:disabled { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
`;
