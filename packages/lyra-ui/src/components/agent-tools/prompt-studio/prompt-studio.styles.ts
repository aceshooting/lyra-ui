import { css } from 'lit';

export const styles = css`
  :host { display: block; container-type: inline-size; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='toolbar'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); align-items: center; }
  [part='toolbar'] h2 { min-inline-size: 0; flex: 1; margin: 0; font-size: var(--lr-font-size-lg); }
  [part='editor'] { display: grid; grid-template-columns: minmax(0, 2fr) minmax(var(--lr-size-12rem), 1fr); gap: var(--lr-space-m); }
  [part='messages'] { display: flex; flex-direction: column; gap: var(--lr-space-s); margin: 0 0 var(--lr-space-s); padding: 0; list-style: none; }
  [part='message'] { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--lr-space-xs); align-items: start; }
  [part='message-role'], [part='message-content'], [part='variable'] input {
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='message-content'] { min-block-size: var(--lr-size-6rem); padding: var(--lr-space-s); resize: vertical; }
  [part='variables'], [part='versions'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part='variables'] h3, [part='preview'] h3 { margin: 0; font-size: var(--lr-font-size-base); }
  [part='variable'] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--lr-space-xs); }
  [part='variable'] input { min-inline-size: 0; padding-inline: var(--lr-space-s); }
  [part='toolbar'] button, [part='remove-message'], [part='add-message'], [part='version'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='toolbar'] button:hover, [part='remove-message']:hover, [part='add-message']:hover, [part='version']:hover { background: var(--lr-color-surface-raised); }
  [part='toolbar'] button:focus-visible, [part='remove-message']:focus-visible, [part='add-message']:focus-visible, [part='version']:focus-visible,
  [part='message-role']:focus-visible, [part='message-content']:focus-visible, [part='variable'] input:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset);
  }
  button:disabled, textarea:disabled, input:disabled, select:disabled { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  [part='preview'] { padding: var(--lr-space-m); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); }
  [part='preview'] article { display: grid; grid-template-columns: var(--lr-size-6rem) minmax(0, 1fr); gap: var(--lr-space-s); padding-block: var(--lr-space-xs); }
  [part='preview'] pre { min-inline-size: 0; margin: 0; color: var(--lr-color-text); font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  @container (max-inline-size: 40rem) { [part='editor'] { grid-template-columns: 1fr; } }
  @container (max-inline-size: 319.98px) {
    [part='message'], [part='variable'], [part='preview'] article { grid-template-columns: 1fr; }
    [part='remove-message'] { justify-self: end; }
  }
`;
