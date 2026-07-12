import { css } from 'lit';

// Every design value references a Web Awesome token with a --lyra-* fallback,
// so components look native inside a WA app and still render standalone.
export const tokens = css`
  :host {
    --lyra-color-surface: var(--wa-color-surface-default, #fff);
    --lyra-color-text: var(--wa-color-text-normal, #1a1a1a);
    --lyra-color-text-quiet: var(--wa-color-text-quiet, #6b7280);
    --lyra-color-border: var(--wa-color-neutral-fill-normal, #8a8a90);
    --lyra-color-brand: var(--wa-color-brand-fill-loud, #0969da);
    --lyra-color-brand-quiet: var(--wa-color-brand-fill-quiet, #ddf4ff);
    --lyra-color-success: var(--wa-color-success-fill-loud, #1a7f37);
    --lyra-color-warning: var(--wa-color-warning-fill-loud, #9a6700);
    --lyra-color-danger: var(--wa-color-danger-fill-loud, #cf222e);
    /* Text/icon color for content painted on top of a solid brand-fill
       background (selected calendar days, filled badges, etc.) -- almost
       always white on both the light and dark brand fills above, so it's
       not itself light/dark-mode-swapped like the other tokens here. */
    --lyra-color-on-brand: var(--wa-color-on-brand, #fff);
    --lyra-space-xs: var(--wa-space-xs, 0.25rem);
    --lyra-space-s: var(--wa-space-s, 0.5rem);
    --lyra-space-m: var(--wa-space-m, 0.75rem);
    --lyra-space-l: var(--wa-space-l, 1rem);
    --lyra-radius: var(--wa-border-radius-m, 0.375rem);
    --lyra-shadow: var(--wa-shadow-m, 0 2px 8px rgb(0 0 0 / 0.15));
    --lyra-font: var(--wa-font-family-body, system-ui, sans-serif);

    /* Motion — every component that animates (popovers, gauge fill, toast)
       reads from these two instead of hand-rolling its own duration/easing,
       so the library has one consistent rhythm. */
    --lyra-transition-fast: var(--wa-transition-fast, 120ms ease-out);
    --lyra-transition-base: var(--wa-transition-normal, 180ms ease-out);

    /* Disabled state — one opacity value for every disabled control,
       replacing three previously-independent hardcoded values (0.5/0.4/0.35). */
    --lyra-opacity-disabled: var(--wa-opacity-disabled, 0.5);

    /* Focus ring — every :focus-visible rule in the library should reference
       these three instead of hardcoding its own width/color/offset. */
    --lyra-focus-ring-width: 2px;
    --lyra-focus-ring-color: var(--lyra-color-brand);
    --lyra-focus-ring-offset: 2px;

    /* Minimum tappable box for an icon-only button (close/dismiss/nav
       controls). Visual icon size is unaffected; components pad out to this
       via min-inline-size/min-block-size, not by growing the glyph itself. */
    --lyra-icon-button-size: 2.5rem;

    font-family: var(--lyra-font);
    color: var(--lyra-color-text);
    box-sizing: border-box;
  }

  /* Standalone (no Web Awesome theme) dark-mode fallback. A real --wa-* value
     from a consumer's theme always wins — this only changes what a bare
     lyra-ui component renders when dropped, unstyled, onto a dark host page
     (previously zero dark-mode adaptation existed in the pure-fallback
     case). */
  @media (prefers-color-scheme: dark) {
    :host {
      --lyra-color-surface: var(--wa-color-surface-default, #1a1a1a);
      --lyra-color-text: var(--wa-color-text-normal, #f2f2f2);
      --lyra-color-text-quiet: var(--wa-color-text-quiet, #9aa1ac);
      --lyra-color-border: var(--wa-color-neutral-fill-normal, #4a4a52);
      --lyra-color-brand: var(--wa-color-brand-fill-loud, #4d9fef);
      --lyra-color-brand-quiet: var(--wa-color-brand-fill-quiet, #163650);
      --lyra-color-success: var(--wa-color-success-fill-loud, #3fb950);
      --lyra-color-warning: var(--wa-color-warning-fill-loud, #d29922);
      --lyra-color-danger: var(--wa-color-danger-fill-loud, #f85149);
    }
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
