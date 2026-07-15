import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-email-viewer-max-height: none; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='headers'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--lyra-space-2xs) var(--lyra-space-s);
    padding: var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    font-size: var(--lyra-font-size-md-sm);
  }
  [part$='-label'] { color: var(--lyra-color-text-quiet); font-weight: var(--lyra-font-weight-semibold); text-align: end; }
  [part='subject'] { font-weight: var(--lyra-font-weight-semibold); overflow-wrap: anywhere; }
  [part='body'] { box-sizing: border-box; overflow: auto; max-block-size: var(--lyra-email-viewer-max-height); padding: var(--lyra-space-m); }
  [part='body-html'], [part='body-text'] { color: var(--lyra-color-text); font-size: var(--lyra-font-size-md-sm); line-height: var(--lyra-line-height-normal); }
  [part='body-html'] { overflow-wrap: anywhere; }
  [part='body-text'] { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  [part='attachments'] { padding: var(--lyra-space-m); border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border); }
  [part='attachments-label'] { display: block; margin-block-end: var(--lyra-space-xs); color: var(--lyra-color-text-quiet); font-weight: var(--lyra-font-weight-semibold); font-size: var(--lyra-font-size-xs); text-transform: uppercase; }
  [part='attachment-list'] { display: flex; flex-direction: column; gap: var(--lyra-space-2xs); margin: 0; padding: 0; list-style: none; }
  [part='attachment-item'] { display: flex; justify-content: space-between; gap: var(--lyra-space-s); padding: var(--lyra-space-xs) var(--lyra-space-s); border-radius: var(--lyra-radius); background: var(--lyra-color-brand-quiet); font-size: var(--lyra-font-size-sm); }
  .empty-note { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lyra-space-l); color: var(--lyra-color-danger); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
