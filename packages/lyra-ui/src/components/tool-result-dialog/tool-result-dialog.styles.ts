import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-widget's --lyra-widget-overlay-color). */
    --lyra-tool-result-dialog-overlay-color: rgb(0 0 0 / 0.5);
    /* Inset applied to the panel while [maximized] -- overridable the same
       way lyra-widget's --lyra-widget-fullscreen-inset is, e.g. to leave a
       persistent app rail visible. */
    --lyra-tool-result-dialog-maximized-inset: var(--lyra-space-l);
    display: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: var(--lyra-space-l);
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-tool-result-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(48rem, 100%);
    max-block-size: 100%;
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: hidden;
    transition:
      inline-size var(--lyra-transition-base),
      block-size var(--lyra-transition-base);
  }
  :host([maximized]) [part='panel'] {
    position: fixed;
    inset: var(--lyra-tool-result-dialog-maximized-inset);
    inline-size: auto;
    max-block-size: none;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='title'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='tool-name'] {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='status'] {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--lyra-color-text-quiet);
    background: transparent;
  }
  [part='status'] svg {
    inline-size: 1em;
    block-size: 1em;
  }
  /* pending stays the neutral/quiet treatment above -- it's the resting
     state before a tool call has done anything worth calling out. */
  :host([status='running']) [part='status'] {
    color: var(--lyra-color-brand);
    background: var(--lyra-color-brand-quiet);
  }
  :host([status='success']) [part='status'] {
    color: var(--lyra-color-success);
    background: var(--lyra-color-success-quiet);
  }
  :host([status='error']) [part='status'] {
    color: var(--lyra-color-danger);
    background: var(--lyra-color-danger-quiet);
  }
  /* 'denied' is a policy rejection, not a runtime failure -- the warning
     (not danger) tinted-background reads that distinction without relying on
     the status text alone. */
  :host([status='denied']) [part='status'] {
    color: var(--lyra-color-warning);
    background: var(--lyra-color-warning-quiet);
  }
  :host([status='running']) [part='status'] svg {
    animation: lyra-tool-result-dialog-spin 1s linear infinite;
  }
  [part='duration'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }
  [part='header-actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 0 auto;
  }
  [part='maximize-button'],
  [part='close-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='maximize-button']:hover,
  [part='close-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='maximize-button']:focus-visible,
  [part='close-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    padding: var(--lyra-space-l);
    overflow: auto;
  }
  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: 1px solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
  @keyframes lyra-tool-result-dialog-spin {
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
