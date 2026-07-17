import { css } from 'lit';

// Every design value chains through a --lyra-theme-* custom property with a hardcoded
// fallback, so a consumer can retheme the whole library by overriding one property per
// token at any ancestor, while every component still renders sensibly with zero configuration.
export const tokens = css`
  :host {
    --lyra-color-surface: var(--lyra-theme-color-surface-default, #fff);
    --lyra-color-surface-raised: var(--lyra-theme-color-surface-raised, #f6f8fa);
    --lyra-color-text: var(--lyra-theme-color-text-normal, #1a1a1a);
    --lyra-color-text-quiet: var(--lyra-theme-color-text-quiet, #6b7280);
    --lyra-color-border: var(--lyra-theme-color-surface-border, #8a8a90);
    --lyra-color-border-strong: var(--lyra-theme-color-border-strong, #4b5563);
    --lyra-color-brand: var(--lyra-theme-color-brand-fill-loud, #0969da);
    --lyra-color-brand-quiet: var(--lyra-theme-color-brand-fill-quiet, #ddf4ff);
    --lyra-color-success: var(--lyra-theme-color-success-fill-loud, #1a7f37);
    --lyra-color-success-quiet: var(--lyra-theme-color-success-fill-quiet, #dafbe1);
    --lyra-color-warning: var(--lyra-theme-color-warning-fill-loud, #9a6700);
    --lyra-color-warning-quiet: var(--lyra-theme-color-warning-fill-quiet, #fff8c5);
    --lyra-color-danger: var(--lyra-theme-color-danger-fill-loud, #cf222e);
    --lyra-color-danger-quiet: var(--lyra-theme-color-danger-fill-quiet, #ffebe9);
    /* A solid, high-contrast neutral fill -- distinct from --lyra-color-surface (which is the
       ambient page/panel background, not a "loud" accent) and from --lyra-color-text (used as a
       plain-text/outline accent, not a fill). Backs lyra-button's appearance="accent" tier for
       variant="neutral", the one variant whose other tokens all resolve to ambient/plain values. */
    --lyra-color-neutral: var(--lyra-theme-color-neutral-fill-loud, #1a1a1a);
    /* Text/icon colors paired with each solid semantic fill. These are
       separate tokens because a theme can choose different foregrounds per
       tone, and the bright standalone dark fills require dark content. */
    --lyra-color-on-brand: var(--lyra-theme-color-brand-on-loud, #fff);
    --lyra-color-on-success: var(--lyra-theme-color-success-on-loud, #fff);
    --lyra-color-on-warning: var(--lyra-theme-color-warning-on-loud, #fff);
    --lyra-color-on-danger: var(--lyra-theme-color-danger-on-loud, #fff);
    --lyra-color-on-neutral: var(--lyra-theme-color-neutral-on-loud, #fff);
    --lyra-color-overlay: var(--lyra-theme-color-overlay, rgb(0 0 0 / 0.5));
    --lyra-color-overlay-strong: var(--lyra-theme-color-overlay, rgb(0 0 0 / 0.92));
    --lyra-color-no-data: var(--lyra-theme-color-no-data, rgb(128 128 128 / 25%));
    --lyra-font-mono: var(--lyra-theme-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    --lyra-space-xs: var(--lyra-theme-space-xs, 0.25rem);
    --lyra-space-s: var(--lyra-theme-space-s, 0.5rem);
    --lyra-space-m: var(--lyra-theme-space-m, 0.75rem);
    --lyra-space-l: var(--lyra-theme-space-l, 1rem);
    /* Semantic type, density, border, radius, and layer scales. Component styles consume
       these names; the exact fallback values remain centralized here so a theme can retune
       typography and geometry without editing every component. */
    --lyra-space-2xs: var(--lyra-theme-space-2xs, 0.125rem);
    --lyra-space-2xl: var(--lyra-theme-space-2xl, 2rem);
    --lyra-font-size-2xs: var(--lyra-theme-font-size-2xs, 0.625rem);
    --lyra-font-size-xs: var(--lyra-theme-font-size-xs, 0.75rem);
    --lyra-font-size-sm: var(--lyra-theme-font-size-sm, 0.8125rem);
    --lyra-font-size-m: var(--lyra-theme-font-size-m, 1rem);
    --lyra-font-size-md-sm: var(--lyra-theme-font-size-md-sm, 0.875rem);
    --lyra-font-size-md: var(--lyra-theme-font-size-md, 1rem);
    --lyra-font-size-lg: var(--lyra-theme-font-size-lg, 1.125rem);
    --lyra-font-size-xl: var(--lyra-theme-font-size-xl, 1.25rem);
    --lyra-font-size-2xl: var(--lyra-theme-font-size-2xl, 1.75rem);
    --lyra-font-size-3xl: var(--lyra-theme-font-size-3xl, 2rem);
    --lyra-font-weight-normal: var(--lyra-theme-font-weight-normal, 400);
    --lyra-font-weight-medium: var(--lyra-theme-font-weight-medium, 500);
    --lyra-font-weight-semibold: var(--lyra-theme-font-weight-semibold, 600);
    --lyra-font-weight-bold: var(--lyra-theme-font-weight-bold, 700);
    --lyra-line-height-none: var(--lyra-theme-line-height-none, 1);
    --lyra-line-height-compact: var(--lyra-theme-line-height-compact, 1.25);
    --lyra-line-height-snug: var(--lyra-theme-line-height-snug, 1.3);
    --lyra-line-height-1-4: var(--lyra-theme-line-height-1-4, 1.4);
    --lyra-line-height-normal: var(--lyra-theme-line-height-normal, 1.5);
    --lyra-line-height-loose: var(--lyra-theme-line-height-loose, 1.6);
    --lyra-border-width-thin: var(--lyra-theme-border-width-thin, 1px);
    --lyra-border-width-medium: var(--lyra-theme-border-width-medium, 2px);
    --lyra-border-width-thick: var(--lyra-theme-border-width-thick, 3px);
    --lyra-radius-xs: var(--lyra-theme-border-radius-xs, 2px);
    --lyra-radius-pill: var(--lyra-theme-border-radius-pill, 999px);
    --lyra-color-shadow: var(--lyra-theme-color-shadow, #000);
    --lyra-color-chart-1: var(--lyra-theme-color-chart-1, #8250df);
    --lyra-color-chart-2: var(--lyra-theme-color-chart-2, #bf3989);
    --lyra-color-chart-3: var(--lyra-theme-color-chart-3, #0a7d91);
    --lyra-color-chart-4: var(--lyra-theme-color-chart-4, #57606a);
    --lyra-color-chart-5: var(--lyra-theme-color-chart-5, #b083f5);
    --lyra-color-chart-6: var(--lyra-theme-color-chart-6, #f470b8);
    --lyra-color-chart-7: var(--lyra-theme-color-chart-7, #52d6e8);
    --lyra-color-chart-8: var(--lyra-theme-color-chart-8, #c9d1d9);
    /* Ordered categorical fallback palette for typed graph nodes (GraphNodeType with no explicit
       color) and Family K's graph-legend swatches, assigned by nodeTypes entry index % 8. A
       separate, independently themeable ramp from --lyra-color-chart-* (same starting values,
       own --lyra-theme-graph-cat-* retheme hook) so a consumer can recolor chart series and KG
       entity types independently. */
    --lyra-graph-cat-1: var(--lyra-theme-graph-cat-1, #8250df);
    --lyra-graph-cat-2: var(--lyra-theme-graph-cat-2, #bf3989);
    --lyra-graph-cat-3: var(--lyra-theme-graph-cat-3, #0a7d91);
    --lyra-graph-cat-4: var(--lyra-theme-graph-cat-4, #57606a);
    --lyra-graph-cat-5: var(--lyra-theme-graph-cat-5, #b083f5);
    --lyra-graph-cat-6: var(--lyra-theme-graph-cat-6, #f470b8);
    --lyra-graph-cat-7: var(--lyra-theme-graph-cat-7, #52d6e8);
    --lyra-graph-cat-8: var(--lyra-theme-graph-cat-8, #c9d1d9);
    --lyra-layer-base: var(--lyra-theme-z-index-base, 0);
    --lyra-layer-content: var(--lyra-theme-z-index-content, 1);
    --lyra-layer-dropdown: var(--lyra-theme-z-index-dropdown, 900);
    --lyra-layer-popover: var(--lyra-theme-z-index-popover, 1000);
    --lyra-layer-modal: var(--lyra-theme-z-index-modal, 1000);
    --lyra-layer-toast: var(--lyra-theme-z-index-toast, 9999);
    --lyra-safe-area-top: env(safe-area-inset-top, 0px);
    --lyra-safe-area-bottom: env(safe-area-inset-bottom, 0px);
    --lyra-safe-area-inline-start: env(safe-area-inset-left, 0px);
    --lyra-safe-area-inline-end: env(safe-area-inset-right, 0px);
    --lyra-size-neg-0-15rem: var(--lyra-theme-size-neg-0-15rem, -0.15rem);
    --lyra-size-neg-0-25rem: var(--lyra-theme-size-neg-0-25rem, -0.25rem);
    --lyra-size-neg-1px: var(--lyra-theme-size-neg-1px, -1px);
    --lyra-size-neg-4px: var(--lyra-theme-size-neg-4px, -4px);
    --lyra-size-neg-6px: var(--lyra-theme-size-neg-6px, -6px);
    --lyra-size-neg-8px: var(--lyra-theme-size-neg-8px, -8px);
    --lyra-size-0-02em: var(--lyra-theme-size-0-02em, 0.02em);
    --lyra-size-0-03em: var(--lyra-theme-size-0-03em, 0.03em);
    --lyra-size-0-04em: var(--lyra-theme-size-0-04em, 0.04em);
    --lyra-size-0-05rem: var(--lyra-theme-size-0-05rem, 0.05rem);
    --lyra-size-0-0625rem: var(--lyra-theme-size-0-0625rem, 0.0625rem);
    --lyra-size-0-09375rem: var(--lyra-theme-size-0-09375rem, 0.09375rem);
    --lyra-size-0-125rem: var(--lyra-theme-size-0-125rem, 0.125rem);
    --lyra-size-0-15rem: var(--lyra-theme-size-0-15rem, 0.15rem);
    --lyra-size-0-1875rem: var(--lyra-theme-size-0-1875rem, 0.1875rem);
    --lyra-size-0-1rem: var(--lyra-theme-size-0-1rem, 0.1rem);
    --lyra-size-0-25rem: var(--lyra-theme-size-0-25rem, 0.25rem);
    --lyra-size-0-3125rem: var(--lyra-theme-size-0-3125rem, 0.3125rem);
    --lyra-size-0-35em: var(--lyra-theme-size-0-35em, 0.35em);
    --lyra-size-0-375rem: var(--lyra-theme-size-0-375rem, 0.375rem);
    --lyra-size-0-3em: var(--lyra-theme-size-0-3em, 0.3em);
    --lyra-size-0-4375rem: var(--lyra-theme-size-0-4375rem, 0.4375rem);
    --lyra-size-0-4em: var(--lyra-theme-size-0-4em, 0.4em);
    --lyra-size-0-4rem: var(--lyra-theme-size-0-4rem, 0.4rem);
    --lyra-size-0-5em: var(--lyra-theme-size-0-5em, 0.5em);
    --lyra-size-0-5rem: var(--lyra-theme-size-0-5rem, 0.5rem);
    --lyra-size-0-625rem: var(--lyra-theme-size-0-625rem, 0.625rem);
    --lyra-size-0-6875rem: var(--lyra-theme-size-0-6875rem, 0.6875rem);
    --lyra-size-0-6rem: var(--lyra-theme-size-0-6rem, 0.6rem);
    --lyra-size-0-75em: var(--lyra-theme-size-0-75em, 0.75em);
    --lyra-size-0-75rem: var(--lyra-theme-size-0-75rem, 0.75rem);
    --lyra-size-0-7em: var(--lyra-theme-size-0-7em, 0.7em);
    --lyra-size-0-875em: var(--lyra-theme-size-0-875em, 0.875em);
    --lyra-size-0-8rem: var(--lyra-theme-size-0-8rem, 0.8rem);
    --lyra-size-0-9375rem: var(--lyra-theme-size-0-9375rem, 0.9375rem);
    --lyra-size-1-0625rem: var(--lyra-theme-size-1-0625rem, 1.0625rem);
    --lyra-size-1-1rem: var(--lyra-theme-size-1-1rem, 1.1rem);
    --lyra-size-1-25rem: var(--lyra-theme-size-1-25rem, 1.25rem);
    --lyra-size-1-5em: var(--lyra-theme-size-1-5em, 1.5em);
    --lyra-size-1-5rem: var(--lyra-theme-size-1-5rem, 1.5rem);
    --lyra-size-1-75rem: var(--lyra-theme-size-1-75rem, 1.75rem);
    --lyra-size-1-875rem: var(--lyra-theme-size-1-875rem, 1.875rem);
    --lyra-size-10px: var(--lyra-theme-size-10px, 10px);
    --lyra-size-10rem: var(--lyra-theme-size-10rem, 10rem);
    --lyra-size-12em: var(--lyra-theme-size-12em, 12em);
    --lyra-size-12rem: var(--lyra-theme-size-12rem, 12rem);
    --lyra-size-14px: var(--lyra-theme-size-14px, 14px);
    --lyra-size-14rem: var(--lyra-theme-size-14rem, 14rem);
    --lyra-size-15rem: var(--lyra-theme-size-15rem, 15rem);
    --lyra-size-16px: var(--lyra-theme-size-16px, 16px);
    --lyra-size-16rem: var(--lyra-theme-size-16rem, 16rem);
    --lyra-size-18rem: var(--lyra-theme-size-18rem, 18rem);
    --lyra-size-1em: var(--lyra-theme-size-1em, 1em);
    --lyra-size-1px: var(--lyra-theme-size-1px, 1px);
    --lyra-size-1rem: var(--lyra-theme-size-1rem, 1rem);
    --lyra-size-2-25rem: var(--lyra-theme-size-2-25rem, 2.25rem);
    --lyra-size-2-5rem: var(--lyra-theme-size-2-5rem, 2.5rem);
    --lyra-size-2-5ch: var(--lyra-theme-size-2-5ch, 2.5ch);
    --lyra-size-20rem: var(--lyra-theme-size-20rem, 20rem);
    --lyra-size-22rem: var(--lyra-theme-size-22rem, 22rem);
    --lyra-size-24px: var(--lyra-theme-size-24px, 24px);
    --lyra-size-24rem: var(--lyra-theme-size-24rem, 24rem);
    --lyra-size-280px: var(--lyra-theme-size-280px, 280px);
    --lyra-size-28px: var(--lyra-theme-size-28px, 28px);
    --lyra-size-28rem: var(--lyra-theme-size-28rem, 28rem);
    --lyra-size-2px: var(--lyra-theme-size-2px, 2px);
    --lyra-size-2rem: var(--lyra-theme-size-2rem, 2rem);
    --lyra-size-3-5rem: var(--lyra-theme-size-3-5rem, 3.5rem);
    --lyra-size-30rem: var(--lyra-theme-size-30rem, 30rem);
    --lyra-size-32rem: var(--lyra-theme-size-32rem, 32rem);
    --lyra-size-36rem: var(--lyra-theme-size-36rem, 36rem);
    --lyra-size-38rem: var(--lyra-theme-size-38rem, 38rem);
    --lyra-size-3px: var(--lyra-theme-size-3px, 3px);
    --lyra-size-3rem: var(--lyra-theme-size-3rem, 3rem);
    --lyra-size-3ch: var(--lyra-theme-size-3ch, 3ch);
    --lyra-size-3-5em: var(--lyra-theme-size-3-5em, 3.5em);
    --lyra-size-48rem: var(--lyra-theme-size-48rem, 48rem);
    --lyra-size-4px: var(--lyra-theme-size-4px, 4px);
    --lyra-size-4rem: var(--lyra-theme-size-4rem, 4rem);
    --lyra-size-4ch: var(--lyra-theme-size-4ch, 4ch);
    --lyra-size-5em: var(--lyra-theme-size-5em, 5em);
    --lyra-size-6em: var(--lyra-theme-size-6em, 6em);
    --lyra-size-6px: var(--lyra-theme-size-6px, 6px);
    --lyra-size-6rem: var(--lyra-theme-size-6rem, 6rem);
    --lyra-size-6ch: var(--lyra-theme-size-6ch, 6ch);
    --lyra-size-8em: var(--lyra-theme-size-8em, 8em);
    --lyra-size-8rem: var(--lyra-theme-size-8rem, 8rem);
    --lyra-radius: var(--lyra-theme-border-radius-m, 0.375rem);
    --lyra-shadow: var(--lyra-theme-shadow-m, 0 2px 8px rgb(0 0 0 / 0.15));
    --lyra-font: var(--lyra-theme-font-family-body, system-ui, sans-serif);

    /* Motion — every component that animates (popovers, gauge fill, toast)
       reads from these three instead of hand-rolling its own duration/easing,
       so the library has one consistent rhythm. -fast/-base are for discrete
       state-change transitions; -ambient is reserved for infinite looping
       "still alive" indicators (a calm ~1.8s breathing pulse, not a flicker). */
    --lyra-transition-fast: var(--lyra-theme-transition-fast, 120ms ease-out);
    --lyra-transition-base: var(--lyra-theme-transition-normal, 180ms ease-out);
    --lyra-transition-ambient: var(--lyra-theme-transition-slow, 1.8s ease-in-out);

    /* Disabled state — one opacity value for every disabled control,
       replacing three previously-independent hardcoded values (0.5/0.4/0.35). */
    --lyra-opacity-disabled: var(--lyra-theme-opacity-disabled, 0.5);

    /* Focus ring — every :focus-visible rule in the library should reference
       these three instead of hardcoding its own width/color/offset. */
    --lyra-focus-ring-width: 2px;
    --lyra-focus-ring-color: var(--lyra-theme-color-focus, var(--lyra-color-brand));
    --lyra-focus-ring-offset: 2px;

    /* Minimum tappable box for an icon-only button (close/dismiss/nav
       controls). Visual icon size is unaffected; components pad out to this
       via min-inline-size/min-block-size, not by growing the glyph itself. */
    --lyra-icon-button-size: 2.5rem;

    font-family: var(--lyra-font);
    color: var(--lyra-color-text);
    box-sizing: border-box;
  }

  /* Safe-area environment variables are physical. Mirror the logical aliases
     so inline-start/end keep their meaning when direction is inherited as RTL. */
  :host(:dir(rtl)) {
    --lyra-safe-area-inline-start: env(safe-area-inset-right, 0px);
    --lyra-safe-area-inline-end: env(safe-area-inset-left, 0px);
  }

  /* Standalone (no consumer theme set) dark-mode fallback. A real --lyra-theme-* value
     set by a consumer always wins — this only changes what a bare
     lyra-ui component renders when dropped, unstyled, onto a dark host page
     (previously zero dark-mode adaptation existed in the pure-fallback
     case). */
  @media (prefers-color-scheme: dark) {
    :host {
      --lyra-color-surface: var(--lyra-theme-color-surface-default, #1a1a1a);
      --lyra-color-surface-raised: var(--lyra-theme-color-surface-raised, #22272e);
      --lyra-color-text: var(--lyra-theme-color-text-normal, #f2f2f2);
      --lyra-color-text-quiet: var(--lyra-theme-color-text-quiet, #9aa1ac);
      --lyra-color-border: var(--lyra-theme-color-surface-border, #6b6b74);
      --lyra-color-border-strong: var(--lyra-theme-color-border-strong, #c4c9d1);
      --lyra-color-brand: var(--lyra-theme-color-brand-fill-loud, #4ea0f0);
      --lyra-color-brand-quiet: var(--lyra-theme-color-brand-fill-quiet, #163650);
      --lyra-color-success: var(--lyra-theme-color-success-fill-loud, #3fb950);
      --lyra-color-success-quiet: var(--lyra-theme-color-success-fill-quiet, #17411e);
      --lyra-color-warning: var(--lyra-theme-color-warning-fill-loud, #d29922);
      --lyra-color-warning-quiet: var(--lyra-theme-color-warning-fill-quiet, #3b2900);
      --lyra-color-danger: var(--lyra-theme-color-danger-fill-loud, #fa524a);
      --lyra-color-danger-quiet: var(--lyra-theme-color-danger-fill-quiet, #4c1210);
      --lyra-color-neutral: var(--lyra-theme-color-neutral-fill-loud, #e5e7eb);
      --lyra-color-on-brand: var(--lyra-theme-color-brand-on-loud, #111827);
      --lyra-color-on-success: var(--lyra-theme-color-success-on-loud, #111827);
      --lyra-color-on-warning: var(--lyra-theme-color-warning-on-loud, #111827);
      --lyra-color-on-danger: var(--lyra-theme-color-danger-on-loud, #111827);
      --lyra-color-on-neutral: var(--lyra-theme-color-neutral-on-loud, #111827);
      --lyra-color-chart-1: var(--lyra-theme-color-chart-1, #b58cff);
      --lyra-color-chart-2: var(--lyra-theme-color-chart-2, #ff7ab2);
      --lyra-color-chart-3: var(--lyra-theme-color-chart-3, #4fd1c5);
      --lyra-color-chart-4: var(--lyra-theme-color-chart-4, #aab4c4);
      --lyra-color-chart-5: var(--lyra-theme-color-chart-5, #d4a7ff);
      --lyra-color-chart-6: var(--lyra-theme-color-chart-6, #ff91c8);
      --lyra-color-chart-7: var(--lyra-theme-color-chart-7, #79e2ef);
      --lyra-color-chart-8: var(--lyra-theme-color-chart-8, #e4e7eb);
      --lyra-graph-cat-1: var(--lyra-theme-graph-cat-1, #b58cff);
      --lyra-graph-cat-2: var(--lyra-theme-graph-cat-2, #ff7ab2);
      --lyra-graph-cat-3: var(--lyra-theme-graph-cat-3, #4fd1c5);
      --lyra-graph-cat-4: var(--lyra-theme-graph-cat-4, #aab4c4);
      --lyra-graph-cat-5: var(--lyra-theme-graph-cat-5, #d4a7ff);
      --lyra-graph-cat-6: var(--lyra-theme-graph-cat-6, #ff91c8);
      --lyra-graph-cat-7: var(--lyra-theme-graph-cat-7, #79e2ef);
      --lyra-graph-cat-8: var(--lyra-theme-graph-cat-8, #e4e7eb);
    }
  }

  /* Reduced motion is centralized so components using either the shared
     transition tokens or a component animation get the same behavior. The
     tiny non-zero duration keeps animationend/transitionend contracts from
     becoming engine-dependent while making the visual movement imperceptible. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --lyra-transition-fast: 0.001ms linear;
      --lyra-transition-base: 0.001ms linear;
      --lyra-transition-ambient: 0.001ms linear;
    }
    :host *,
    :host *::before,
    :host *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* System colors keep custom controls, SVG marks, and canvas-adjacent chrome
     legible when the user agent replaces the normal palette. Component CSS
     and drawing code consume these semantic tokens, so the same mode applies
     to DOM and non-DOM visuals. */
  @media (forced-colors: active) {
    :host {
      --lyra-color-surface: Canvas;
      --lyra-color-surface-raised: Canvas;
      --lyra-color-text: CanvasText;
      --lyra-color-text-quiet: CanvasText;
      --lyra-color-border: ButtonText;
      --lyra-color-brand: LinkText;
      --lyra-color-brand-quiet: Canvas;
      --lyra-color-success: LinkText;
      --lyra-color-success-quiet: Canvas;
      --lyra-color-warning: CanvasText;
      --lyra-color-warning-quiet: Canvas;
      --lyra-color-danger: LinkText;
      --lyra-color-danger-quiet: Canvas;
      --lyra-color-neutral: ButtonText;
      --lyra-color-on-brand: Canvas;
      --lyra-color-on-success: Canvas;
      --lyra-color-on-warning: Canvas;
      --lyra-color-on-danger: Canvas;
      --lyra-color-on-neutral: Canvas;
      --lyra-color-chart-1: Highlight;
      --lyra-color-chart-2: LinkText;
      --lyra-color-chart-3: CanvasText;
      --lyra-color-chart-4: Highlight;
      --lyra-color-chart-5: LinkText;
      --lyra-color-chart-6: CanvasText;
      --lyra-color-chart-7: Highlight;
      --lyra-color-chart-8: LinkText;
      --lyra-graph-cat-1: Highlight;
      --lyra-graph-cat-2: LinkText;
      --lyra-graph-cat-3: CanvasText;
      --lyra-graph-cat-4: Highlight;
      --lyra-graph-cat-5: LinkText;
      --lyra-graph-cat-6: CanvasText;
      --lyra-graph-cat-7: Highlight;
      --lyra-graph-cat-8: LinkText;
      --lyra-focus-ring-color: Highlight;
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
