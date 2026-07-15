import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-calendar-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='body'] { box-sizing: border-box; max-block-size: var(--lyra-calendar-viewer-max-height); overflow: auto; }
  [part='event-list'] { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
  [part='event'] { display: flex; flex-direction: column; gap: var(--lyra-space-2xs); padding: var(--lyra-space-m); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); }
  [part='event']:last-child { border-block-end: none; }
  [part='event-summary'] { font-weight: var(--lyra-font-weight-semibold); font-size: var(--lyra-font-size-md); }
  [part='event-time'], [part='event-location'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='event-description'] { margin: 0; color: var(--lyra-color-text); font-size: var(--lyra-font-size-md-sm); line-height: var(--lyra-line-height-normal); white-space: pre-wrap; overflow-wrap: anywhere; }
  .empty-note { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lyra-space-l); color: var(--lyra-color-danger); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
