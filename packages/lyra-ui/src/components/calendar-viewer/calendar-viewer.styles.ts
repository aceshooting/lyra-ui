import { css } from 'lit';

export const styles = css`
  :host { display: block; --lr-calendar-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  [part='body'] { box-sizing: border-box; max-block-size: var(--lr-calendar-viewer-max-height); overflow: auto; }
  [part='event-list'] { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
  [part='event'] { display: flex; flex-direction: column; gap: var(--lr-space-2xs); padding: var(--lr-space-m); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='event']:last-child { border-block-end: none; }
  [part='event-summary'] { font-weight: var(--lr-font-weight-semibold); font-size: var(--lr-font-size-md); }
  [part='event-time'], [part='event-location'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='event-description'] { margin: 0; color: var(--lr-color-text); font-size: var(--lr-font-size-md-sm); line-height: var(--lr-line-height-normal); white-space: pre-wrap; overflow-wrap: anywhere; }
  .empty-note { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-danger); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
