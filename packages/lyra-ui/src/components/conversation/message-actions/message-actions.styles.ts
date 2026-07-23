import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
  }
  :host([reveal-on-hover]) {
    opacity: 0;
    transition: opacity var(--lr-transition-fast);
  }
  :host([reveal-on-hover][data-revealed]) {
    opacity: 1;
  }
  @media (hover: none) {
    :host([reveal-on-hover]) {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :host([reveal-on-hover]) {
      transition: none;
    }
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs);
    max-inline-size: 100%;
  }
  [part~='regenerate-button'],
  [part~='edit-button'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size -- same "small glyph, padded hit box" pattern as
       lr-code-block's/lr-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-75rem);
    block-size: var(--lr-size-1-75rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part~='regenerate-button']:hover,
  [part~='edit-button']:hover {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  [part~='regenerate-button']:focus-visible,
  [part~='edit-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
