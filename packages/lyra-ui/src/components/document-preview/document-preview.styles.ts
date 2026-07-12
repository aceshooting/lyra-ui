import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap on [part='body'] -- 'none' means the
       preview grows with its content until a caller opts into an internal
       scrollbar, same contract as lyra-json-viewer's identical
       --lyra-json-viewer-max-height. */
    --lyra-document-preview-max-height: none;
    /* No shared --wa-*/--lyra-* monospace token exists to resolve through
       (same gap lyra-json-viewer's own --lyra-json-viewer-font documents) --
       contained here so a host page can retheme it. */
    --lyra-document-preview-font: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }

  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-end: 1px solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--lyra-color-text);
  }

  [part='body'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-block-size: 10rem;
    max-block-size: var(--lyra-document-preview-max-height);
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
    padding: var(--lyra-space-m);
    font-family: var(--lyra-document-preview-font);
    font-size: 0.8125rem;
    line-height: 1.6;
    white-space: pre;
    overflow: auto;
    color: var(--lyra-color-text);
  }

  /* -- image/* -------------------------------------------------------- */
  [part='body'] img {
    display: block;
    max-inline-size: 100%;
    max-block-size: 100%;
    object-fit: contain;
  }

  .empty-note {
    margin: 0;
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }

  /* -- generic download fallback ------------------------------------- */
  .fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-l);
    text-align: center;
  }
  .fallback-icon {
    display: inline-flex;
    font-size: 2rem;
    color: var(--lyra-color-text-quiet);
  }
  .fallback-icon svg {
    display: block;
  }
  .fallback-text {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }
  [part='download-link'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    font: inherit;
    font-weight: 600;
    font-size: 0.8125rem;
    text-decoration: none;
    cursor: pointer;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='download-link']:hover {
    background: color-mix(in srgb, var(--lyra-color-brand) 85%, black);
  }
  [part='download-link']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='download-link'] svg {
    display: block;
  }

  /* -- spinner (converting / loading text) ----------------------------- */
  [part='spinner'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-l);
  }
  .ring {
    display: inline-block;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 50%;
    border: 3px solid var(--lyra-color-border);
    border-block-start-color: var(--lyra-color-brand);
    animation: lyra-document-preview-spin 0.8s linear infinite;
  }
  /* Determinate progress reuses the same ring shape but holds a fixed
     rotation instead of spinning -- conic-gradient renders the actual fill,
     so the ring visually communicates a real fraction rather than motion. */
  .ring.determinate {
    animation: none;
    border-color: transparent;
    background: conic-gradient(
      var(--lyra-color-brand) calc(var(--lyra-document-preview-progress, 0) * 1%),
      var(--lyra-color-border) 0
    );
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  }
  .spinner-text {
    color: var(--lyra-color-text-quiet);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  @keyframes lyra-document-preview-spin {
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
    padding: var(--lyra-space-l);
    color: var(--lyra-color-danger);
    font-size: 0.875rem;
    text-align: center;
  }
`;
