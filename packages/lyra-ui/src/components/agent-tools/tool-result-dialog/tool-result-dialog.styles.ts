import { iconActionStyles } from '../../../internal/icon-action.styles.js';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';
import { dialogChrome, dialogOpenHost, dialogBackdrop } from '../../../internal/modal-surface.styles.js';
import { toolStatusKeyframes } from '../tool-status.styles.js';
import { css } from 'lit';
import { modalHostStyles } from '../../../internal/native-modal-carrier.styles.js';

export const styles = css`
  :host {
    /* Backdrop scrim color, component-specific so a host can retheme it without a raw literal
       leaking into the public API: no shared --lr-*-overlay token exists to resolve through, same
       rationale as lr-dialog's --lr-dialog-overlay-color and lr-widget's
       --lr-widget-overlay-color. */
    --_lr-tool-result-dialog-overlay-color: var(--lr-color-overlay);
    /* Inset applied to the panel while [maximized] -- overridable like lr-widget's
       --lr-widget-fullscreen-inset, e.g. to leave a persistent app rail visible. */
    --_lr-tool-result-dialog-maximized-inset: max(
        var(--lr-space-l),
        var(--lr-safe-area-top)
      )
      max(var(--lr-space-l), var(--lr-safe-area-inline-end))
      max(var(--lr-space-l), var(--lr-safe-area-bottom))
      max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    --_lr-tool-result-dialog-spin: var(--lr-duration-ambient) var(--lr-easing-linear);
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
    --_lr-tool-result-dialog-incomplete-color: var(--lr-color-text-quiet);
    --_lr-tool-result-dialog-incomplete-bg: transparent;
    ${modalHostStyles}
    ${dialogChrome}
  }
  ${dialogOpenHost}
  ${dialogBackdrop('tool-result-dialog')}
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-48rem), 100%);
    min-inline-size: 0;
    max-block-size: 100%;
    box-sizing: border-box;
    ${overlaySurface}
    box-shadow: var(--lr-overlay-shadow-modal, var(--lr-shadow-xl));
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
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
  /* Pending is the resting state before a tool call has done anything worth calling out; its
     foreground and background stay independently themeable. */
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
  /* 'denied' is a policy rejection, not a runtime failure -- the warning tinted background, not
     danger, carries that distinction without relying on the status text alone. */
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
  /* 'incomplete' (ended without a result) defaults to the same neutral look as pending, through its
     own pair so retheming pending never repaints it. */
  :host([status="incomplete"]) [part="status"] {
    color: var(
      --lr-tool-result-dialog-incomplete-color,
      var(--_lr-tool-result-dialog-incomplete-color)
    );
    background: var(
      --lr-tool-result-dialog-incomplete-bg,
      var(--_lr-tool-result-dialog-incomplete-bg)
    );
  }
  :host([status="running"]) [part="status"] svg {
    animation: var(--_lr-motion-animation, lr-tool-status-spin
      var(--lr-tool-result-dialog-spin, var(--_lr-tool-result-dialog-spin))
      infinite);
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
  ${iconActionStyles(':is([part="maximize-button"], [part="close-button"])', {
    color: 'var(--lr-color-text-quiet)',
    hoverColor: 'var(--lr-color-brand)',
    hoverBackground: 'var(--lr-color-brand-quiet)',
  })}
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
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="footer"][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="panel"] {
      transition: none !important;
    }
    :host([status="running"]) [part="status"] svg {
      animation: none !important;
    }
  }
  ${toolStatusKeyframes}
`;
