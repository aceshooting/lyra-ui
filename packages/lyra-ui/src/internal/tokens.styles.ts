import { css } from 'lit';

// Every design value references a Web Awesome token with a --lyra-* fallback,
// so components look native inside a WA app and still render standalone.
export const tokens = css`
  :host {
    --lyra-color-surface: var(--wa-color-surface-default, #fff);
    --lyra-color-text: var(--wa-color-text-normal, #1a1a1a);
    --lyra-color-text-quiet: var(--wa-color-text-quiet, #6b7280);
    --lyra-color-border: var(--wa-color-surface-border, #8a8a90);
    --lyra-color-brand: var(--wa-color-brand-fill-loud, #0969da);
    --lyra-color-brand-quiet: var(--wa-color-brand-fill-quiet, #ddf4ff);
    --lyra-color-success: var(--wa-color-success-fill-loud, #1a7f37);
    --lyra-color-success-quiet: var(--wa-color-success-fill-quiet, #dafbe1);
    --lyra-color-warning: var(--wa-color-warning-fill-loud, #9a6700);
    --lyra-color-warning-quiet: var(--wa-color-warning-fill-quiet, #fff8c5);
    --lyra-color-danger: var(--wa-color-danger-fill-loud, #cf222e);
    --lyra-color-danger-quiet: var(--wa-color-danger-fill-quiet, #ffebe9);
    /* Text/icon colors paired with each solid semantic fill. These are
       separate tokens because a theme can choose different foregrounds per
       tone, and the bright standalone dark fills require dark content. */
    --lyra-color-on-brand: var(--wa-color-brand-on-loud, #fff);
    --lyra-color-on-success: var(--wa-color-success-on-loud, #fff);
    --lyra-color-on-warning: var(--wa-color-warning-on-loud, #fff);
    --lyra-color-on-danger: var(--wa-color-danger-on-loud, #fff);
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
    --lyra-focus-ring-color: var(--wa-color-focus, var(--lyra-color-brand));
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
      --lyra-color-border: var(--wa-color-surface-border, #6b6b74);
      --lyra-color-brand: var(--wa-color-brand-fill-loud, #4ea0f0);
      --lyra-color-brand-quiet: var(--wa-color-brand-fill-quiet, #163650);
      --lyra-color-success: var(--wa-color-success-fill-loud, #3fb950);
      --lyra-color-success-quiet: var(--wa-color-success-fill-quiet, #17411e);
      --lyra-color-warning: var(--wa-color-warning-fill-loud, #d29922);
      --lyra-color-warning-quiet: var(--wa-color-warning-fill-quiet, #3b2900);
      --lyra-color-danger: var(--wa-color-danger-fill-loud, #fa524a);
      --lyra-color-danger-quiet: var(--wa-color-danger-fill-quiet, #4c1210);
      --lyra-color-on-brand: var(--wa-color-brand-on-loud, #111827);
      --lyra-color-on-success: var(--wa-color-success-on-loud, #111827);
      --lyra-color-on-warning: var(--wa-color-warning-on-loud, #111827);
      --lyra-color-on-danger: var(--wa-color-danger-on-loud, #111827);
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
