import { css } from 'lit';
export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Establishes the containment context the narrow-panel @container query below depends on --
       without this, that query can only ever fire if a consumer's page happens to independently
       declare container-type on some ancestor whose box crosses the same threshold, making it
       effectively dead code out of the box. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --lr-calendar-day-min-block-size: var(--lr-size-6rem);
  }
  [part='header'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); margin-block-end: var(--lr-space-s); }
  [part='title'] { font-weight: var(--lr-font-weight-semibold); }
  /* [part='nav'] is carried both by the wrapping span around the 'next' button and by the
     'previous' button itself (see calendar.class.ts's render()) -- the shared minimum tappable
     size here applies to whichever of the two a given selector match resolves to, sizing the
     'previous' button directly and, for the wrapping span, at least as large as its own button
     content already makes it. */
  /* justify-content on both axes: the nav buttons carry a single icon-only glyph (nav-glyph),
     far narrower than the min-inline-size hit-area floor below, and the default
     justify-content (normal => flex-start) dumped all that slack on the trailing side, leaving
     the chevron visibly off-centre in its button. Only takes effect when there IS slack, so a
     nav box whose content already fills it renders exactly as before. */
  [part='nav'] { display: flex; justify-content: center; align-items: center; gap: var(--lr-space-xs); min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
  /* button[part='nav'] (a direct-attribute match, not a descendant match) reaches both the
     'previous' button (carries part="nav" itself) and the 'next' button (now also carries part="nav"
     directly, in addition to sitting inside a span that also carries it for shared hit-area sizing) --
     without ever matching that wrapping span itself, which isn't a <button>. */
  button[part='nav'], [part='day'] { min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text); cursor: pointer; }
  button[part='nav'] { padding-inline: var(--lr-space-s); border-radius: var(--lr-radius); }
  button[part='nav']:hover, [part='agenda-event']:hover { background: var(--lr-color-brand-quiet); }
  /* Pressed: the same hovered fill carried further toward --lr-color-mix-partner (which follows the
     text colour), so the step is visible in either theme instead of relying on a fixed lighten. */
  button[part='nav']:active, [part='agenda-event']:active { background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  button[part='nav']:focus-visible, [part='agenda-event']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  /* Negative outline-offset so the ring doesn't visually collide with [data-today='true']'s own
     outline below -- source order makes the focus ring win for a focused today cell, which is the
     correct behavior while focused. */
  [part='day']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='day']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='day']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='weekdays'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  [part='weekday'] { padding: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); text-align: center; }
  [part='grid'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='week'] { display: contents; }
  [part='day'] { display: flex; flex-direction: column; align-items: stretch; min-block-size: var(--lr-calendar-day-min-block-size); padding: var(--lr-space-xs); border-block-start: 0; border-inline-start: 0; text-align: start; }
  [part='day'][data-outside='true'] { color: var(--lr-calendar-day-outside-color, var(--lr-color-text-quiet)); background: var(--lr-calendar-day-outside-bg, var(--lr-color-surface)); }
  [part='day'][data-today='true'] { outline: var(--lr-border-width-medium) solid var(--lr-calendar-day-today-outline-color, var(--lr-color-brand)); outline-offset: calc(var(--lr-border-width-medium) * -1); }
  [part='day'][data-selected='true'] { background: var(--lr-calendar-day-selected-bg, var(--lr-color-brand-quiet)); }
  [part='date'] { font-weight: var(--lr-font-weight-semibold); }
  [part='event'] { overflow: hidden; box-sizing: border-box; inline-size: 100%; min-inline-size: var(--lr-size-1-5rem); min-block-size: var(--lr-size-1-5rem); margin-block-start: var(--lr-space-2xs); padding: var(--lr-space-2xs); border: 0; border-radius: var(--lr-radius); background: var(--lr-color-brand); color: var(--lr-color-on-brand); font: inherit; font-size: var(--lr-font-size-sm); text-align: start; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  /* An event chip's fill is per-event data (CalendarEvent.color) written as an inline
     background-color by calendar.class.ts, and an inline declaration beats every stylesheet rule --
     so the pointer feedback is painted as a background-IMAGE overlay rather than swapped into
     background-color. The overlay composites over whatever fill the chip actually carries
     (including a pure white or pure black one, which the filter: brightness() this replaces left
     completely unchanged) and paints under the label instead of recolouring it. */
  [part='event']:hover {
    background-image: linear-gradient(
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover)),
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }
  [part='event']:active {
    background-image: linear-gradient(
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active)),
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='event']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='agenda'] { display: grid; gap: var(--lr-space-s); }
  [part='agenda-event'] { padding: var(--lr-space-s); border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-brand); background: var(--lr-color-surface); }
  @container (max-inline-size: 28rem) { [part='day'] { min-block-size: var(--lr-calendar-day-min-block-size-narrow, var(--lr-size-4rem)); } [part='event'] { font-size: var(--lr-font-size-xs); } }
  :host(:dir(rtl)) [part='nav-glyph'] { transform: scaleX(-1); }
`;
