import { css } from 'lit';

export const styles = css`
  :host { display: block; --lr-contact-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  [part='body'] { display: flex; flex-direction: column; gap: var(--lr-space-m); box-sizing: border-box; overflow: auto; max-block-size: var(--lr-contact-viewer-max-height); padding: var(--lr-space-m); }
  [part='contact'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); padding: var(--lr-space-m); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); }
  [part='contact-name'] { margin: 0; font-size: var(--lr-font-size-md); font-weight: var(--lr-font-weight-semibold); color: var(--lr-color-text); }
  [part='contact-org'] { margin: 0; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='contact-tel'], [part='contact-email'], [part='contact-adr'] { display: flex; flex-direction: column; gap: var(--lr-space-2xs); margin: 0; padding: 0; list-style: none; font-size: var(--lr-font-size-sm); color: var(--lr-color-text); }
  [part='contact-adr'] li { white-space: pre-line; }
  [part='contact-org'], [part='contact-tel'] li, [part='contact-email'] li { display: flex; flex-wrap: wrap; gap: var(--lr-space-2xs); }
  .field-label, .type { color: var(--lr-color-text-quiet); }
  .type { font-size: var(--lr-font-size-xs); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { padding: var(--lr-space-l); color: var(--lr-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
