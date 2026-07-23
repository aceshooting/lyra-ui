import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-dialog's --lr-dialog-overlay-color and
       lr-widget's --lr-widget-overlay-color). */
    --lr-tool-result-dialog-overlay-color: var(--lr-color-overlay);
    /* Inset applied to the panel while [maximized] -- overridable the same
       way lr-widget's --lr-widget-fullscreen-inset is, e.g. to leave a
       persistent app rail visible. */
    --lr-tool-result-dialog-maximized-inset:
      max(var(--lr-space-l), var(--lr-safe-area-top))
      max(var(--lr-space-l), var(--lr-safe-area-inline-end))
      max(var(--lr-space-l), var(--lr-safe-area-bottom))
      max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    --lr-tool-result-dialog-spin: var(--lr-transition-ambient);
    --lr-tool-result-dialog-running-color: var(--lr-color-brand);
    --lr-tool-result-dialog-running-bg: var(--lr-color-brand-quiet);
    --lr-tool-result-dialog-success-color: var(--lr-color-success);
    --lr-tool-result-dialog-success-bg: var(--lr-color-success-quiet);
    --lr-tool-result-dialog-error-color: var(--lr-color-danger);
    --lr-tool-result-dialog-error-bg: var(--lr-color-danger-quiet);
    --lr-tool-result-dialog-denied-color: var(--lr-color-warning);
    --lr-tool-result-dialog-denied-bg: var(--lr-color-warning-quiet);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-tool-result-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-48rem), 100%);
    max-block-size: 100%;
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    overflow: hidden;
    transition:
      inline-size var(--lr-transition-base),
      block-size var(--lr-transition-base);
  }
  :host([maximized]) [part='panel'] {
    position: fixed;
    inset: var(--lr-tool-result-dialog-maximized-inset);
    inline-size: auto;
    max-block-size: none;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='title'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='tool-name'] {
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='status'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-25rem);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text-quiet);
    background: transparent;
  }
  [part='status'] svg {
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
  }
  /* pending stays the neutral/quiet treatment above -- it's the resting
     state before a tool call has done anything worth calling out. */
  :host([status='running']) [part='status'] {
    color: var(--lr-tool-result-dialog-running-color);
    background: var(--lr-tool-result-dialog-running-bg);
  }
  :host([status='success']) [part='status'] {
    color: var(--lr-tool-result-dialog-success-color);
    background: var(--lr-tool-result-dialog-success-bg);
  }
  :host([status='error']) [part='status'] {
    color: var(--lr-tool-result-dialog-error-color);
    background: var(--lr-tool-result-dialog-error-bg);
  }
  /* 'denied' is a policy rejection, not a runtime failure -- the warning
     (not danger) tinted-background reads that distinction without relying on
     the status text alone. */
  :host([status='denied']) [part='status'] {
    color: var(--lr-tool-result-dialog-denied-color);
    background: var(--lr-tool-result-dialog-denied-bg);
  }
  :host([status='running']) [part='status'] svg {
    animation: lr-tool-result-dialog-spin var(--lr-tool-result-dialog-spin) infinite;
  }
  [part='duration'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='header-actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
  }
  [part='maximize-button'],
  [part='close-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='maximize-button']:hover,
  [part='close-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='maximize-button']:focus-visible,
  [part='close-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    padding: var(--lr-space-l);
    overflow: auto;
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
  @keyframes lr-tool-result-dialog-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='panel'] {
      transition: none !important;
    }
    :host([status='running']) [part='status'] svg {
      animation: none !important;
    }
  }
`;
