import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  /* Density escape, as lr-empty's compact. Cards render in lists, so the tuned values sit behind
     inline var() fallbacks rather than a :host declaration every instance would re-declare,
     shadowing any ancestor value; a list can then retune every card at once. The fallbacks are the
     pre-existing values one step down, so an unset card is unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-source-card-compact-padding, var(--lr-space-xs));
    gap: var(--lr-source-card-compact-gap, var(--lr-space-2xs));
  }
  /* MUST stay after :host([compact]): both are :host([x]) [part='base'], equal specificity, so
     source order alone decides which padding/gap wins on a card that is both. plain is the stronger
     statement -- no chrome at all -- so it goes last; its title and toggle affordances are
     brand-colored text with a hover underline, never a border, so they stay legible without it. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='title'] {
    align-self: flex-start;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part='title']:hover {
    text-decoration: underline;
  }
  /* Both affordances are transparent-backed brand-colored text (see the frame='plain' note above),
     so the pressed signal is a wash mixed from that transparent base; the label keeps its brand
     color to stay readable as a link. */
  [part='title']:active {
    text-decoration: underline;
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='title']:focus-visible,
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='excerpt'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='excerpt'][hidden] {
    display: none;
  }
  [part='toggle'] {
    align-self: flex-start;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    cursor: pointer;
  }
  [part='toggle']:hover {
    text-decoration: underline;
  }
  [part='toggle']:active {
    text-decoration: underline;
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='full'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='full'][hidden] {
    display: none;
  }
`;
