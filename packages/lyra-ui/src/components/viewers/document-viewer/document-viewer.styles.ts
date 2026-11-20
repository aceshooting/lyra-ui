import { css } from 'lit';
import { activeFill, focusRingShorthand, hoverFill, interactiveTransition } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: contents;
    --_lr-document-viewer-max-height: 70vh;
    --_lr-document-viewer-download-link-hover-bg: ${hoverFill('var(--lr-color-brand)')};
    --_lr-document-viewer-download-link-active-bg: ${activeFill('var(--lr-color-brand)')};
  }

  [part="body"] {
    display: flex;
    flex-direction: column;
    min-block-size: var(--lr-document-viewer-min-height, var(--lr-size-12rem));
    max-block-size: var(
      --lr-document-viewer-max-height,
      var(--_lr-document-viewer-max-height)
    );
    overflow: auto;
    padding-inline: var(--lr-space-l);
    padding-block: var(--lr-space-l);
    min-inline-size: 0;
  }

  /* <lr-dialog> is rendered directly into this shadow root (not slotted), so a plain type
     selector reaches it: the resulting --lr-dialog-width custom property is computed on that
     element itself and inherits into its own shadow root exactly as if a consumer had set it
     there directly. Left unset, the dialog panel keeps its own default shrink-to-fit behavior. */
  lr-dialog {
    --lr-dialog-width: var(--lr-document-viewer-width, auto);
  }

  [part="body"] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part="download-link"] {
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
    ${interactiveTransition}
  }

  [part="download-link"]:hover {
    background: var(
      --lr-document-viewer-download-link-hover-bg,
      var(--_lr-document-viewer-download-link-hover-bg)
    );
  }

  [part="download-link"]:active {
    background: var(
      --lr-document-viewer-download-link-active-bg,
      var(--_lr-document-viewer-download-link-active-bg)
    );
  }

  [part="download-link"]:focus-visible {
    ${focusRingShorthand}
  }
`;
