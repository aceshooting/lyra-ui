import { css } from 'lit';

// Every design value references a Web Awesome token with a --lyra-* fallback,
// so components look native inside a WA app and still render standalone.
export const tokens = css`
  :host {
    --lyra-color-surface: var(--wa-color-surface-default, #fff);
    --lyra-color-text: var(--wa-color-text-normal, #1a1a1a);
    --lyra-color-text-quiet: var(--wa-color-text-quiet, #6b7280);
    --lyra-color-border: var(--wa-color-neutral-fill-normal, #d4d4d8);
    --lyra-color-brand: var(--wa-color-brand-fill-loud, #0969da);
    --lyra-color-brand-quiet: var(--wa-color-brand-fill-quiet, #ddf4ff);
    --lyra-color-success: var(--wa-color-success-fill-loud, #1a7f37);
    --lyra-color-warning: var(--wa-color-warning-fill-loud, #9a6700);
    --lyra-color-danger: var(--wa-color-danger-fill-loud, #cf222e);
    --lyra-space-xs: var(--wa-space-xs, 0.25rem);
    --lyra-space-s: var(--wa-space-s, 0.5rem);
    --lyra-space-m: var(--wa-space-m, 0.75rem);
    --lyra-space-l: var(--wa-space-l, 1rem);
    --lyra-radius: var(--wa-border-radius-m, 0.375rem);
    --lyra-shadow: var(--wa-shadow-m, 0 2px 8px rgb(0 0 0 / 0.15));
    --lyra-font: var(--wa-font-family-body, system-ui, sans-serif);

    font-family: var(--lyra-font);
    color: var(--lyra-color-text);
    box-sizing: border-box;
  }
  :host([hidden]) {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;
