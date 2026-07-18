import { css } from 'lit';

export const styles = css`
  :host { display: block; --lr-email-viewer-max-height: none; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='headers'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--lr-space-2xs) var(--lr-space-s);
    padding: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-size: var(--lr-font-size-md-sm);
  }
  [part$='-label'] { color: var(--lr-color-text-quiet); font-weight: var(--lr-font-weight-semibold); text-align: end; }
  [part='subject'] { font-weight: var(--lr-font-weight-semibold); overflow-wrap: anywhere; }
  [part='body'] { box-sizing: border-box; overflow: auto; max-block-size: var(--lr-email-viewer-max-height); padding: var(--lr-space-m); }
  [part='body-html'], [part='body-text'] { color: var(--lr-color-text); font-size: var(--lr-font-size-md-sm); line-height: var(--lr-line-height-normal); }
  [part='body-html'] { overflow-wrap: anywhere; }
  [part='body-text'] { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  [part='attachments'] { padding: var(--lr-space-m); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='attachments-label'] { display: block; margin-block-end: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-weight: var(--lr-font-weight-semibold); font-size: var(--lr-font-size-xs); text-transform: uppercase; }
  [part='attachment-list'] { display: flex; flex-direction: column; gap: var(--lr-space-2xs); margin: 0; padding: 0; list-style: none; }
  [part='attachment-item'] { display: flex; }
  [part='attachment-button'] {
    display: flex;
    flex: 1;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand-quiet);
    color: inherit;
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
  }
  [part='attachment-button']:hover { background: color-mix(in srgb, var(--lr-color-brand-quiet) 80%, var(--lr-color-text)); }
  [part='attachment-button']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='quote-toggle'] {
    align-self: flex-start;
    margin-block-start: var(--lr-space-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
  }
  [part='quote-toggle']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='quoted'] { margin-block-start: var(--lr-space-xs); color: var(--lr-color-text-quiet); }
  .empty-note { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-danger); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
