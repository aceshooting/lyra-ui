import { css } from 'lit';

// Component styles consume centralized --lr-* tokens. Themeable base tokens read supported
// --lr-theme-* inputs with built-in fallbacks; aliases, computed tokens, colour ramps,
// environment-backed values, and fixed contract constants may instead resolve within the
// internal layer. Consumers retheme through the catalogued --lr-theme-* inputs at any ancestor,
// while every component still renders sensibly with zero configuration.
//
// MASK_OPAQUE -- why --lr-mask-opaque is deliberately fixed instead of themeable.
// Every mask in the library used to borrow --lr-color-shadow for its fully-opaque stop. A mask
// reads alpha only, so an entirely reasonable translucent shadow theme
// (--lr-theme-color-shadow: rgb(0 0 0 / 0.25)) silently dropped mask alpha across the WHOLE
// element rather than just its edges, rendering lr-segmented / lr-tab-group / lr-stepper /
// lr-timeline / lr-document-preview uniformly washed out, with nothing pointing back at the
// shadow token as the cause. That only ever worked because the shadow default happens to be
// opaque. "Opaque" is not a design decision a consumer tunes -- a mask's opaque stop must be
// opaque by definition -- so giving this its own --lr-theme-* hook would just reintroduce the
// same footgun under a new name. The colour channel is irrelevant; only alpha 1 matters.
//
// REQUIRED_MARKER -- why --lr-form-control-required-content/-color/-offset are NOT declared here.
// The required-field marker every labelled form control renders (internal/form-control.styles.ts,
// restated by known-date.styles.ts for its composite label) reads those three names as inline
// var() fallbacks and NOTHING declares them. That is the design, not an omission: an undeclared
// custom property inherits, so one declaration on :root retunes every marker in the application
// at once, which is exactly how llms/forms.md documents them. Adding the usual
// `--lr-x: var(--lr-theme-x, default);` line to :host below would take that away -- the host's own
// declaration wins over the inherited value, so a :root (or any ancestor) setting would stop
// reaching the marker, leaving only per-element inline styles working. Measured, not reasoned:
// with the :host line present, an ancestor's --lr-form-control-required-color resolves to the
// danger default instead of the ancestor's colour; without it, the ancestor's colour reaches the
// ::after. Nothing in the test suite covers the ancestor route, so the regression would be silent.
// If these ever do need a --lr-theme-* input, give the call sites a three-deep chain
// (var(--lr-form-control-required-x, var(--lr-theme-form-control-required-x, default))) the way
// contextual-vocabulary.styles.ts chains --lr-form-control-height-*; do not declare them on :host.
//
// Note this prose lives OUTSIDE the css`` literal on purpose: the build is plain tsc, so the
// template's contents ship verbatim to every component that pulls in the token sheet -- i.e.
// all of them. A comment this long inside it pushed the button bundle over its gzip budget.
const baseTokens = css`
  :host {
    --lr-color-surface: var(--lr-theme-color-surface-default, #fff);
    --lr-color-surface-raised: var(--lr-theme-color-surface-raised, #f6f8fa);
    --lr-color-text: var(--lr-theme-color-text-normal, #1a1a1a);
    --lr-color-text-quiet: var(--lr-theme-color-text-quiet, #6b7280);
    --lr-color-border: var(--lr-theme-color-surface-border, #8a8a90);
    --lr-color-border-strong: var(--lr-theme-color-border-strong, #4b5563);
    --lr-color-brand: var(--lr-color-brand-fill-loud);
    --lr-color-brand-quiet: var(--lr-color-brand-fill-quiet);
    --lr-color-success: var(--lr-color-success-fill-loud);
    --lr-color-success-quiet: var(--lr-color-success-fill-quiet);
    --lr-color-warning: var(--lr-color-warning-fill-loud);
    --lr-color-warning-quiet: var(--lr-color-warning-fill-quiet);
    --lr-color-danger: var(--lr-color-danger-fill-loud);
    --lr-color-danger-quiet: var(--lr-color-danger-fill-quiet);
    /* A solid, high-contrast neutral fill -- distinct from --lr-color-surface (which is the
       ambient page/panel background, not a "loud" accent) and from --lr-color-text (used as a
       plain-text/outline accent, not a fill). Backs lr-button's appearance="accent" tier for
       variant="neutral", the one variant whose other tokens all resolve to ambient/plain values. */
    --lr-color-neutral: var(--lr-color-neutral-fill-loud);
    /* Text/icon colors paired with each solid semantic fill. These are
       separate tokens because a theme can choose different foregrounds per
       tone, and the bright standalone dark fills require dark content. */
    --lr-color-on-brand: var(--lr-color-brand-on-loud);
    --lr-color-on-success: var(--lr-color-success-on-loud);
    --lr-color-on-warning: var(--lr-color-warning-on-loud);
    --lr-color-on-danger: var(--lr-color-danger-on-loud);
    --lr-color-on-neutral: var(--lr-color-neutral-on-loud);
    /* Foreground for controls and captions painted over the strong media scrim. It is independent
       from ordinary text and semantic-tone foregrounds because the underlying surface is always
       the strong overlay, regardless of the page theme. */
    --lr-color-on-strong-overlay: var(--lr-theme-color-on-strong-overlay, #fff);
    /* The surface a modal panel (dialog, drawer, lightbox, command palette) paints itself with.
       Separate from --lr-color-surface because in dark mode a panel that shares the page surface
       token is invisible against the page; light mode keeps the page surface as its default. */
    --lr-color-surface-overlay: var(--lr-theme-color-surface-overlay, var(--lr-color-surface));
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
    --lr-font-size-3xs: var(--lr-theme-font-size-3xs, 0.5rem);
    --lr-font-size-2xs: var(--lr-theme-font-size-2xs, 0.625rem);
    --lr-font-size-xs: var(--lr-theme-font-size-xs, 0.75rem);
    --lr-font-size-sm: var(--lr-theme-font-size-sm, 0.8125rem);
    --lr-font-size-m: var(--lr-theme-font-size-m, 1rem);
    --lr-font-size-md-sm: var(--lr-theme-font-size-md-sm, 0.875rem);
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
    /* Opaque stop for mask gradients; see MASK_OPAQUE note above. */
    --lr-mask-opaque: #000;
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
    /* Elevation. One shadow token used to serve 39 stylesheets, so a tooltip, a slider thumb and a
       full-screen dialog all cast the same shadow -- elevation carried no information at all. Five
       steps now, with the shadow COLOUR itself tokenized: it used to be a baked-in
       rgb(0 0 0 / 0.15), which is invisible against a dark surface, so dark mode effectively had no
       elevation. --lr-shadow stays as the mid step, so every existing use keeps rendering. */
    --lr-shadow-color: var(--lr-theme-shadow-color, 0 0 0);
    --lr-shadow-xs: var(--lr-theme-shadow-xs, 0 1px 2px rgb(var(--lr-shadow-color) / 0.12));
    --lr-shadow-s: var(--lr-theme-shadow-s, 0 1px 4px rgb(var(--lr-shadow-color) / 0.14));
    --lr-shadow-m: var(--lr-theme-shadow-m, 0 2px 8px rgb(var(--lr-shadow-color) / 0.15));
    --lr-shadow-l: var(--lr-theme-shadow-l, 0 6px 16px rgb(var(--lr-shadow-color) / 0.18));
    --lr-shadow-xl: var(--lr-theme-shadow-xl, 0 12px 32px rgb(var(--lr-shadow-color) / 0.22));
    --lr-shadow: var(--lr-shadow-m);
    --lr-font: var(--lr-theme-font-family-body, system-ui, sans-serif);

    /* Motion — every component that animates (popovers, gauge fill, toast)
       reads from these instead of hand-rolling its own duration/easing, so the
       library has one consistent rhythm. -fast/-base are for discrete
       state-change transitions; -ambient is reserved for infinite looping
       "still alive" indicators (a calm ~1.8s breathing pulse, not a flicker).

       Duration and easing are SEPARATE axes. They used to be fused into one
       value, which reads fine in a transition: shorthand but is unusable in an
       animation: shorthand that names its own timing function -- the expansion
       carries two timing functions, which is invalid, so the browser drops the
       whole declaration and the animation silently never runs. Four component
       stylesheets shipped exactly that. Reach for a --lr-duration-x plus a
       --lr-easing-x in an animation:; the compound tokens below remain for
       transition:. */
    --lr-duration-fast: var(--lr-theme-duration-fast, 120ms);
    --lr-duration-base: var(--lr-theme-duration-normal, 180ms);
    --lr-duration-ambient: var(--lr-theme-duration-slow, 1.8s);
    --lr-duration-icon: var(--lr-theme-duration-icon, 1s);
    --lr-otp-input-segment-size: var(--lr-theme-otp-input-segment-size, 2.5em);
    --lr-easing-standard: var(--lr-theme-easing-standard, ease-out);
    --lr-easing-emphasized: var(--lr-theme-easing-emphasized, ease-in-out);
    --lr-easing-linear: var(--lr-theme-easing-linear, linear);

    /* Derived, so a consumer retheming either axis gets both. The legacy
       --lr-theme-transition-* inputs still win when set, so an existing theme
       keeps working unchanged. */
    --lr-transition-fast: var(--lr-theme-transition-fast, var(--lr-duration-fast) var(--lr-easing-standard));
    --lr-transition-base: var(--lr-theme-transition-normal, var(--lr-duration-base) var(--lr-easing-standard));
    --lr-transition-ambient: var(--lr-theme-transition-slow, var(--lr-duration-ambient) var(--lr-easing-emphasized));

    /* Disabled state — one opacity value for every disabled control,
       replacing three previously-independent hardcoded values (0.5/0.4/0.35). */
    --lr-opacity-disabled: var(--lr-theme-opacity-disabled, 0.5);

    /* De-emphasis that is NOT disablement: still-live content the eye should reach second
       (a streaming part not yet settled, a secondary metadata row). Deliberately far milder than
       --lr-opacity-disabled, because this text still has to clear WCAG 1.4.3 contrast against the
       surface — a disabled control does not, and borrowing that value here failed an axe check. */
    --lr-opacity-muted: var(--lr-theme-opacity-muted, 0.85);

    /* Interaction states are a COLOUR MIX, not a brightness filter.
       filter: brightness() multiplies every channel, which means it lightens a dark control and
       darkens a light one only by coincidence, does nothing whatsoever to a pure white or pure
       black fill, and -- because filter applies to the element and its descendants -- shifts the
       control's TEXT and ICONS along with its background. Mixing toward a partner colour has none
       of those properties: it is defined on the fill alone, it always moves, and it moves in the
       direction the surface actually needs.

       The two knobs are percentages, so a theme can flatten or exaggerate every interaction in the
       library at once without touching a component. */
    --lr-color-mix-hover: var(--lr-theme-color-mix-hover, 12%);
    --lr-color-mix-active: var(--lr-theme-color-mix-active, 22%);
    /* What each state mixes TOWARD. Following the text colour makes the direction automatic: on a
       light surface the text is dark, so a hover darkens; on a dark surface it is light, so the
       same declaration lightens. That is the property filter: brightness() never had. */
    --lr-color-mix-partner: var(--lr-theme-color-mix-partner, var(--lr-color-text));

    /* Superseded by the two mix knobs above and retained only so a theme that set it keeps
       rendering; no component reads it. Remove it once no consumer does. */
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
`;

/**
 * Standalone (no consumer theme set) dark-mode values. A real --lr-theme-* value set by a consumer
 * always wins -- these only change what a bare lyra-ui component renders when dropped, unstyled,
 * onto a dark host page.
 *
 * Declared ONCE and composed into all three dark selectors below, because the three routes into
 * dark mode (OS preference, `data-lr-theme="dark"` on the component, a `.lr-dark` /
 * `data-lr-theme="dark"` ancestor) must agree to the byte. The semantic grid in
 * `tokens/palette.styles.ts` already answers to all three; while this layer answered only to the
 * OS one, `<lr-card data-lr-theme="dark">` on a light machine rendered a dark colour grid on light
 * surfaces -- a mixed state neither mode was ever contrast-checked in.
 *
 * The three selectors that consume it, and why they are three separate rules:
 *
 *   @media (prefers-color-scheme: dark) :host(:not([data-lr-theme='light']))
 *                          the OS preference, with an explicit light override winning over it.
 *   :host([data-lr-theme='dark'])
 *                          the attribute an application sets to pin a mode regardless of the OS.
 *   :host(:not([data-lr-theme='light'])):host-context(.lr-dark | [data-lr-theme='dark'])
 *                          a dark ancestor, for a consumer who never imported theme.css. Kept out
 *                          of the previous rule's selector list on purpose: Firefox and Safari
 *                          ship no :host-context(), and one unsupported selector invalidates a
 *                          whole list -- which would take the supported attribute branch down with
 *                          it. Those engines still follow an ancestor .lr-dark through theme.css,
 *                          whose custom properties inherit across the shadow boundary. The light
 *                          guard has to be written as its own :host() pseudo: a bare
 *                          :not([data-lr-theme='light']) appended to :host-context() matches
 *                          nothing at all, because the shadow host is featureless.
 *
 * Placement note: `scripts/check-contrast.mjs` and `scripts/generate-chart-palette.mjs` split this
 * file at the first occurrence of the string `@media (prefers-color-scheme: dark)` and read
 * everything after it as the dark set. The media rule that consumes this fragment is composed
 * further down, so the marker is repeated on the line below to keep that split honest. Nothing
 * light-mode may be declared past this point.
 */
/* @media (prefers-color-scheme: dark) */
const darkTokens = css`
      --lr-color-surface: var(--lr-theme-color-surface-default, #1a1a1a);
      --lr-color-surface-raised: var(--lr-theme-color-surface-raised, #22272e);
      --lr-color-text: var(--lr-theme-color-text-normal, #f2f2f2);
      --lr-color-text-quiet: var(--lr-theme-color-text-quiet, #9aa1ac);
      --lr-color-border: var(--lr-theme-color-surface-border, #6b6b74);
      --lr-color-border-strong: var(--lr-theme-color-border-strong, #c4c9d1);
      /* A modal panel cannot share the page surface token in dark mode: both resolve to the same
         near-black, so an open dialog reads as a scrim with text floating on it and no panel at
         all. Light mode keeps the page surface deliberately -- a white dialog on a white page is
         separated by the scrim around it, and changing it would be churn for no legibility gain. */
      --lr-color-surface-overlay: var(--lr-theme-color-surface-overlay, #2b3038);
      /* A 50% black scrim over an already-dark page barely darkens it, so the modal/non-modal
         boundary the scrim exists to draw disappears. Both scrims go heavier in dark mode. */
      --lr-color-overlay: var(--lr-theme-color-overlay, rgb(0 0 0 / 0.72));
      --lr-color-overlay-strong: var(--lr-theme-color-overlay-strong, var(--lr-theme-color-overlay, rgb(0 0 0 / 0.95)));
      /* Elevation is a luminance difference, and a 12%-alpha black shadow against a near-black
         surface is not one -- dark mode shipped with no elevation at all. The alphas roughly
         triple so each step stays a visible step. */
      --lr-shadow-xs: var(--lr-theme-shadow-xs, 0 1px 2px rgb(var(--lr-shadow-color) / 0.34));
      --lr-shadow-s: var(--lr-theme-shadow-s, 0 1px 4px rgb(var(--lr-shadow-color) / 0.4));
      --lr-shadow-m: var(--lr-theme-shadow-m, 0 2px 8px rgb(var(--lr-shadow-color) / 0.46));
      --lr-shadow-l: var(--lr-theme-shadow-l, 0 8px 20px rgb(var(--lr-shadow-color) / 0.56));
      --lr-shadow-xl: var(--lr-theme-shadow-xl, 0 16px 40px rgb(var(--lr-shadow-color) / 0.66));
`;

const auxTokens = css`
  /* Reduced motion is centralized so components using either the shared
     transition tokens or a component animation get the same behavior. The
     tiny non-zero duration keeps animationend/transitionend contracts from
     becoming engine-dependent while making the visual movement imperceptible. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --lr-duration-fast: 0.001ms;
      --lr-duration-base: 0.001ms;
      --lr-duration-ambient: 0.001ms;
      --lr-duration-icon: 0.001ms;
      --lr-easing-standard: linear;
      --lr-easing-emphasized: linear;
      /* Overridden too, so a theme that sets the legacy compound inputs directly is still
         flattened rather than keeping its full-length duration. */
      --lr-transition-fast: 0.001ms linear;
      --lr-transition-base: 0.001ms linear;
      --lr-transition-ambient: 0.001ms linear;
    }
    /* Deliberately NOT !important. It used to be, which meant no consumer could override it and
       no component could opt out -- including the rare case where motion *is* the information (a
       progress indicator's only affordance). Zeroing the duration tokens above already flattens
       every component that reads them, which is all of them; this blanket rule is the safety net
       for a stray hardcoded duration, and a safety net should not outrank the author. */
    :host *,
    :host *::before,
    :host *::after {
      animation-duration: 0.001ms;
      animation-iteration-count: 1;
      transition-duration: 0.001ms;
      scroll-behavior: auto;
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

/**
 * System colors keep custom controls, SVG marks, and canvas-adjacent chrome legible when the user
 * agent replaces the normal palette. Component CSS and drawing code consume these semantic tokens,
 * so the same mode applies to DOM and non-DOM visuals -- and the non-DOM half is why this cannot
 * be left to the user agent's own forced-colour substitution: canvas and SVG painting resolve
 * these tokens through getComputedStyle and draw exactly what they say.
 *
 * Declared ONCE and composed into selectors that mirror every dark route below, for the same
 * reason darkTokens is: a Windows High Contrast *dark* theme also reports
 * prefers-color-scheme: dark, so the ordinary HCM case is forced colors AND dark at once. Written
 * as a bare :host (specificity 0-1-0) this block is outranked by every dark selector -- 0-2-0 for
 * the media and attribute routes, more again for the :host-context() one -- so the whole
 * system-colour fallback was present in the sheet and dead in the cascade wherever it mattered
 * most. Mirroring the selectors keeps the win on source order at EQUAL specificity, per route,
 * without lowering the dark rules' specificity (which would change what beats them everywhere
 * else) and without !important.
 *
 * Placement note, mirroring the one on darkTokens: `scripts/generate-design-tokens.mjs` splits this
 * file at `const auxTokens` and at the first `@media (forced-colors: active)` after it, reading the
 * span between them as the reduced-motion set and everything past it as the forced-colours one. The
 * rule that consumes this fragment is composed further down, so the marker is repeated on the line
 * below to keep that split honest.
 */
/* @media (forced-colors: active) */
const forcedColorTokens = css`
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
      --lr-color-on-strong-overlay: CanvasText;
      --lr-focus-ring-color: Highlight;
`;

export const tokens = css`
  ${baseTokens}

  @media (prefers-color-scheme: dark) {
    :host(:not([data-lr-theme='light'])) {${darkTokens}
    }
  }
  :host([data-lr-theme='dark']) {${darkTokens}
  }
  :host(:not([data-lr-theme='light'])):host-context(.lr-dark),
  :host(:not([data-lr-theme='light'])):host-context([data-lr-theme='dark']) {${darkTokens}
  }

  ${auxTokens}

  /* Last, and selector-for-selector against each dark rule above: at equal specificity the later
     declaration wins, so system colours hold in every theme state. The :host-context() pair stays
     a separate rule because Firefox and Safari ship no :host-context() and one unsupported
     selector invalidates a whole list -- which would take the supported branches down with it. */
  @media (forced-colors: active) {
    :host,
    :host(:not([data-lr-theme='light'])),
    :host([data-lr-theme='dark']) {${forcedColorTokens}
    }
    :host(:not([data-lr-theme='light'])):host-context(.lr-dark),
    :host(:not([data-lr-theme='light'])):host-context([data-lr-theme='dark']) {${forcedColorTokens}
    }
  }
`;
