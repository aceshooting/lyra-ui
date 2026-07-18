import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='header'],
  [part='notice'],
  [part='nav'] {
    padding: var(--lyra-space-s) var(--lyra-space-m);
  }
  [part='header'] {
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='header'][hidden],
  [part='nav'][hidden] { display: none; }
  [part='notice'] {
    margin: 0;
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    color: var(--lyra-color-warning);
    font-size: var(--lyra-font-size-sm);
  }
  [part='nav'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-s);
  }
  [part='previous-button'],
  [part='next-button'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size -- same "small glyph, padded hit box" pattern as
       lyra-code-block's/lyra-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-2rem);
    block-size: var(--lyra-size-2rem);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled { opacity: var(--lyra-opacity-disabled); cursor: not-allowed; }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='previous-icon'], [part='next-icon'] { display: inline-flex; }
  [part='previous-icon'] { transform: rotate(180deg); }
  :host(:dir(rtl)) [part='previous-icon'] { transform: rotate(0deg); }
  :host(:dir(rtl)) [part='next-icon'] { transform: rotate(180deg); }
  [part='slide-count'] { color: var(--lyra-color-text-quiet); white-space: nowrap; }
  [part='container'] { min-block-size: var(--lyra-size-10rem); overflow: auto; position: relative; }
  [part='error'] { padding: var(--lyra-space-l); color: var(--lyra-color-danger); }
  lyra-skeleton { display: block; min-block-size: var(--lyra-size-10rem); }
`;
