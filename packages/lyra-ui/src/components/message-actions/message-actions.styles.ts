import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
  }
  :host([reveal-on-hover]) {
    opacity: 0;
    transition: opacity var(--lyra-transition-fast);
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
    gap: var(--lyra-space-2xs);
    max-inline-size: 100%;
  }
  [part~='regenerate-button'],
  [part~='edit-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-1-75rem);
    block-size: var(--lyra-size-1-75rem);
    padding: 0;
    border: 0;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }
  [part~='regenerate-button']:hover,
  [part~='edit-button']:hover {
    background: var(--lyra-color-surface-raised);
    color: var(--lyra-color-text);
  }
  [part~='regenerate-button']:focus-visible,
  [part~='edit-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  @container (max-width: 20rem) {
    [part='base'] {
      inline-size: 100%;
    }
  }
`;
