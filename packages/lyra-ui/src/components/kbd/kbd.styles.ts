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
    /* The body font, not a monospace stack — unlike lyra-code-block's own
       local --lyra-code-block-font token, a key cap's content is mostly
       single characters and modifier glyphs (⌘⇧⌥), which read more legibly
       — and have more complete glyph coverage — in the UI font than in a
       monospace stack that may not even ship those symbols. */
    font-family: var(--lyra-font);
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--lyra-color-text-quiet);
  }

  [part='key'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: 1.5em;
    padding: 0.0625rem var(--lyra-space-xs);
    border: 1px solid var(--lyra-color-border);
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-weight: 500;
    /* A subtle bottom-weighted inset shadow reads as a slightly-raised
       physical key cap rather than a flat label chip, echoing the
       lyra-chip/lyra-checkbox box's own bordered-box treatment. */
    box-shadow: inset 0 -1px 0 var(--lyra-color-border);
  }

  .sep {
    margin-inline: 0.1875rem;
    color: var(--lyra-color-text-quiet);
    font-size: 0.75em;
    user-select: none;
  }

  ::slotted(*) {
    vertical-align: middle;
  }
`;
