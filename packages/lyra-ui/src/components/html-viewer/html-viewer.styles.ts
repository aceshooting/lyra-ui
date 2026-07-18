import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; --lr-html-viewer-max-height: none; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='body'] {
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-html-viewer-max-height);
    box-sizing: border-box;
    overflow: auto;
    padding: var(--lr-space-m);
  }
  [part='html'] { display: block; max-inline-size: 100%; overflow-wrap: anywhere; }
  [part='html'] img, [part='html'] video { max-inline-size: 100%; block-size: auto; }
  .empty-note, [part='error'] { margin: 0; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lr-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; }
`;
