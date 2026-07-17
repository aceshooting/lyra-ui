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
      gap: var(--lyra-space-xs);
      padding: var(--lyra-space-s);
      box-sizing: border-box;
    }
    [part='log'],
    [part='interim-area'] {
      display: flex;
      flex-direction: column;
      gap: var(--lyra-space-xs);
    }
    [part='interim-area'] {
      margin-block-start: var(--lyra-space-xs);
    }
    [part='entry'] {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--lyra-space-2xs);
      animation: lyra-transcript-fade-in var(--lyra-transition-fast) ease-out;
    }
    @keyframes lyra-transcript-fade-in {
      from {
        opacity: 0;
        transform: translateY(var(--lyra-size-4px));
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
      opacity: var(--lyra-opacity-disabled);
      font-style: italic;
    }
    [part='speaker'] {
      flex: 0 0 auto;
      font-weight: var(--lyra-font-weight-semibold);
      color: var(--lyra-color-text-quiet);
    }
    [part='text'] {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    [part='timestamp'] {
      flex: 0 0 auto;
      font-size: var(--lyra-font-size-xs);
      color: var(--lyra-color-text-quiet);
    }
    [part='empty'] {
      padding: var(--lyra-space-m);
      color: var(--lyra-color-text-quiet);
      text-align: center;
    }
    [part='jump-button'] {
      position: absolute;
      inset-block-end: var(--lyra-space-s);
      inset-inline-end: var(--lyra-space-s);
      padding: var(--lyra-space-2xs) var(--lyra-space-s);
      border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
      border-radius: var(--lyra-radius-pill);
      background: var(--lyra-color-surface);
      color: var(--lyra-color-text);
      cursor: pointer;
      box-shadow: var(--lyra-shadow);
    }
    [part='jump-button']:focus-visible {
      outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
      outline-offset: var(--lyra-focus-ring-offset);
    }
  `,
  srOnly,
];
