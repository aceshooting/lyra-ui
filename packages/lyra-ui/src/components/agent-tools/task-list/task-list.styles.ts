import { css } from 'lit';
import { srOnly } from '../../../internal/a11y.js';

export const styles = [
  srOnly,
  css`
    :host {
      display: block;
      --lr-task-list-spin: 1s linear;
    }
    [part='base'] {
      border: var(--lr-border-width-thin) solid var(--lr-color-border);
      border-radius: var(--lr-radius);
      background: var(--lr-color-surface);
      overflow: hidden;
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
    button[part='header']:hover {
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
