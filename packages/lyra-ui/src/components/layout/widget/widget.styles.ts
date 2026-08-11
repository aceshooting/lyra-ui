import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    /* Fullscreen scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through). */
    --lr-widget-overlay-color: var(--lr-color-overlay);
    --lr-widget-fullscreen-inset: max(
        var(--lr-space-l),
        var(--lr-safe-area-top)
      )
      max(var(--lr-space-l), var(--lr-safe-area-inline-end))
      max(var(--lr-space-l), var(--lr-safe-area-bottom))
      max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    --lr-widget-backdrop-inset: var(--lr-widget-fullscreen-inset);
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  :host(:not([fullscreen])) [part="base"] {
    block-size: 100%;
    min-block-size: 0;
  }
  [part="header"] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="title"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part="icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  [part="icon"][hidden] {
    display: none;
  }
  [part="label-group"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part="label"],
  [part="sublabel"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="label"] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="sublabel"] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="label"][hidden],
  [part="sublabel"][hidden] {
    display: none;
  }
  [part="actions"] {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-xs);
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part="actions"][hidden] {
    display: none;
  }
  [part="view-toggles"] {
    display: flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part="view-toggle"] {
    display: inline-flex;
    flex: 0 1 auto;
    align-items: center;
    /* Both axes, matching collapse-button/fullscreen-button. Cross-axis centering alone left an
       icon-only toggle visibly off-center: min-inline-size floors the pill at the square
       icon-button size, so a 13px glyph inside a 40px pill has ~11px of slack that the default
       justify-content (normal => flex-start) dumps entirely on the trailing side -- 4.5px off
       true center once the asymmetric inline padding is counted. A labeled toggle is unaffected
       (its content already fills the pill, which sizes to fit). */
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
  }
  [part="view-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
  }
  [part="view-label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* :where() zeroes the wrapped selector's specificity contribution, leaving only :hover itself,
     mirroring lr-pagination's/lr-table's identical remediation for this exact selector shape --
     a consumer's own ::part(view-toggle):hover can win without !important. Colors route through
     scoped --lr-widget-view-toggle-hover-*, mirroring the [aria-pressed='true'] rule below, so a
     consumer can retint just the hover state without hijacking the shared brand-quiet/text tokens
     used everywhere else. */
  :where([part="view-toggle"]):hover {
    background: var(--lr-widget-view-toggle-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-widget-view-toggle-hover-color, var(--lr-color-text));
  }
  /* Whatever fill hover resolved to -- including a consumer's own
     --lr-widget-view-toggle-hover-bg -- mixed further toward --lr-color-mix-partner, so a retinted
     hover keeps a pressed step that is deeper than it rather than one pinned to the stock token.
     Same zeroed specificity as the hover rule above, for the same reason. */
  :where([part="view-toggle"]):active {
    background: color-mix(
      in oklab,
      var(--lr-widget-view-toggle-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-widget-view-toggle-hover-color, var(--lr-color-text));
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor without a :host declaration shadowing that. ::part(view-toggle)[aria-pressed='true'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the pressed toggle used
     to require hijacking the shared --lr-color-brand-quiet/--lr-color-brand tokens, repainting
     everything else that reads them. Unset, each falls back to the token the rule used before, so
     the rendering is unchanged. */
  [part="view-toggle"][aria-pressed="true"] {
    background: var(
      --lr-widget-view-toggle-active-bg,
      var(--lr-color-brand-quiet)
    );
    color: var(--lr-widget-view-toggle-active-color, var(--lr-color-brand));
    border-color: transparent;
  }
  [part="view-toggle"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="collapse-button"],
  [part="fullscreen-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
    transition: transform var(--lr-transition-fast);
  }
  [part="collapse-button"]:hover,
  [part="fullscreen-button"]:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part="collapse-button"]:active,
  [part="fullscreen-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-brand);
  }
  [part="collapse-button"]:focus-visible,
  [part="fullscreen-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Chevron points at the content: rotated (pointing down) while expanded, resting (pointing right)
     while collapsed -- same convention as lr-code-block's/lr-json-viewer's own toggles. */
  :host(:not([collapsed])) [part="collapse-button"] {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left -- the conventional mirrored
     disclosure-triangle direction for RTL. Scoped to [collapsed] specifically (rather than a plain
     :dir(rtl) rule) so it never competes with the rule above for the expanded state, which needs no
     mirroring: rotating this left-right-asymmetric glyph 90deg already produces a symmetric chevron. */
  :host([collapsed]:dir(rtl)) [part="collapse-button"] {
    transform: scaleX(-1);
  }
  [part="body"] {
    padding: var(--lr-space-m);
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part="body"][hidden] {
    display: none;
  }
  [part="backdrop"] {
    position: fixed;
    inset: var(--lr-widget-backdrop-inset, 0);
    background: var(--lr-widget-overlay-color);
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
  }
  :host([fullscreen]) [part="base"] {
    position: fixed;
    inset: var(--lr-widget-fullscreen-inset, 0);
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 1);
    /* Top of the scale: fullscreen is a modal layer sitting above [part="backdrop"], and it is the
       only state in which this widget stops being resting chrome. */
    box-shadow: var(--lr-shadow-xl);
  }
  :host([fullscreen]) [part="body"] {
    overflow: auto;
    block-size: 100%;
  }
  :host([compact]) [part="header"] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    gap: var(--lr-space-xs);
  }
  :host([compact]) [part="body"] {
    padding: var(--lr-space-s);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="collapse-button"],
    [part="fullscreen-button"] {
      transition: none !important;
    }
  }
`;
