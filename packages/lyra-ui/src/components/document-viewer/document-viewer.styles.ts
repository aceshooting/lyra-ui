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
`;
