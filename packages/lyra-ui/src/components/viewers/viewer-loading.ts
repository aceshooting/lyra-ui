import { css, html, type TemplateResult } from 'lit';

/** Shared visible loading treatment for remote document viewers. */
export const viewerLoadingStyles = css`
  .viewer-loading {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-s);
    min-block-size: var(--lr-size-6rem);
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    text-align: center;
  }

  .viewer-loading-indicator {
    display: block;
    box-sizing: border-box;
    inline-size: var(--lr-size-2rem);
    block-size: var(--lr-size-2rem);
    border: var(--lr-border-width-thick) solid var(--lr-color-border);
    border-block-start-color: var(--lr-color-brand);
    border-radius: 50%;
    animation: lr-viewer-loading-spin var(--lr-duration-icon) var(--lr-easing-linear) infinite;
  }

  @keyframes lr-viewer-loading-spin {
    to { transform: rotate(1turn); }
  }

  @media (prefers-reduced-motion: reduce) {
    .viewer-loading-indicator { animation: none !important; }
  }
`;

/** The text stays ordinary and visible so loading remains understandable without CSS or motion. */
export function renderViewerLoading(label: string): TemplateResult {
  return html`<div part="spinner" class="viewer-loading">
    <span class="viewer-loading-indicator" aria-hidden="true"></span>
    <span class="viewer-loading-label">${label}</span>
  </div>`;
}
