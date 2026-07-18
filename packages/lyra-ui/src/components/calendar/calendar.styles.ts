import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; --lr-calendar-day-min-block-size: var(--lr-size-6rem); }
  [part='header'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); margin-block-end: var(--lr-space-s); }
  [part='title'] { font-weight: var(--lr-font-weight-semibold); }
  /* [part='nav'] is carried both by the wrapping span around the 'next' button and by the
     'previous' button itself (see calendar.class.ts's render()) -- the shared minimum tappable
     size here applies to whichever of the two a given selector match resolves to, sizing the
     'previous' button directly and, for the wrapping span, at least as large as its own button
     content already makes it. */
  [part='nav'] { display: flex; gap: var(--lr-space-xs); min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
  [part='nav'] button, [part='day'] { min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text); cursor: pointer; }
  [part='nav'] button { padding-inline: var(--lr-space-s); border-radius: var(--lr-radius); }
  [part='weekdays'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  [part='weekday'] { padding: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); text-align: center; }
  [part='grid'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='week'] { display: contents; }
  [part='day'] { display: flex; flex-direction: column; align-items: stretch; min-block-size: var(--lr-calendar-day-min-block-size); padding: var(--lr-space-xs); border-block-start: 0; border-inline-start: 0; text-align: start; }
  [part='day'][data-outside='true'] { color: var(--lr-color-text-quiet); background: var(--lr-color-surface); }
  [part='day'][data-today='true'] { outline: var(--lr-border-width-medium) solid var(--lr-color-brand); outline-offset: calc(var(--lr-border-width-medium) * -1); }
  [part='day'][data-selected='true'] { background: var(--lr-color-brand-quiet); }
  [part='date'] { font-weight: var(--lr-font-weight-semibold); }
  [part='event'] { overflow: hidden; margin-block-start: var(--lr-space-2xs); padding: var(--lr-space-2xs); border-radius: var(--lr-radius); background: var(--lr-color-brand); color: var(--lr-color-on-brand); font-size: var(--lr-font-size-sm); text-overflow: ellipsis; white-space: nowrap; }
  [part='agenda'] { display: grid; gap: var(--lr-space-s); }
  [part='agenda-event'] { padding: var(--lr-space-s); border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-brand); background: var(--lr-color-surface); }
  @container (max-inline-size: 28rem) { [part='day'] { min-block-size: var(--lr-calendar-day-min-block-size-narrow, 4rem); } [part='event'] { font-size: var(--lr-font-size-xs); } }
  :host(:dir(rtl)) [part='nav-glyph'] { transform: scaleX(-1); }
`;
