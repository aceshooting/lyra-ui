import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='header'],
  [part='notice'],
  [part='nav'] {
    padding: var(--lr-space-s) var(--lr-space-m);
  }
  [part='header'] {
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='header'][hidden],
  [part='nav'][hidden] { display: none; }
  [part='notice'] {
    margin: 0;
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
  }
  [part='nav'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part='previous-button'],
  [part='next-button'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size -- same "small glyph, padded hit box" pattern as
       lr-code-block's/lr-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-2rem);
    block-size: var(--lr-size-2rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='previous-button']:hover,
  [part='next-button']:hover { background: var(--lr-color-brand-quiet); }
  [part='previous-button']:disabled,
  [part='next-button']:disabled { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='previous-icon'], [part='next-icon'] { display: inline-flex; }
  [part='previous-icon'] { transform: rotate(180deg); }
  :host(:dir(rtl)) [part='previous-icon'] { transform: rotate(0deg); }
  :host(:dir(rtl)) [part='next-icon'] { transform: rotate(180deg); }
  [part='slide-count'] { color: var(--lr-color-text-quiet); white-space: nowrap; }
  [part='container'] { min-block-size: var(--lr-size-10rem); overflow: auto; position: relative; }
  [part='error'] { padding: var(--lr-space-l); color: var(--lr-color-danger); }
  lr-skeleton { display: block; min-block-size: var(--lr-size-10rem); }
`;
