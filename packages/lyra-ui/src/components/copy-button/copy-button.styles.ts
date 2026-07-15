import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      color var(--lyra-transition-fast);
  }
  /* :where() keeps this rule's specificity low ((0,1,0)) so a consumer's own
     ::part(base):hover override ((0,1,1)) wins without needing !important --
     see lyra-attachment-trigger's identical fix for the same reasoning. */
  :where([part='base']:not(:disabled)):hover {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
    color: var(--lyra-color-text);
  }
  [part='base']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-disabled-opacity);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='base'] svg {
    display: block;
  }
`;
