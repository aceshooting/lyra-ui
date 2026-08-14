import { css } from 'lit';

export const buttonChromeStyles = css`
  :host([data-lr-group-size]) {
    --lr-form-control-height: inherit;
    --lr-form-control-font-size: inherit;
    --lr-form-control-padding-inline: inherit;
    --lr-form-control-padding-block: inherit;
    --lr-form-control-gap: inherit;
    --lr-form-control-radius: inherit;
  }
  [part~='button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-radio-button-gap, var(--lr-space-xs));
    min-inline-size: 0;
    max-inline-size: 100%;
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

    /* Standalone is the safe default. The owning group projects data-run only after measuring
       real adjacency; separated, vertical, mixed, and wrapped controls therefore keep all four
       corners instead of guessing from DOM sibling order. */
    border-radius: var(--lr-radio-radius);
  }
  [part='label'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part~='start'],
  [part~='end'] {
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  [part~='button'][data-run='start'] {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  [part~='button'][data-run='middle'] {
    border-radius: 0;
  }
  [part~='button'][data-run='end'] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }
  [part~='button'][data-run='start'] {
    border-start-start-radius: var(--lr-radio-radius);
    border-end-start-radius: var(--lr-radio-radius);
  }
  [part~='button'][data-run='end'] {
    border-start-end-radius: var(--lr-radio-radius);
    border-end-end-radius: var(--lr-radio-radius);
  }
  [part~='button'][data-run='middle'],
  [part~='button'][data-run='end'] {
    margin-inline-start: calc(-1 * var(--lr-border-width-thin));
  }

  /* :host(:not(:disabled)), not a bare selector -- the interactive element is a plain
     <span role="radio"> that can never match :disabled itself, so without this guard a
     disabled segment still visibly tinted on hover/press, contradicting its own
     not-allowed cursor and reduced opacity. This is a form-associated custom element
     (static formAssociated = true, inherited from LyraRadio), so the UA computes :disabled
     the same way it does for a native control -- from the host's own disabled attribute or
     an ancestor <fieldset disabled>'s cascade -- matching [part~='circle']'s guard in the
     sibling radio.styles.ts exactly. */
  [part~='button']:not([part~='disabled']):hover {
    background: var(--lr-radio-button-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-radio-button-hover-border-color, var(--lr-color-brand));
  }
  /* Pressed: the hover's tint carried further toward --lr-color-mix-partner (which follows the text
     colour). This rule used to be byte-identical to the :hover above, which is a pressed state only
     on paper -- a segment that looks exactly the same held down as hovered tells the user nothing
     about whether their click landed. */
  [part~='button']:not([part~='disabled']):active {
    background: var(--lr-radio-button-active-bg, color-mix(in oklab, var(--lr-radio-button-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
    border-color: var(--lr-radio-button-active-border-color, var(--lr-radio-button-hover-border-color, var(--lr-color-brand)));
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
    background: var(--lr-radio-button-checked-bg, var(--lr-color-brand));
    border-color: var(--lr-radio-button-checked-border-color, var(--lr-color-brand));
    color: var(--lr-radio-button-checked-color, var(--lr-color-on-brand));
  }
  [part~='checked'] [part='label'] {
    color: inherit;
  }
  /* The checked segment keeps its loud brand fill under the pointer -- the quiet tint the unchecked
     rules land on would read as a DESELECTION -- but it still has to move, and the press still has
     to out-read the hover. Both mix the loud fill toward --lr-color-mix-partner, which follows the
     text colour, so the on-brand label stays legible at either share. */
  [part~='checked']:not([part~='disabled']):hover {
    background: var(--lr-radio-button-checked-hover-bg, color-mix(in oklab, var(--lr-radio-button-checked-bg, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-hover)));
    border-color: var(--lr-radio-button-checked-hover-border-color, var(--lr-radio-button-checked-border-color, var(--lr-color-brand)));
  }
  [part~='checked']:not([part~='disabled']):active {
    background: var(--lr-radio-button-checked-active-bg, color-mix(in oklab, var(--lr-radio-button-checked-bg, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
    border-color: var(--lr-radio-button-checked-active-border-color, var(--lr-radio-button-checked-hover-border-color, var(--lr-radio-button-checked-border-color, var(--lr-color-brand))));
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
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host([pill]) { --lr-radio-radius: var(--lr-radius-pill); }
  ${buttonChromeStyles}
`;

/** The same chrome scoped to WA's `appearance="button"` mode on `<lr-radio>`. */
export const appearanceStyles = css`
  :host([appearance='button']) {
    --lr-radio-radius: var(--lr-form-control-radius);
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host([appearance='button'][pill]) { --lr-radio-radius: var(--lr-radius-pill); }
  ${buttonChromeStyles}
`;
