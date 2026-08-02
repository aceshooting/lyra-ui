import { css } from 'lit';

export const buttonChromeStyles = css`
  [part~='button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    /* WCAG 2.5.8: the whole button is the target. The size ladder drives the height, floored at
       1.5rem/24px so even the 2xs tier stays a conformant target. */
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-1-5rem));
    padding-inline: var(--lr-form-control-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-form-control-font-size);
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
  :host(:first-of-type) [part~='button'] {
    border-start-start-radius: var(--lr-radio-radius);
    border-end-start-radius: var(--lr-radio-radius);
  }
  :host(:last-of-type) [part~='button'] {
    border-start-end-radius: var(--lr-radio-radius);
    border-end-end-radius: var(--lr-radio-radius);
  }
  :host(:not(:first-of-type)) [part~='button'] {
    margin-inline-start: calc(-1 * var(--lr-border-width-thin));
  }

  [part~='button']:hover {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  /* Pressed: the hover's tint carried further toward --lr-color-mix-partner (which follows the text
     colour). This rule used to be byte-identical to the :hover above, which is a pressed state only
     on paper -- a segment that looks exactly the same held down as hovered tells the user nothing
     about whether their click landed. */
  [part~='button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    border-color: var(--lr-color-brand);
  }
  :host(:focus-visible) [part~='button'],
  [part~='button']:focus-visible {
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
  [part~='checked'] [part='label'] {
    color: inherit;
  }
  /* The checked segment keeps its loud brand fill under the pointer -- the quiet tint the unchecked
     rules land on would read as a DESELECTION -- but it still has to move, and the press still has
     to out-read the hover. Both mix the loud fill toward --lr-color-mix-partner, which follows the
     text colour, so the on-brand label stays legible at either share. */
  [part~='checked']:hover {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    border-color: var(--lr-color-brand);
  }
  [part~='checked']:active {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    border-color: var(--lr-color-brand);
  }
  [part~='disabled'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
`;

export const styles = css`
  :host {
    /* Rectangular chrome, so unlike <lr-radio>'s circular indicator this re-points the inherited
       radius knob at the shared control radius -- and swaps it for a pill when the pill property
       is set. Same one name on both tags, so a consumer overriding it does not have to know which
       of the two they are looking at. */
    --lr-radio-radius: var(--lr-form-control-radius);
    display: inline-flex;
  }
  :host([pill]) { --lr-radio-radius: var(--lr-radius-pill); }
  ${buttonChromeStyles}
`;

/** The same chrome scoped to WA's `appearance="button"` mode on `<lr-radio>`. */
export const appearanceStyles = css`
  :host([appearance='button']) {
    --lr-radio-radius: var(--lr-form-control-radius);
    display: inline-flex;
  }
  :host([appearance='button'][pill]) { --lr-radio-radius: var(--lr-radius-pill); }
  ${buttonChromeStyles}
`;
