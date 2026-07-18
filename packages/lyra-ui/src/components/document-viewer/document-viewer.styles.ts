import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
    --lr-document-viewer-max-height: 70vh;
  }

  [part='body'] {
    display: flex;
    flex-direction: column;
    min-block-size: var(--lr-size-12rem);
    max-block-size: var(--lr-document-viewer-max-height);
    overflow: auto;
    padding-inline: var(--lr-space-l);
    padding-block: var(--lr-space-l);
    min-inline-size: 0;
  }

  [part='body'] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part='download-link'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-2rem);
    padding-inline: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-decoration: none;
  }

  [part='download-link']:hover {
    background: color-mix(in srgb, var(--lr-color-brand) 85%, var(--lr-color-shadow));
  }

  [part='download-link']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
