import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; --lr-icon-button-radius: var(--lr-radius); }
  /* --lr-icon-button-size is a minimum tappable box, not a fixed one: floor both axes so a small
     glyph still pads out to a full target, while slotted content larger than it grows the button
     and keeps its own aspect ratio instead of being squashed to 1:1. */
  button { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: 0; border: 0; border-radius: var(--lr-icon-button-radius); background: transparent; color: inherit; cursor: pointer; }
  button:hover { background: var(--lr-color-surface); }
  button:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  button:disabled { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  /* Mirrors lr-icon's own default box so the bare-geometry SVG fallback sizes the same as a
     named icon glyph would. Only ever mounted (see icon-button.class.ts's hasBareGeometry) when
     there is fallback content to show. */
  [part='fallback'] { display: block; inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); color: inherit; }
`;
