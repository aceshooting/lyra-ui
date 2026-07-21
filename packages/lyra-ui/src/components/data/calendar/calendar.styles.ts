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
    --lr-calendar-day-min-block-size: var(--lr-size-6rem);
    /* Component-scoped indirection over the shared --lr-color-brand-quiet token, so a consumer
       can retint the persistent selected-day highlight without also recoloring
       button[part='nav']:hover/[part='agenda-event']:hover below, which consume that shared
       token directly for a visually distinct purpose (transient hover feedback). Defaults to
       exactly the value the selected-day background already used before this token existed. */
    --lr-calendar-day-selected-bg: var(--lr-color-brand-quiet);
  }
  [part='header'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); margin-block-end: var(--lr-space-s); }
  [part='title'] { font-weight: var(--lr-font-weight-semibold); }
  /* [part='nav'] is carried both by the wrapping span around the 'next' button and by the
     'previous' button itself (see calendar.class.ts's render()) -- the shared minimum tappable
     size here applies to whichever of the two a given selector match resolves to, sizing the
     'previous' button directly and, for the wrapping span, at least as large as its own button
     content already makes it. */
  [part='nav'] { display: flex; gap: var(--lr-space-xs); min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
  /* button[part='nav'] (a direct-attribute match, not a descendant match) reaches both the
     'previous' button (carries part="nav" itself) and the 'next' button (now also carries part="nav"
     directly, in addition to sitting inside a span that also carries it for shared hit-area sizing) --
     without ever matching that wrapping span itself, which isn't a <button>. */
  button[part='nav'], [part='day'] { min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text); cursor: pointer; }
  button[part='nav'] { padding-inline: var(--lr-space-s); border-radius: var(--lr-radius); }
  button[part='nav']:hover, [part='agenda-event']:hover { background: var(--lr-color-brand-quiet); }
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
  [part='day']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='weekdays'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  [part='weekday'] { padding: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); text-align: center; }
  [part='grid'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='week'] { display: contents; }
  [part='day'] { display: flex; flex-direction: column; align-items: stretch; min-block-size: var(--lr-calendar-day-min-block-size); padding: var(--lr-space-xs); border-block-start: 0; border-inline-start: 0; text-align: start; }
  [part='day'][data-outside='true'] { color: var(--lr-color-text-quiet); background: var(--lr-color-surface); }
  [part='day'][data-today='true'] { outline: var(--lr-border-width-medium) solid var(--lr-color-brand); outline-offset: calc(var(--lr-border-width-medium) * -1); }
  [part='day'][data-selected='true'] { background: var(--lr-calendar-day-selected-bg); }
  [part='date'] { font-weight: var(--lr-font-weight-semibold); }
  [part='event'] { overflow: hidden; margin-block-start: var(--lr-space-2xs); padding: var(--lr-space-2xs); border-radius: var(--lr-radius); background: var(--lr-color-brand); color: var(--lr-color-on-brand); font-size: var(--lr-font-size-sm); text-overflow: ellipsis; white-space: nowrap; }
  [part='agenda'] { display: grid; gap: var(--lr-space-s); }
  [part='agenda-event'] { padding: var(--lr-space-s); border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-brand); background: var(--lr-color-surface); }
  @container (max-inline-size: 28rem) { [part='day'] { min-block-size: var(--lr-calendar-day-min-block-size-narrow, var(--lr-size-4rem)); } [part='event'] { font-size: var(--lr-font-size-xs); } }
  :host(:dir(rtl)) [part='nav-glyph'] { transform: scaleX(-1); }
`;
