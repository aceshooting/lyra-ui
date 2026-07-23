import { css } from 'lit';
import { srOnly } from '../../../internal/a11y.js';

export const styles = [
  srOnly,
  css`
    :host {
      display: block;
      --lr-task-list-spin: var(--lr-transition-ambient);
    }
    [part='base'] {
      border: var(--lr-border-width-thin) solid var(--lr-color-border);
      border-radius: var(--lr-radius);
      background: var(--lr-color-surface);
      overflow: hidden;
    }
    /* Density escape -- same convention as lr-agent-run/lr-source-card's compact. Task lists render
       embedded in the transcript (see the class doc), so the tuned values sit behind inline var()
       fallbacks (rather than :host declarations, which every instance would re-declare and so
       shadow any ancestor value) letting a transcript retune every list at once from the outside;
       header and body carry their own padding (unlike agent-run/source-card's single [part='base']
       padding) since that's where this component already puts it. */
    :host([compact]) [part='header'] {
      padding: var(--lr-task-list-compact-header-padding, var(--lr-space-2xs) var(--lr-space-s));
    }
    :host([compact]) [part='body'] {
      gap: var(--lr-task-list-compact-gap, var(--lr-space-2xs));
      padding: var(--lr-task-list-compact-body-padding, var(--lr-space-2xs) var(--lr-space-s) var(--lr-space-s));
    }
    /* Chrome escape -- same convention as lr-agent-run/lr-source-card's appearance="plain": drops
       the outer border/background/radius so a list nested inside a host frame that already draws a
       border (an agent-run panel, a message bubble) doesn't double it. The header/body's own
       internal divider and padding are layout, not outer chrome, so they're untouched -- matching
       how agent-run's plain rule leaves its own Cancel/Retry button chrome alone. */
    :host([appearance='plain']) [part='base'] {
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    [part='header'] {
      display: flex;
      align-items: center;
      gap: var(--lr-space-xs);
      inline-size: 100%;
      box-sizing: border-box;
      padding: var(--lr-space-s) var(--lr-space-m);
      border: none;
      background: none;
      color: var(--lr-color-text);
      font: inherit;
      font-weight: var(--lr-font-weight-semibold);
      font-size: var(--lr-font-size-md-sm);
      text-align: start;
    }
    button[part='header'] {
      cursor: pointer;
    }
    /* :where() keeps this rule's specificity low ((0,1,0)) so a consumer's own
       ::part(header):hover override ((0,1,1)) wins without needing !important --
       see lr-attachment-trigger/lr-copy-button's identical fix for the same reasoning. */
    :where(button[part='header']):hover {
      background: var(--lr-color-brand-quiet);
      color: var(--lr-color-brand);
    }
    button[part='header']:focus-visible {
      outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
      outline-offset: calc(-1 * var(--lr-focus-ring-offset));
    }
    [part='toggle'] {
      display: inline-flex;
      flex: 0 0 auto;
      transition: transform var(--lr-transition-fast);
    }
    :host([expanded]) [part='toggle'] {
      transform: rotate(90deg);
    }
    :host(:not([expanded]):dir(rtl)) [part='toggle'] {
      transform: scaleX(-1);
    }
    [part='label'] {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    [part='summary'] {
      flex: 0 0 auto;
      font-weight: var(--lr-font-weight-normal);
      font-size: var(--lr-font-size-sm);
      color: var(--lr-color-text-quiet);
    }
    [part='body'] {
      display: flex;
      flex-direction: column;
      gap: var(--lr-space-s);
      padding: var(--lr-space-xs) var(--lr-space-m) var(--lr-space-m);
      border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    }
    [part='body'][hidden] {
      display: none;
    }
    [part='item'] {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--lr-space-xs);
    }
    [part='item'][data-depth='1'] {
      margin-inline-start: var(--lr-space-l);
    }
    [part='item-children'] {
      display: flex;
      flex-direction: column;
      gap: var(--lr-space-s);
      flex-basis: 100%;
      margin-block-start: var(--lr-space-xs);
    }
    [part='status-icon'] {
      display: inline-flex;
      flex: 0 0 auto;
      color: var(--lr-color-text-quiet);
    }
    [part='status-icon'] svg {
      display: block;
    }
    [part='item'][data-status='running'] [part='status-icon'] {
      color: var(--lr-color-brand);
    }
    [part='item'][data-status='running'] [part='status-icon'] svg {
      animation: lr-task-list-spin var(--lr-task-list-spin) infinite;
    }
    [part='item'][data-status='success'] [part='status-icon'] {
      color: var(--lr-color-success);
    }
    [part='item'][data-status='error'] [part='status-icon'] {
      color: var(--lr-color-danger);
    }
    [part='item-label'] {
      flex: 1 1 auto;
      min-inline-size: var(--lr-size-6ch);
    }
    [part='item-detail'] {
      flex-basis: 100%;
      font-size: var(--lr-font-size-sm);
      color: var(--lr-color-text-quiet);
    }
    @keyframes lr-task-list-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      [part='toggle'] {
        transition: none !important;
      }
      [part='item'][data-status='running'] [part='status-icon'] svg {
        animation: none !important;
      }
    }
  `,
];
