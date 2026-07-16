import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; --lyra-calendar-day-min-block-size: var(--lyra-size-6rem); }
  [part='header'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lyra-space-s); margin-block-end: var(--lyra-space-s); }
  [part='title'] { font-weight: 600; }
  [part='nav'] { display: flex; gap: var(--lyra-space-xs); }
  [part='nav'] button, [part='day'] { min-block-size: var(--lyra-size-2-5rem); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); background: var(--lyra-color-surface); color: var(--lyra-color-text); cursor: pointer; }
  [part='nav'] button { padding-inline: var(--lyra-space-s); border-radius: var(--lyra-radius); }
  [part='grid'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-inline-start: var(--lyra-border-width-thin) solid var(--lyra-color-border); }
  [part='weekday'] { padding: var(--lyra-space-xs); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); text-align: center; }
  [part='day'] { display: flex; flex-direction: column; align-items: stretch; min-block-size: var(--lyra-calendar-day-min-block-size); padding: var(--lyra-space-xs); border-block-start: 0; border-inline-start: 0; text-align: start; }
  [part='day'][data-outside='true'] { color: var(--lyra-color-text-quiet); background: var(--lyra-color-surface); }
  [part='day'][data-today='true'] { outline: var(--lyra-border-width-medium) solid var(--lyra-color-brand); outline-offset: calc(var(--lyra-border-width-medium) * -1); }
  [part='day'][data-selected='true'] { background: var(--lyra-color-brand-quiet); }
  [part='date'] { font-weight: 600; }
  [part='event'] { overflow: hidden; margin-block-start: var(--lyra-space-2xs); padding: var(--lyra-space-2xs); border-radius: var(--lyra-radius); background: var(--lyra-color-brand); color: var(--lyra-color-on-brand); font-size: var(--lyra-font-size-sm); text-overflow: ellipsis; white-space: nowrap; }
  [part='agenda'] { display: grid; gap: var(--lyra-space-s); }
  [part='agenda-event'] { padding: var(--lyra-space-s); border-inline-start: var(--lyra-border-width-medium) solid var(--lyra-color-brand); background: var(--lyra-color-surface); }
  @container (max-inline-size: 28rem) { [part='day'] { min-block-size: var(--lyra-calendar-day-min-block-size-narrow, 4rem); } [part='event'] { font-size: var(--lyra-font-size-xs); } }
`;
