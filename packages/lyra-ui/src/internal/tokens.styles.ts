import { css } from 'lit';

// Every design value chains through a --lr-theme-* custom property with a hardcoded
// fallback, so a consumer can retheme the whole library by overriding one property per
// token at any ancestor, while every component still renders sensibly with zero configuration.
export const tokens = css`
  :host {
    --lr-color-surface: var(--lr-theme-color-surface-default, #fff);
    --lr-color-surface-raised: var(--lr-theme-color-surface-raised, #f6f8fa);
    --lr-color-text: var(--lr-theme-color-text-normal, #1a1a1a);
    --lr-color-text-quiet: var(--lr-theme-color-text-quiet, #6b7280);
    --lr-color-border: var(--lr-theme-color-surface-border, #8a8a90);
    --lr-color-border-strong: var(--lr-theme-color-border-strong, #4b5563);
    --lr-color-brand: var(--lr-theme-color-brand-fill-loud, #0969da);
    --lr-color-brand-quiet: var(--lr-theme-color-brand-fill-quiet, #ddf4ff);
    --lr-color-success: var(--lr-theme-color-success-fill-loud, #1a7f37);
    --lr-color-success-quiet: var(--lr-theme-color-success-fill-quiet, #dafbe1);
    --lr-color-warning: var(--lr-theme-color-warning-fill-loud, #9a6700);
    --lr-color-warning-quiet: var(--lr-theme-color-warning-fill-quiet, #fff8c5);
    --lr-color-danger: var(--lr-theme-color-danger-fill-loud, #cf222e);
    --lr-color-danger-quiet: var(--lr-theme-color-danger-fill-quiet, #ffebe9);
    /* A solid, high-contrast neutral fill -- distinct from --lr-color-surface (which is the
       ambient page/panel background, not a "loud" accent) and from --lr-color-text (used as a
       plain-text/outline accent, not a fill). Backs lr-button's appearance="accent" tier for
       variant="neutral", the one variant whose other tokens all resolve to ambient/plain values. */
    --lr-color-neutral: var(--lr-theme-color-neutral-fill-loud, #1a1a1a);
    /* Text/icon colors paired with each solid semantic fill. These are
       separate tokens because a theme can choose different foregrounds per
       tone, and the bright standalone dark fills require dark content. */
    --lr-color-on-brand: var(--lr-theme-color-brand-on-loud, #fff);
    --lr-color-on-success: var(--lr-theme-color-success-on-loud, #fff);
    --lr-color-on-warning: var(--lr-theme-color-warning-on-loud, #fff);
    --lr-color-on-danger: var(--lr-theme-color-danger-on-loud, #fff);
    --lr-color-on-neutral: var(--lr-theme-color-neutral-on-loud, #fff);
    --lr-color-overlay: var(--lr-theme-color-overlay, rgb(0 0 0 / 0.5));
    /* Own input, chained through --lr-theme-color-overlay for back-compat: both scrims
       previously read the same input, so defining it flattened the strong scrim's 0.92
       down to the plain scrim's value. A theme that sets only --lr-theme-color-overlay
       still tints both, exactly as before. */
    --lr-color-overlay-strong: var(--lr-theme-color-overlay-strong, var(--lr-theme-color-overlay, rgb(0 0 0 / 0.92)));
    --lr-color-no-data: var(--lr-theme-color-no-data, rgb(128 128 128 / 25%));
    --lr-font-mono: var(--lr-theme-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    --lr-space-xs: var(--lr-theme-space-xs, 0.25rem);
    --lr-space-s: var(--lr-theme-space-s, 0.5rem);
    --lr-space-m: var(--lr-theme-space-m, 0.75rem);
    --lr-space-l: var(--lr-theme-space-l, 1rem);
    /* Semantic type, density, border, radius, and layer scales. Component styles consume
       these names; the exact fallback values remain centralized here so a theme can retune
       typography and geometry without editing every component. */
    --lr-space-2xs: var(--lr-theme-space-2xs, 0.125rem);
    --lr-space-2xl: var(--lr-theme-space-2xl, 2rem);
    --lr-font-size-2xs: var(--lr-theme-font-size-2xs, 0.625rem);
    --lr-font-size-xs: var(--lr-theme-font-size-xs, 0.75rem);
    --lr-font-size-sm: var(--lr-theme-font-size-sm, 0.8125rem);
    --lr-font-size-m: var(--lr-theme-font-size-m, 1rem);
    --lr-font-size-md-sm: var(--lr-theme-font-size-md-sm, 0.875rem);
    --lr-font-size-md: var(--lr-theme-font-size-md, 1rem);
    --lr-font-size-lg: var(--lr-theme-font-size-lg, 1.125rem);
    --lr-font-size-xl: var(--lr-theme-font-size-xl, 1.25rem);
    --lr-font-size-2xl: var(--lr-theme-font-size-2xl, 1.75rem);
    --lr-font-size-3xl: var(--lr-theme-font-size-3xl, 2rem);
    --lr-font-weight-normal: var(--lr-theme-font-weight-normal, 400);
    --lr-font-weight-medium: var(--lr-theme-font-weight-medium, 500);
    --lr-font-weight-semibold: var(--lr-theme-font-weight-semibold, 600);
    --lr-font-weight-bold: var(--lr-theme-font-weight-bold, 700);
    --lr-line-height-none: var(--lr-theme-line-height-none, 1);
    --lr-line-height-compact: var(--lr-theme-line-height-compact, 1.25);
    --lr-line-height-snug: var(--lr-theme-line-height-snug, 1.3);
    --lr-line-height-1-4: var(--lr-theme-line-height-1-4, 1.4);
    --lr-line-height-normal: var(--lr-theme-line-height-normal, 1.5);
    --lr-line-height-loose: var(--lr-theme-line-height-loose, 1.6);
    --lr-border-width-thin: var(--lr-theme-border-width-thin, 1px);
    --lr-border-width-medium: var(--lr-theme-border-width-medium, 2px);
    --lr-border-width-thick: var(--lr-theme-border-width-thick, 3px);
    --lr-radius-xs: var(--lr-theme-border-radius-xs, 2px);
    --lr-radius-pill: var(--lr-theme-border-radius-pill, 999px);
    --lr-color-shadow: var(--lr-theme-color-shadow, #000);
    --lr-color-chart-1: var(--lr-theme-color-chart-1, #8250df);
    --lr-color-chart-2: var(--lr-theme-color-chart-2, #bf3989);
    --lr-color-chart-3: var(--lr-theme-color-chart-3, #0a7d91);
    --lr-color-chart-4: var(--lr-theme-color-chart-4, #57606a);
    --lr-color-chart-5: var(--lr-theme-color-chart-5, #b083f5);
    --lr-color-chart-6: var(--lr-theme-color-chart-6, #f470b8);
    --lr-color-chart-7: var(--lr-theme-color-chart-7, #52d6e8);
    --lr-color-chart-8: var(--lr-theme-color-chart-8, #c9d1d9);
    /* Ordered categorical fallback palette for typed graph nodes (GraphNodeType with no explicit
       color) and any future graph-legend swatches, assigned by nodeTypes entry index % 8. A
       separate, independently themeable ramp from --lr-color-chart-* (same starting values,
       own --lr-theme-graph-cat-* retheme hook) so a consumer can recolor chart series and KG
       entity types independently. */
    --lr-graph-cat-1: var(--lr-theme-graph-cat-1, #8250df);
    --lr-graph-cat-2: var(--lr-theme-graph-cat-2, #bf3989);
    --lr-graph-cat-3: var(--lr-theme-graph-cat-3, #0a7d91);
    --lr-graph-cat-4: var(--lr-theme-graph-cat-4, #57606a);
    --lr-graph-cat-5: var(--lr-theme-graph-cat-5, #b083f5);
    --lr-graph-cat-6: var(--lr-theme-graph-cat-6, #f470b8);
    --lr-graph-cat-7: var(--lr-theme-graph-cat-7, #52d6e8);
    --lr-graph-cat-8: var(--lr-theme-graph-cat-8, #c9d1d9);
    /* The 16-color ANSI/SGR palette (<lr-terminal>'s CSI-30..37/90..97 foreground and
       CSI-40..47/100..107 background codes render via these, see internal/ansi.ts's FG_VARS/BG_VARS) --
       each independently themeable via its own --lr-theme-terminal-color-* hook. */
    --lr-terminal-color-black: var(--lr-theme-terminal-color-black, #24292e);
    --lr-terminal-color-red: var(--lr-theme-terminal-color-red, #cf222e);
    --lr-terminal-color-green: var(--lr-theme-terminal-color-green, #1a7f37);
    --lr-terminal-color-yellow: var(--lr-theme-terminal-color-yellow, #9a6700);
    --lr-terminal-color-blue: var(--lr-theme-terminal-color-blue, #0969da);
    --lr-terminal-color-magenta: var(--lr-theme-terminal-color-magenta, #8250df);
    --lr-terminal-color-cyan: var(--lr-theme-terminal-color-cyan, #1b7c83);
    --lr-terminal-color-white: var(--lr-theme-terminal-color-white, #6b7280);
    --lr-terminal-color-bright-black: var(--lr-theme-terminal-color-bright-black, #57606a);
    --lr-terminal-color-bright-red: var(--lr-theme-terminal-color-bright-red, #fa4549);
    --lr-terminal-color-bright-green: var(--lr-theme-terminal-color-bright-green, #4ac26b);
    --lr-terminal-color-bright-yellow: var(--lr-theme-terminal-color-bright-yellow, #d4a72c);
    --lr-terminal-color-bright-blue: var(--lr-theme-terminal-color-bright-blue, #4184e4);
    --lr-terminal-color-bright-magenta: var(--lr-theme-terminal-color-bright-magenta, #a475f9);
    --lr-terminal-color-bright-cyan: var(--lr-theme-terminal-color-bright-cyan, #3192aa);
    --lr-terminal-color-bright-white: var(--lr-theme-terminal-color-bright-white, #d0d7de);
    --lr-layer-base: var(--lr-theme-z-index-base, 0);
    --lr-layer-content: var(--lr-theme-z-index-content, 1);
    --lr-layer-dropdown: var(--lr-theme-z-index-dropdown, 900);
    --lr-layer-popover: var(--lr-theme-z-index-popover, 1000);
    --lr-layer-modal: var(--lr-theme-z-index-modal, 1000);
    --lr-layer-toast: var(--lr-theme-z-index-toast, 9999);
    --lr-safe-area-top: env(safe-area-inset-top, 0px);
    --lr-safe-area-bottom: env(safe-area-inset-bottom, 0px);
    --lr-safe-area-inline-start: env(safe-area-inset-left, 0px);
    --lr-safe-area-inline-end: env(safe-area-inset-right, 0px);
    --lr-size-neg-0-15rem: var(--lr-theme-size-neg-0-15rem, -0.15rem);
    --lr-size-neg-0-25rem: var(--lr-theme-size-neg-0-25rem, -0.25rem);
    --lr-size-neg-1px: var(--lr-theme-size-neg-1px, -1px);
    --lr-size-neg-4px: var(--lr-theme-size-neg-4px, -4px);
    --lr-size-neg-6px: var(--lr-theme-size-neg-6px, -6px);
    --lr-size-neg-8px: var(--lr-theme-size-neg-8px, -8px);
    --lr-size-0-02em: var(--lr-theme-size-0-02em, 0.02em);
    --lr-size-0-03em: var(--lr-theme-size-0-03em, 0.03em);
    --lr-size-0-04em: var(--lr-theme-size-0-04em, 0.04em);
    --lr-size-0-05rem: var(--lr-theme-size-0-05rem, 0.05rem);
    --lr-size-0-0625rem: var(--lr-theme-size-0-0625rem, 0.0625rem);
    --lr-size-0-09375rem: var(--lr-theme-size-0-09375rem, 0.09375rem);
    --lr-size-0-125rem: var(--lr-theme-size-0-125rem, 0.125rem);
    --lr-size-0-15rem: var(--lr-theme-size-0-15rem, 0.15rem);
    --lr-size-0-1875rem: var(--lr-theme-size-0-1875rem, 0.1875rem);
    --lr-size-0-1rem: var(--lr-theme-size-0-1rem, 0.1rem);
    --lr-size-0-25rem: var(--lr-theme-size-0-25rem, 0.25rem);
    --lr-size-0-3125rem: var(--lr-theme-size-0-3125rem, 0.3125rem);
    --lr-size-0-35em: var(--lr-theme-size-0-35em, 0.35em);
    --lr-size-0-375rem: var(--lr-theme-size-0-375rem, 0.375rem);
    --lr-size-0-3em: var(--lr-theme-size-0-3em, 0.3em);
    --lr-size-0-4375rem: var(--lr-theme-size-0-4375rem, 0.4375rem);
    --lr-size-0-4em: var(--lr-theme-size-0-4em, 0.4em);
    --lr-size-0-4rem: var(--lr-theme-size-0-4rem, 0.4rem);
    --lr-size-0-5em: var(--lr-theme-size-0-5em, 0.5em);
    --lr-size-0-5rem: var(--lr-theme-size-0-5rem, 0.5rem);
    --lr-size-0-625rem: var(--lr-theme-size-0-625rem, 0.625rem);
    --lr-size-0-6875rem: var(--lr-theme-size-0-6875rem, 0.6875rem);
    --lr-size-0-6rem: var(--lr-theme-size-0-6rem, 0.6rem);
    --lr-size-0-75em: var(--lr-theme-size-0-75em, 0.75em);
    --lr-size-0-75rem: var(--lr-theme-size-0-75rem, 0.75rem);
    --lr-size-0-7em: var(--lr-theme-size-0-7em, 0.7em);
    --lr-size-0-875em: var(--lr-theme-size-0-875em, 0.875em);
    --lr-size-0-8rem: var(--lr-theme-size-0-8rem, 0.8rem);
    --lr-size-0-9375rem: var(--lr-theme-size-0-9375rem, 0.9375rem);
    --lr-size-1-0625rem: var(--lr-theme-size-1-0625rem, 1.0625rem);
    --lr-size-1-1rem: var(--lr-theme-size-1-1rem, 1.1rem);
    --lr-size-1-25rem: var(--lr-theme-size-1-25rem, 1.25rem);
    --lr-size-1-5em: var(--lr-theme-size-1-5em, 1.5em);
    --lr-size-1-5rem: var(--lr-theme-size-1-5rem, 1.5rem);
    --lr-size-1-75rem: var(--lr-theme-size-1-75rem, 1.75rem);
    --lr-size-1-875rem: var(--lr-theme-size-1-875rem, 1.875rem);
    --lr-size-10px: var(--lr-theme-size-10px, 10px);
    --lr-size-10rem: var(--lr-theme-size-10rem, 10rem);
    --lr-size-12em: var(--lr-theme-size-12em, 12em);
    --lr-size-12rem: var(--lr-theme-size-12rem, 12rem);
    --lr-size-14px: var(--lr-theme-size-14px, 14px);
    --lr-size-14rem: var(--lr-theme-size-14rem, 14rem);
    --lr-size-15rem: var(--lr-theme-size-15rem, 15rem);
    --lr-size-16px: var(--lr-theme-size-16px, 16px);
    --lr-size-16rem: var(--lr-theme-size-16rem, 16rem);
    --lr-size-18rem: var(--lr-theme-size-18rem, 18rem);
    --lr-size-1em: var(--lr-theme-size-1em, 1em);
    --lr-size-1px: var(--lr-theme-size-1px, 1px);
    --lr-size-1rem: var(--lr-theme-size-1rem, 1rem);
    --lr-size-2-25rem: var(--lr-theme-size-2-25rem, 2.25rem);
    --lr-size-2-5rem: var(--lr-theme-size-2-5rem, 2.5rem);
    --lr-size-2-5ch: var(--lr-theme-size-2-5ch, 2.5ch);
    --lr-size-20rem: var(--lr-theme-size-20rem, 20rem);
    --lr-size-22rem: var(--lr-theme-size-22rem, 22rem);
    --lr-size-24px: var(--lr-theme-size-24px, 24px);
    --lr-size-24rem: var(--lr-theme-size-24rem, 24rem);
    --lr-size-280px: var(--lr-theme-size-280px, 280px);
    --lr-size-28px: var(--lr-theme-size-28px, 28px);
    --lr-size-28rem: var(--lr-theme-size-28rem, 28rem);
    --lr-size-2px: var(--lr-theme-size-2px, 2px);
    --lr-size-2rem: var(--lr-theme-size-2rem, 2rem);
    --lr-size-3-5rem: var(--lr-theme-size-3-5rem, 3.5rem);
    --lr-size-30rem: var(--lr-theme-size-30rem, 30rem);
    --lr-size-32rem: var(--lr-theme-size-32rem, 32rem);
    --lr-size-36rem: var(--lr-theme-size-36rem, 36rem);
    --lr-size-38rem: var(--lr-theme-size-38rem, 38rem);
    --lr-size-3px: var(--lr-theme-size-3px, 3px);
    --lr-size-3rem: var(--lr-theme-size-3rem, 3rem);
    --lr-scroll-fade-size: var(--lr-theme-scroll-fade-size, 2rem);
    --lr-size-3ch: var(--lr-theme-size-3ch, 3ch);
    --lr-size-3-5em: var(--lr-theme-size-3-5em, 3.5em);
    --lr-size-48rem: var(--lr-theme-size-48rem, 48rem);
    --lr-size-4px: var(--lr-theme-size-4px, 4px);
    --lr-size-4rem: var(--lr-theme-size-4rem, 4rem);
    --lr-size-4ch: var(--lr-theme-size-4ch, 4ch);
    --lr-size-5em: var(--lr-theme-size-5em, 5em);
    --lr-size-5rem: var(--lr-theme-size-5rem, 5rem);
    --lr-size-6em: var(--lr-theme-size-6em, 6em);
    --lr-size-6px: var(--lr-theme-size-6px, 6px);
    --lr-size-6rem: var(--lr-theme-size-6rem, 6rem);
    --lr-size-6ch: var(--lr-theme-size-6ch, 6ch);
    --lr-size-7rem: var(--lr-theme-size-7rem, 7rem);
    --lr-size-8em: var(--lr-theme-size-8em, 8em);
    --lr-size-8rem: var(--lr-theme-size-8rem, 8rem);
    --lr-radius: var(--lr-theme-border-radius-m, 0.375rem);
    --lr-shadow: var(--lr-theme-shadow-m, 0 2px 8px rgb(0 0 0 / 0.15));
    --lr-font: var(--lr-theme-font-family-body, system-ui, sans-serif);

    /* Motion — every component that animates (popovers, gauge fill, toast)
       reads from these three instead of hand-rolling its own duration/easing,
       so the library has one consistent rhythm. -fast/-base are for discrete
       state-change transitions; -ambient is reserved for infinite looping
       "still alive" indicators (a calm ~1.8s breathing pulse, not a flicker). */
    --lr-transition-fast: var(--lr-theme-transition-fast, 120ms ease-out);
    --lr-transition-base: var(--lr-theme-transition-normal, 180ms ease-out);
    --lr-transition-ambient: var(--lr-theme-transition-slow, 1.8s ease-in-out);

    /* Disabled state — one opacity value for every disabled control,
       replacing three previously-independent hardcoded values (0.5/0.4/0.35). */
    --lr-opacity-disabled: var(--lr-theme-opacity-disabled, 0.5);

    /* Hover lift — the filter: brightness() multiplier applied to a solid
       brand/fill control on :hover, so every such hover shares one rhythm
       instead of each hardcoding its own 1.08/1.1/0.92 magic number. */
    --lr-hover-brightness: var(--lr-theme-hover-brightness, 1.08);

    /* Popover viewport clamp — the max-inline-size cap that keeps an anchored
       popover/menu from spilling past the viewport edge, shared by every
       floating surface so they clamp to one consistent width. */
    --lr-popover-viewport-clamp: var(--lr-theme-popover-viewport-clamp, 92vw);

    /* Focus ring — every :focus-visible rule in the library should reference
       these three instead of hardcoding its own width/color/offset. */
    --lr-focus-ring-width: var(--lr-theme-focus-ring-width, 2px);
    --lr-focus-ring-color: var(--lr-theme-color-focus, var(--lr-color-brand));
    --lr-focus-ring-offset: var(--lr-theme-focus-ring-offset, 2px);

    /* Minimum tappable box for an icon-only button (close/dismiss/nav
       controls). Visual icon size is unaffected; components pad out to this
       via min-inline-size/min-block-size, not by growing the glyph itself.
       Keep the resolved value at or above 24px: it backs the hit area of
       lr-date-input, lr-combobox, lr-input and lr-select, and anything smaller
       fails WCAG 2.2 SC 2.5.8 (Target Size (Minimum)). */
    --lr-icon-button-size: var(--lr-theme-icon-button-size, 2.5rem);

    font-family: var(--lr-font);
    color: var(--lr-color-text);
    box-sizing: border-box;
  }

  /* Safe-area environment variables are physical. Mirror the logical aliases
     so inline-start/end keep their meaning when direction is inherited as RTL. */
  :host(:dir(rtl)) {
    --lr-safe-area-inline-start: env(safe-area-inset-right, 0px);
    --lr-safe-area-inline-end: env(safe-area-inset-left, 0px);
  }

  /* Standalone (no consumer theme set) dark-mode fallback. A real --lr-theme-* value
     set by a consumer always wins — this only changes what a bare
     lyra-ui component renders when dropped, unstyled, onto a dark host page
     (previously zero dark-mode adaptation existed in the pure-fallback
     case). */
  @media (prefers-color-scheme: dark) {
    :host {
      --lr-color-surface: var(--lr-theme-color-surface-default, #1a1a1a);
      --lr-color-surface-raised: var(--lr-theme-color-surface-raised, #22272e);
      --lr-color-text: var(--lr-theme-color-text-normal, #f2f2f2);
      --lr-color-text-quiet: var(--lr-theme-color-text-quiet, #9aa1ac);
      --lr-color-border: var(--lr-theme-color-surface-border, #6b6b74);
      --lr-color-border-strong: var(--lr-theme-color-border-strong, #c4c9d1);
      --lr-color-brand: var(--lr-theme-color-brand-fill-loud, #4ea0f0);
      --lr-color-brand-quiet: var(--lr-theme-color-brand-fill-quiet, #163650);
      --lr-color-success: var(--lr-theme-color-success-fill-loud, #3fb950);
      --lr-color-success-quiet: var(--lr-theme-color-success-fill-quiet, #17411e);
      --lr-color-warning: var(--lr-theme-color-warning-fill-loud, #d29922);
      --lr-color-warning-quiet: var(--lr-theme-color-warning-fill-quiet, #3b2900);
      --lr-color-danger: var(--lr-theme-color-danger-fill-loud, #fa524a);
      --lr-color-danger-quiet: var(--lr-theme-color-danger-fill-quiet, #4c1210);
      --lr-color-neutral: var(--lr-theme-color-neutral-fill-loud, #e5e7eb);
      --lr-color-on-brand: var(--lr-theme-color-brand-on-loud, #111827);
      --lr-color-on-success: var(--lr-theme-color-success-on-loud, #111827);
      --lr-color-on-warning: var(--lr-theme-color-warning-on-loud, #111827);
      --lr-color-on-danger: var(--lr-theme-color-danger-on-loud, #111827);
      --lr-color-on-neutral: var(--lr-theme-color-neutral-on-loud, #111827);
      --lr-color-chart-1: var(--lr-theme-color-chart-1, #b58cff);
      --lr-color-chart-2: var(--lr-theme-color-chart-2, #ff7ab2);
      --lr-color-chart-3: var(--lr-theme-color-chart-3, #4fd1c5);
      --lr-color-chart-4: var(--lr-theme-color-chart-4, #aab4c4);
      --lr-color-chart-5: var(--lr-theme-color-chart-5, #d4a7ff);
      --lr-color-chart-6: var(--lr-theme-color-chart-6, #ff91c8);
      --lr-color-chart-7: var(--lr-theme-color-chart-7, #79e2ef);
      --lr-color-chart-8: var(--lr-theme-color-chart-8, #e4e7eb);
      --lr-graph-cat-1: var(--lr-theme-graph-cat-1, #b58cff);
      --lr-graph-cat-2: var(--lr-theme-graph-cat-2, #ff7ab2);
      --lr-graph-cat-3: var(--lr-theme-graph-cat-3, #4fd1c5);
      --lr-graph-cat-4: var(--lr-theme-graph-cat-4, #aab4c4);
      --lr-graph-cat-5: var(--lr-theme-graph-cat-5, #d4a7ff);
      --lr-graph-cat-6: var(--lr-theme-graph-cat-6, #ff91c8);
      --lr-graph-cat-7: var(--lr-theme-graph-cat-7, #79e2ef);
      --lr-graph-cat-8: var(--lr-theme-graph-cat-8, #e4e7eb);
    }
  }

  /* Reduced motion is centralized so components using either the shared
     transition tokens or a component animation get the same behavior. The
     tiny non-zero duration keeps animationend/transitionend contracts from
     becoming engine-dependent while making the visual movement imperceptible. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --lr-transition-fast: 0.001ms linear;
      --lr-transition-base: 0.001ms linear;
      --lr-transition-ambient: 0.001ms linear;
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
      --lr-color-surface: Canvas;
      --lr-color-surface-raised: Canvas;
      --lr-color-text: CanvasText;
      --lr-color-text-quiet: CanvasText;
      --lr-color-border: ButtonText;
      --lr-color-brand: LinkText;
      --lr-color-brand-quiet: Canvas;
      --lr-color-success: LinkText;
      --lr-color-success-quiet: Canvas;
      --lr-color-warning: CanvasText;
      --lr-color-warning-quiet: Canvas;
      --lr-color-danger: LinkText;
      --lr-color-danger-quiet: Canvas;
      --lr-color-neutral: ButtonText;
      --lr-color-on-brand: Canvas;
      --lr-color-on-success: Canvas;
      --lr-color-on-warning: Canvas;
      --lr-color-on-danger: Canvas;
      --lr-color-on-neutral: Canvas;
      --lr-color-chart-1: Highlight;
      --lr-color-chart-2: LinkText;
      --lr-color-chart-3: CanvasText;
      --lr-color-chart-4: Highlight;
      --lr-color-chart-5: LinkText;
      --lr-color-chart-6: CanvasText;
      --lr-color-chart-7: Highlight;
      --lr-color-chart-8: LinkText;
      --lr-graph-cat-1: Highlight;
      --lr-graph-cat-2: LinkText;
      --lr-graph-cat-3: CanvasText;
      --lr-graph-cat-4: Highlight;
      --lr-graph-cat-5: LinkText;
      --lr-graph-cat-6: CanvasText;
      --lr-graph-cat-7: Highlight;
      --lr-graph-cat-8: LinkText;
      --lr-focus-ring-color: Highlight;
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
