import { css } from 'lit';
import { srOnly } from '../../internal/a11y.js';

export const styles = [
  css`
    :host {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      position: relative;
    }
    [part='base'] {
      inline-size: 100%;
      block-size: 100%;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--lr-space-xs);
      padding: var(--lr-space-s);
      box-sizing: border-box;
    }
    [part='log'],
    [part='interim-area'] {
      display: flex;
      flex-direction: column;
      gap: var(--lr-space-xs);
    }
    [part='interim-area'] {
      margin-block-start: var(--lr-space-xs);
    }
    [part='entry'] {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--lr-space-2xs);
      animation: lr-transcript-fade-in var(--lr-transition-fast) ease-out;
    }
    @keyframes lr-transcript-fade-in {
      from {
        opacity: 0;
        transform: translateY(var(--lr-size-4px));
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      [part='entry'] {
        animation: none !important;
      }
    }
    [part='entry'][data-interim] {
      opacity: var(--lr-opacity-disabled);
      font-style: italic;
    }
    [part='speaker'] {
      flex: 0 0 auto;
      font-weight: var(--lr-font-weight-semibold);
      color: var(--lr-color-text-quiet);
    }
    [part='text'] {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    [part='timestamp'] {
      flex: 0 0 auto;
      font-size: var(--lr-font-size-xs);
      color: var(--lr-color-text-quiet);
    }
    [part='empty'] {
      padding: var(--lr-space-m);
      color: var(--lr-color-text-quiet);
      text-align: center;
    }
    [part='jump-button'] {
      position: absolute;
      inset-block-end: var(--lr-space-s);
      inset-inline-end: var(--lr-space-s);
      padding: var(--lr-space-2xs) var(--lr-space-s);
      border: var(--lr-border-width-thin) solid var(--lr-color-border);
      border-radius: var(--lr-radius-pill);
      background: var(--lr-color-surface);
      color: var(--lr-color-text);
      cursor: pointer;
      box-shadow: var(--lr-shadow);
    }
    [part='jump-button']:focus-visible {
      outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
      outline-offset: var(--lr-focus-ring-offset);
    }
  `,
  srOnly,
];
