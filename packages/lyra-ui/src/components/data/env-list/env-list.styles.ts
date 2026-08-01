import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: fit-content(40%) minmax(0, 1fr);
    gap: var(--lr-space-xs) var(--lr-space-s);
    align-items: baseline;
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
  }
  [part='base'][data-empty] {
    display: block;
  }
  [part='name'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    font-family: var(--lr-font-mono, ui-monospace, monospace);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
    margin: 0;
  }
  [part='value-cell'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
  }
  [part='value'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    font-family: var(--lr-font-mono, ui-monospace, monospace);
    overflow-wrap: anywhere;
  }
  [part='reveal-button'],
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='reveal-button']:hover,
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='reveal-button']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='reveal-button'][aria-pressed='true'] {
    background: var(--lr-env-list-reveal-active-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-env-list-reveal-active-border, var(--lr-color-brand));
  }
  /* MUST stay after the [aria-pressed='true'] rule above: both are (0,2,0), so source order alone
     decides, and a revealed button's toggled-on fill is the same brand-quiet the hover uses -- put
     this first and pressing the one button whose state you are about to flip would show nothing at
     all. Only the fill is claimed, so the toggled border colour still reads while pressed. */
  [part='reveal-button']:active,
  [part='copy-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
`;
