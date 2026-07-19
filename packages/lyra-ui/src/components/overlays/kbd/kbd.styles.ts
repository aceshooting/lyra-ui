import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    /* The body font, not a monospace stack — unlike lr-code-block's own
       local --lr-code-block-font token, a key cap's content is mostly
       single characters and modifier glyphs (⌘⇧⌥), which read more legibly
       — and have more complete glyph coverage — in the UI font than in a
       monospace stack that may not even ship those symbols. */
    font-family: var(--lr-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    color: var(--lr-color-text-quiet);
  }

  [part='key'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-size-1-5em);
    padding: var(--lr-size-0-0625rem) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-medium);
    /* A subtle bottom-weighted inset shadow reads as a slightly-raised
       physical key cap rather than a flat label chip, echoing the
       lr-chip/lr-checkbox box's own bordered-box treatment. */
    box-shadow: inset 0 var(--lr-size-neg-1px) 0 var(--lr-color-border);
  }

  .sep {
    margin-inline: var(--lr-size-0-1875rem);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-size-0-75em);
    user-select: none;
  }

  ::slotted(*) {
    vertical-align: middle;
  }
`;
