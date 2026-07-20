import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  /* Density escape -- same convention as lr-empty's compact. Source cards render in lists, so the
     tuned values sit behind inline var() fallbacks (rather than a :host declaration, which every
     instance re-declares and so shadows any ancestor value) letting a list retune every card at
     once from the outside; the fallbacks are the pre-existing values scaled down one step, so an
     unset card renders unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-source-card-compact-padding, var(--lr-space-xs));
    gap: var(--lr-source-card-compact-gap, var(--lr-space-2xs));
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding/gap wins when a card is both compact
     and plain. plain is the stronger statement ("no chrome at all"), so it goes last. The title and
     toggle affordances are brand-colored text with a hover underline, never a border, so they stay
     legible with no chrome behind them. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='title'] {
    align-self: flex-start;
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
  [part='title']:focus-visible,
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='excerpt'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='excerpt'][hidden] {
    display: none;
  }
  [part='toggle'] {
    align-self: flex-start;
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
  [part='full'] {
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
