import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    min-inline-size: 0;
  }
  /* Density escape -- same convention as lr-empty's compact, and as this component's own sibling
     lr-community-card. The tuned values sit behind inline var() fallbacks (rather than a :host
     declaration, which every instance re-declares and so shadows any ancestor value) so a consumer
     can retune them from outside; the fallbacks are the pre-existing values, so an unset card
     renders unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-entity-card-compact-padding, var(--lr-space-s));
    gap: var(--lr-entity-card-compact-gap, var(--lr-space-xs));
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding/gap wins when a card is both compact
     and plain. plain is the stronger statement ("no chrome at all"), so it goes last. The header's
     focus button and type badge draw their own chrome and stay visible either way. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='title'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part='description'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='properties'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
`;
