import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
    --lyra-document-viewer-max-height: 70vh;
  }

  [part='body'] {
    display: flex;
    flex-direction: column;
    min-block-size: var(--lyra-size-12rem);
    max-block-size: var(--lyra-document-viewer-max-height);
    overflow: auto;
    padding-inline: var(--lyra-space-l);
    padding-block: var(--lyra-space-l);
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
    min-block-size: var(--lyra-size-2rem);
    padding-inline: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-brand);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    font: inherit;
    font-weight: var(--lyra-font-weight-semibold);
    text-decoration: none;
  }

  [part='download-link']:hover {
    background: color-mix(in srgb, var(--lyra-color-brand) 85%, var(--lyra-color-shadow));
  }

  [part='download-link']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
