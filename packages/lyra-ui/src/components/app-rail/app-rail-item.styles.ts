import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--lyra-space-s);
    inline-size: 100%;
    min-block-size: var(--lyra-icon-button-size);
    padding: var(--lyra-space-s);
    border: 0;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text);
    font: inherit;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
  }
  [part='base']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='base'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base'][aria-current='page'] {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-icon-button-size);
    min-inline-size: var(--lyra-icon-button-size);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([icon-only]) [part='label'] {
    position: absolute;
    inline-size: var(--lyra-size-1px);
    block-size: var(--lyra-size-1px);
    padding: 0;
    margin: var(--lyra-size-neg-1px);
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  :host([icon-only]) [part='base'] {
    justify-content: center;
    padding-inline: 0;
  }
  [part='tooltip'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    padding: var(--lyra-size-0-25rem) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-text);
    color: var(--lyra-color-surface);
    font-size: var(--lyra-font-size-sm);
    white-space: nowrap;
    pointer-events: none;
  }
`;
