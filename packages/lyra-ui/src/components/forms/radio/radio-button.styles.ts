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
  [part~="button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-radio-button-gap, var(--lr-space-xs));
    min-inline-size: var(--lr-size-1-5rem);
    max-inline-size: 100%;
    /* WCAG 2.5.8: the whole button is the target. Both axes retain a 1.5rem/24px floor, so even
       an empty 2xs tier remains a conformant target. */
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-1-5rem));
    padding-inline: var(--lr-form-control-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    line-height: var(--lr-line-height-snug);
    cursor: pointer;
    transition: background var(--lr-transition-fast),
      border-color var(--lr-transition-fast);

    /* Standalone is the safe default. The owning group projects data-run only after measuring
       real adjacency; separated, vertical, mixed, and wrapped controls therefore keep all four
       corners instead of guessing from DOM sibling order. */
    border-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
  }
  [part="label"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part~="start"],
  [part~="end"] {
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* A slot is itself an element child, so :empty can never identify an unassigned wrapper. The
     shared renderer tracks assigned content and reflects real emptiness through hidden. */
  [part~="start"][hidden],
  [part="label"][hidden],
  [part~="end"][hidden] {
    display: none;
  }
  [part~="button"][data-run="start"] {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  [part~="button"][data-run="middle"] {
    border-radius: 0;
  }
  [part~="button"][data-run="end"] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }
  [part~="button"][data-run="start"] {
    border-start-start-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
    border-end-start-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
  }
  [part~="button"][data-run="end"] {
    border-start-end-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
    border-end-end-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
  }
  [part~="button"][data-run="middle"],
  [part~="button"][data-run="end"] {
    margin-inline-start: calc(-1 * var(--lr-border-width-thin));
  }

  /* :host(:not(:disabled)), not a bare selector -- the interactive element is a plain
     <span role="radio"> that never matches :disabled itself, so unguarded a disabled segment still
     tinted on hover/press against its own not-allowed cursor and reduced opacity. Being a
     form-associated custom element (static formAssociated = true, from LyraRadio), the UA computes
     :disabled as for a native control: the host's disabled attribute or an ancestor
     <fieldset disabled> cascade. Matches [part~='circle']'s guard in radio.styles.ts. */
  [part~="button"]:not([part~="disabled"]):hover {
    background: var(--lr-radio-button-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(
      --lr-radio-button-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* Pressed carries the hover tint further toward --lr-color-mix-partner (which follows the text
     colour). It was once byte-identical to the :hover above: a segment that looks the same held
     down as hovered says nothing about whether the click landed. */
  [part~="button"]:not([part~="disabled"]):active {
    background: var(
      --lr-radio-button-active-bg,
      color-mix(
        in oklab,
        var(--lr-radio-button-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(
      --lr-radio-button-active-border-color,
      var(--lr-radio-button-hover-border-color, var(--lr-color-brand))
    );
  }
  :host(:focus-visible) [part~="button"],
  [part~="button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    /* The ring must not be painted under the overlapping neighbour's border. */
    position: relative;
    z-index: var(--lr-layer-content);
  }

  /* State lives in the part name, never as ::part(base)[aria-checked] -- an attribute selector
     after ::part() never matches. */
  [part~="checked"] {
    background: var(--lr-radio-button-checked-bg, var(--lr-color-brand));
    border-color: var(
      --lr-radio-button-checked-border-color,
      var(--lr-color-brand)
    );
    color: var(--lr-radio-button-checked-color, var(--lr-color-on-brand));
  }
  [part~="checked"] [part="label"] {
    color: inherit;
  }
  /* The checked segment keeps its loud brand fill under the pointer -- the unchecked rules' quiet
     tint would read as a DESELECTION -- but must still move, and the press must out-read the hover.
     Both mix that fill toward --lr-color-mix-partner, which follows the text colour, so the
     on-brand label stays legible at either share. */
  [part~="checked"]:not([part~="disabled"]):hover {
    background: var(
      --lr-radio-button-checked-hover-bg,
      color-mix(
        in oklab,
        var(--lr-radio-button-checked-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
    border-color: var(
      --lr-radio-button-checked-hover-border-color,
      var(--lr-radio-button-checked-border-color, var(--lr-color-brand))
    );
  }
  [part~="checked"]:not([part~="disabled"]):active {
    background: var(
      --lr-radio-button-checked-active-bg,
      color-mix(
        in oklab,
        var(--lr-radio-button-checked-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(
      --lr-radio-button-checked-active-border-color,
      var(
        --lr-radio-button-checked-hover-border-color,
        var(--lr-radio-button-checked-border-color, var(--lr-color-brand))
      )
    );
  }
  [part~="disabled"] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
`;

export const styles = css`
  :host {
    /* Rectangular chrome, so unlike <lr-radio>'s circular indicator this re-points the inherited
       radius knob at the shared control radius, and at a pill when pill is set. One name on both
       tags, so a consumer overriding it needn't know which tag it is. */
    --_lr-radio-radius: var(--lr-form-control-radius);
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host([pill]) {
    --_lr-radio-radius: var(--lr-radius-pill);
  }
  ${buttonChromeStyles}
`;

/** The same chrome scoped to WA's `appearance="button"` mode on `<lr-radio>`. */
export const appearanceStyles = css`
  :host([appearance="button"]) {
    --_lr-radio-radius: var(--lr-form-control-radius);
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host([appearance="button"][pill]) {
    --_lr-radio-radius: var(--lr-radius-pill);
  }
  ${buttonChromeStyles}
`;
