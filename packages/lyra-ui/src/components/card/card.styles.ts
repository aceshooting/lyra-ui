import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    text-decoration: none;
    overflow: hidden;
  }
  :host([appearance='filled']) [part='base'] {
    border-color: transparent;
    background: var(--lyra-color-brand-quiet);
  }
  :host([appearance='filled-outlined']) [part='base'] {
    background: var(--lyra-color-brand-quiet);
  }
  :host([appearance='accent']) [part='base'] {
    border-color: transparent;
    border-inline-start: var(--lyra-size-3px) solid var(--lyra-color-brand);
  }
  :host([appearance='plain']) [part='base'] {
    border-color: transparent;
    background: transparent;
  }
  :host([interactive]) [part='base'] {
    cursor: pointer;
    transition: border-color var(--lyra-transition-fast);
  }
  :host([interactive]) [part='base']:hover {
    border-color: var(--lyra-color-brand);
  }
  :host([interactive]) [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='media'][hidden],
  [part='header'][hidden],
  [part='footer'][hidden] {
    display: none;
  }
  [part='media'] ::slotted(*) {
    display: block;
    inline-size: 100%;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 0 auto;
    margin-inline-start: auto;
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='body'] {
    padding: var(--lyra-space-m);
    flex: 1 1 auto;
  }
  [part='footer'] {
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
`;
