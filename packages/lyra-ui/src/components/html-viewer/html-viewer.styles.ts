import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; --lyra-html-viewer-max-height: none; }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='body'] {
    min-block-size: var(--lyra-size-10rem);
    max-block-size: var(--lyra-html-viewer-max-height);
    box-sizing: border-box;
    overflow: auto;
    padding: var(--lyra-space-m);
  }
  [part='html'] { display: block; max-inline-size: 100%; overflow-wrap: anywhere; }
  [part='html'] img, [part='html'] video { max-inline-size: 100%; block-size: auto; }
  .empty-note, [part='error'] { margin: 0; color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lyra-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; }
`;
