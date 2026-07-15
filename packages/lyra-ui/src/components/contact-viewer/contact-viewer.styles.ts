import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-contact-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='body'] { display: flex; flex-direction: column; gap: var(--lyra-space-m); box-sizing: border-box; overflow: auto; max-block-size: var(--lyra-contact-viewer-max-height); padding: var(--lyra-space-m); }
  [part='contact'] { display: flex; flex-direction: column; gap: var(--lyra-space-xs); padding: var(--lyra-space-m); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); }
  [part='contact-name'] { margin: 0; font-size: var(--lyra-font-size-md); font-weight: var(--lyra-font-weight-semibold); color: var(--lyra-color-text); }
  [part='contact-org'] { margin: 0; color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='contact-tel'], [part='contact-email'], [part='contact-adr'] { display: flex; flex-direction: column; gap: var(--lyra-space-2xs); margin: 0; padding: 0; list-style: none; font-size: var(--lyra-font-size-sm); color: var(--lyra-color-text); }
  .field-label, .type { color: var(--lyra-color-text-quiet); }
  .type { font-size: var(--lyra-font-size-xs); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { padding: var(--lyra-space-l); color: var(--lyra-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
