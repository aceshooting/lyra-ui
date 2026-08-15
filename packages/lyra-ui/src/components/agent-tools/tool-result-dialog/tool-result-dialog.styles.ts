import { css } from "lit";

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-dialog's --lr-dialog-overlay-color and
       lr-widget's --lr-widget-overlay-color). */
    --_lr-tool-result-dialog-overlay-color: var(--lr-color-overlay);
    /* Inset applied to the panel while [maximized] -- overridable the same
       way lr-widget's --lr-widget-fullscreen-inset is, e.g. to leave a
       persistent app rail visible. */
    --_lr-tool-result-dialog-maximized-inset: max(
        var(--lr-space-l),
        var(--lr-safe-area-top)
      )
      max(var(--lr-space-l), var(--lr-safe-area-inline-end))
      max(var(--lr-space-l), var(--lr-safe-area-bottom))
      max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    --_lr-tool-result-dialog-spin: var(--lr-transition-ambient);
    --_lr-tool-result-dialog-pending-color: var(--lr-color-text-quiet);
    --_lr-tool-result-dialog-pending-bg: transparent;
    --_lr-tool-result-dialog-running-color: var(--lr-color-brand);
    --_lr-tool-result-dialog-running-bg: var(--lr-color-brand-quiet);
    --_lr-tool-result-dialog-success-color: var(--lr-color-success);
    --_lr-tool-result-dialog-success-bg: var(--lr-color-success-quiet);
    --_lr-tool-result-dialog-error-color: var(--lr-color-danger);
    --_lr-tool-result-dialog-error-bg: var(--lr-color-danger-quiet);
    --_lr-tool-result-dialog-denied-color: var(--lr-color-warning);
    --_lr-tool-result-dialog-denied-bg: var(--lr-color-warning-quiet);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-space-l),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-tool-result-dialog-overlay-color,
      var(--_lr-tool-result-dialog-overlay-color)
    );
  }
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-48rem), 100%);
    min-inline-size: 0;
    max-block-size: 100%;
    box-sizing: border-box;
    /* Modal-panel surface, not the page surface -- in dark mode the two resolve to the same
       near-black and the dialog reads as a scrim with floating text instead of a panel. */
    background: var(--lr-color-surface-overlay);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Modal layer, top step: a centered, scrimmed dialog floating free on all four edges --
       the same role as lr-dialog, so the same elevation. */
    box-shadow: var(--lr-shadow-xl);
    overflow: hidden;
    transition: inline-size var(--lr-transition-base),
      block-size var(--lr-transition-base);
  }
  :host([maximized]) [part="panel"] {
    position: fixed;
    inset: var(
      --lr-tool-result-dialog-maximized-inset,
      var(--_lr-tool-result-dialog-maximized-inset)
    );
    inline-size: auto;
    max-block-size: none;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="title"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-name"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="status"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-25rem);
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    white-space: normal;
    overflow-wrap: anywhere;
    color: var(
      --lr-tool-result-dialog-pending-color,
      var(--_lr-tool-result-dialog-pending-color)
    );
    background: var(
      --lr-tool-result-dialog-pending-bg,
      var(--_lr-tool-result-dialog-pending-bg)
    );
  }
  [part="status"] svg {
    flex: 0 0 auto;
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
  }
  [part="status"] span {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  /* Pending is the resting state before a tool call has done anything worth
     calling out; its foreground and background remain independently themeable. */
  :host([status="running"]) [part="status"] {
    color: var(
      --lr-tool-result-dialog-running-color,
      var(--_lr-tool-result-dialog-running-color)
    );
    background: var(
      --lr-tool-result-dialog-running-bg,
      var(--_lr-tool-result-dialog-running-bg)
    );
  }
  :host([status="success"]) [part="status"] {
    color: var(
      --lr-tool-result-dialog-success-color,
      var(--_lr-tool-result-dialog-success-color)
    );
    background: var(
      --lr-tool-result-dialog-success-bg,
      var(--_lr-tool-result-dialog-success-bg)
    );
  }
  :host([status="error"]) [part="status"] {
    color: var(
      --lr-tool-result-dialog-error-color,
      var(--_lr-tool-result-dialog-error-color)
    );
    background: var(
      --lr-tool-result-dialog-error-bg,
      var(--_lr-tool-result-dialog-error-bg)
    );
  }
  /* 'denied' is a policy rejection, not a runtime failure -- the warning
     (not danger) tinted-background reads that distinction without relying on
     the status text alone. */
  :host([status="denied"]) [part="status"] {
    color: var(
      --lr-tool-result-dialog-denied-color,
      var(--_lr-tool-result-dialog-denied-color)
    );
    background: var(
      --lr-tool-result-dialog-denied-bg,
      var(--_lr-tool-result-dialog-denied-bg)
    );
  }
  :host([status="running"]) [part="status"] svg {
    animation: lr-tool-result-dialog-spin
      var(--lr-tool-result-dialog-spin, var(--_lr-tool-result-dialog-spin))
      infinite;
  }
  [part="duration"] {
    max-inline-size: 100%;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part="header-actions"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
    max-inline-size: 100%;
    margin-inline-start: auto;
  }
  [part="maximize-button"],
  [part="close-button"] {
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
  [part="maximize-button"]:hover,
  [part="close-button"]:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. */
  [part="maximize-button"]:active,
  [part="close-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="maximize-button"]:focus-visible,
  [part="close-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="body"] {
    flex: 1 1 auto;
    min-block-size: 0;
    padding: var(--lr-space-l);
    overflow: auto;
  }
  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="footer"][hidden] {
    display: none;
  }
  @keyframes lr-tool-result-dialog-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="panel"] {
      transition: none !important;
    }
    :host([status="running"]) [part="status"] svg {
      animation: none !important;
    }
  }
`;
