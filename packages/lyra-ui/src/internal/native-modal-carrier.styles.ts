import { css } from 'lit';

/** Shared viewport host frame for modal surfaces promoted with the Popover API. */
export const modalHostStyles = css`
  display: none;
  position: fixed;
  inset: 0;
  z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
  margin: 0;
  border: none;
  background: transparent;
  color: inherit;
  overflow: visible;
  inline-size: auto;
  block-size: auto;
`;

/** Transparent viewport frame; adapters retain their existing backdrop and panel styling. */
export const nativeModalCarrierStyles = css`
  dialog[data-native-modal-carrier]:modal {
    display: flex;
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    margin: 0;
    border: 0;
    padding: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    inline-size: auto;
    block-size: auto;
    max-inline-size: none;
    max-block-size: none;
    overflow: visible;
    align-items: inherit;
    justify-content: inherit;
  }
  dialog[data-native-modal-carrier]::backdrop {
    background: transparent;
  }
`;
