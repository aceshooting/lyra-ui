import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap on [part='body'] -- 'none' means the
       preview grows with its content until a caller opts into an internal
       scrollbar, same contract as lr-json-viewer's identical
       --lr-json-viewer-max-height. */
    --lr-document-preview-max-height: none;
    /* No shared Web Awesome/Lyra monospace token exists to resolve through
       (same gap lr-json-viewer's own --lr-json-viewer-font documents) --
       contained here so a host page can retheme it. */
    --lr-document-preview-font: var(--lr-font-mono);
    /* Spinner rotation timing -- deliberately slower than the shared
       --lr-transition-fast/--lr-transition-base tokens (those are tuned
       for one-shot UI transitions, not a continuous loading indicator), but
       still a retheme-able custom property rather than a bare literal. */
    --lr-document-preview-spin-duration: 0.8s;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }

  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part='body'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-document-preview-max-height);
    box-sizing: border-box;
    overflow: auto;
    flex: 1 1 auto;
  }

  /* -- text/*, application/json: plain, scrollable <pre> -----------------
     No syntax highlighting -- see the class doc for why that's intentionally
     out of scope here. */
  pre.text {
    align-self: stretch;
    box-sizing: border-box;
    margin: 0;
    padding: var(--lr-space-m);
    font-family: var(--lr-document-preview-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-loose);
    white-space: pre;
    overflow: auto;
    color: var(--lr-color-text);
  }

  /* -- image/* -------------------------------------------------------- */
  [part='body'] img {
    display: block;
    max-inline-size: 100%;
    max-block-size: 100%;
    object-fit: contain;
  }
  .zoom-content {
    position: relative;
  }
  [part='highlight-layer'] {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  [part='region-highlight'] {
    position: absolute;
    pointer-events: auto;
    border: var(--lr-border-width-thick) solid var(--lr-color-brand);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part='region-highlight'][data-active] {
    border-color: var(--lr-document-preview-active-border, var(--lr-color-warning, var(--lr-color-brand)));
  }
  [part='region-highlight']:hover {
    background: color-mix(in srgb, var(--lr-color-brand) 20%, transparent);
  }
  [part='region-highlight']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  .empty-note {
    margin: 0;
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  /* -- generic download fallback ------------------------------------- */
  .fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-l);
    text-align: center;
  }
  .fallback-icon {
    display: inline-flex;
    font-size: var(--lr-font-size-3xl);
    color: var(--lr-color-text-quiet);
  }
  .fallback-icon svg {
    display: block;
  }
  .fallback-text {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part='download-link'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-sm);
    text-decoration: none;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part='download-link']:hover {
    background: color-mix(in srgb, var(--lr-color-brand) 85%, var(--lr-color-shadow));
  }
  [part='download-link']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='download-link'] svg {
    display: block;
  }

  /* -- spinner (converting / loading text) ----------------------------- */
  [part='spinner'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-l);
  }
  .ring {
    display: inline-block;
    inline-size: var(--lr-size-2rem);
    block-size: var(--lr-size-2rem);
    border-radius: 50%;
    border: var(--lr-border-width-thick) solid var(--lr-color-border);
    border-block-start-color: var(--lr-color-brand);
    animation: lr-document-preview-spin var(--lr-document-preview-spin-duration) linear infinite;
  }
  /* Determinate progress reuses the same ring shape but holds a fixed
     rotation instead of spinning -- conic-gradient renders the actual fill,
     so the ring visually communicates a real fraction rather than motion. */
  .ring.determinate {
    animation: none;
    border-color: transparent;
    background: conic-gradient(
      var(--lr-color-brand) calc(var(--lr-document-preview-progress, 0) * 1%),
      var(--lr-color-border) 0
    );
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--lr-size-3px)), var(--lr-color-shadow) calc(100% - var(--lr-size-3px)));
    mask: radial-gradient(farthest-side, transparent calc(100% - var(--lr-size-3px)), var(--lr-color-shadow) calc(100% - var(--lr-size-3px)));
  }
  .spinner-text {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
  }
  @keyframes lr-document-preview-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation: none !important;
    }
  }

  /* -- error ------------------------------------------------------------ */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
`;
