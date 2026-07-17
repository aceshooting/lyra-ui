import { css } from 'lit';
import { srOnly } from '../../internal/a11y.js';

export const styles = [
  srOnly,
  css`
    :host {
      display: block;
      --lyra-task-list-spin: 1s linear;
    }
    [part='base'] {
      border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
      border-radius: var(--lyra-radius);
      background: var(--lyra-color-surface);
      overflow: hidden;
    }
    [part='header'] {
      display: flex;
      align-items: center;
      gap: var(--lyra-space-xs);
      inline-size: 100%;
      box-sizing: border-box;
      padding: var(--lyra-space-s) var(--lyra-space-m);
      border: none;
      background: none;
      color: var(--lyra-color-text);
      font: inherit;
      font-weight: var(--lyra-font-weight-semibold);
      font-size: var(--lyra-font-size-md-sm);
      text-align: start;
    }
    button[part='header'] {
      cursor: pointer;
    }
    button[part='header']:hover {
      background: var(--lyra-color-brand-quiet);
      color: var(--lyra-color-brand);
    }
    button[part='header']:focus-visible {
      outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
      outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
    }
    [part='toggle'] {
      display: inline-flex;
      flex: 0 0 auto;
      transition: transform var(--lyra-transition-fast);
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
      font-weight: var(--lyra-font-weight-normal);
      font-size: var(--lyra-font-size-sm);
      color: var(--lyra-color-text-quiet);
    }
    [part='body'] {
      display: flex;
      flex-direction: column;
      gap: var(--lyra-space-s);
      padding: var(--lyra-space-xs) var(--lyra-space-m) var(--lyra-space-m);
      border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    }
    [part='body'][hidden] {
      display: none;
    }
    [part='item'] {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--lyra-space-xs);
    }
    [part='item'][data-depth='1'] {
      margin-inline-start: var(--lyra-space-l);
    }
    [part='item-children'] {
      display: flex;
      flex-direction: column;
      gap: var(--lyra-space-s);
      flex-basis: 100%;
      margin-block-start: var(--lyra-space-xs);
    }
    [part='status-icon'] {
      display: inline-flex;
      flex: 0 0 auto;
      color: var(--lyra-color-text-quiet);
    }
    [part='status-icon'] svg {
      display: block;
    }
    [part='item'][data-status='running'] [part='status-icon'] {
      color: var(--lyra-color-brand);
    }
    [part='item'][data-status='running'] [part='status-icon'] svg {
      animation: lyra-task-list-spin var(--lyra-task-list-spin) infinite;
    }
    [part='item'][data-status='success'] [part='status-icon'] {
      color: var(--lyra-color-success);
    }
    [part='item'][data-status='error'] [part='status-icon'] {
      color: var(--lyra-color-danger);
    }
    [part='item-label'] {
      flex: 1 1 auto;
      min-inline-size: var(--lyra-size-6ch);
    }
    [part='item-detail'] {
      flex-basis: 100%;
      font-size: var(--lyra-font-size-sm);
      color: var(--lyra-color-text-quiet);
    }
    @keyframes lyra-task-list-spin {
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
