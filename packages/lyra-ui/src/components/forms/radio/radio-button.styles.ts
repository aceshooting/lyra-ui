import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    /* WCAG 2.5.8: the whole button is the target, so it carries the same floor every other
       interactive part in the library does. */
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
    font: inherit;
    line-height: var(--lr-line-height-snug);
    cursor: pointer;
    transition: background var(--lr-transition-fast), border-color var(--lr-transition-fast);

    /* Sitting among sibling radio buttons they read as one segmented control: square the shared
       inner edges and round only the outer ones. :of-type counts only lr-radio-button
       siblings, so a group's slot="label"/slot="hint" children never shift the ends, and the
       owning group needs to cooperate in no way at all. A lone button matches both ends and comes
       out fully rounded. Logical radii, so RTL mirrors without a :dir() rule. */
    border-radius: 0;
  }
  :host(:first-of-type) [part='base'] {
    border-start-start-radius: var(--lr-radius);
    border-end-start-radius: var(--lr-radius);
  }
  :host(:last-of-type) [part='base'] {
    border-start-end-radius: var(--lr-radius);
    border-end-end-radius: var(--lr-radius);
  }
  :host(:not(:first-of-type)) [part='base'] {
    margin-inline-start: calc(-1 * var(--lr-border-width-thin));
  }

  [part='base']:hover {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  [part='base']:active {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  :host(:focus-visible) [part='base'],
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    /* The ring must not be painted under the overlapping neighbour's border. */
    position: relative;
    z-index: var(--lr-layer-content);
  }

  /* State lives in the part name, never as ::part(base)[aria-checked] -- an attribute selector
     after ::part() never matches. */
  [part~='checked'] {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
  }
  [part~='checked']:hover,
  [part~='checked']:active {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
  }
  [part~='disabled'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
`;
