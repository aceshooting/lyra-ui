import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    box-sizing: border-box;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='toolbar'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Meets the shared minimum tappable size (same --lr-icon-button-size
       floor as lr-code-block's [part='toggle']) -- the toolbar has ample
       room (flex + justify-content: space-between), so the button box
       itself grows rather than relying on invisible hit-slop. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='previous-icon'],
  [part='next-icon'] {
    display: inline-flex;
  }
  [part='previous-icon'] { transform: rotate(180deg); }
  :host(:dir(rtl)) [part='previous-icon'] { transform: rotate(0deg); }
  :host(:dir(rtl)) [part='next-icon'] { transform: rotate(180deg); }
  [part='mount'] {
    flex: 1 1 auto;
    min-block-size: var(--lr-size-10rem);
    overflow: hidden;
  }
  [part='mount'] iframe {
    display: block;
    border: none;
  }
  .status-note,
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    text-align: center;
  }
  .status-note { color: var(--lr-color-text-quiet); }
  [part='error'] { color: var(--lr-color-danger); }
`;
