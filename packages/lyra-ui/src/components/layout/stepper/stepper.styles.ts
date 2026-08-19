import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="base"] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-m);
    /* overflow-y is paired explicitly (never left implicit) alongside every overflow-x here and
       below: per the CSS overflow spec, pinning one axis to a non-'visible' value forces the
       other axis's *used* value to 'auto' too if left unset -- which can paint a thin, empty
       phantom scrollbar on a classic (non-overlay) scrollbar platform even when the steps
       actually fit (the exact bug already found and fixed once on lr-tab-group). The mask-image edge
       fade mirrors lr-tab-group'/lr-segmented's identical horizontally-scrolling-row treatment; it now
       lives in its own overflow-gated rule below, and is reset to 'none' in the vertical-axis
       rules so it can never bleed through a higher-specificity match that doesn't also redeclare
       it (CSS cascades per-property, not per-rule). */
    overflow-x: auto;
    overflow-y: hidden;
  }
  /* Edge fade, gated on the track actually overflowing -- ScrollOverflowController toggles
     data-scroll-overflow from a real scrollWidth/clientWidth measurement. Unconditional (as this
     used to be) it fades the first and last step of a stepper that fits. The vertical-axis rules
     below still reset it to 'none' at higher specificity, so it cannot bleed into that axis even
     if a visible-overflow measurement happens to trip the attribute. One-sided and RTL-aware,
     matching lr-tab-group/lr-segmented: data-scroll-start/data-scroll-end (also from
     ScrollOverflowController, logical and live-updated on scroll) report which edge(s) genuinely
     still have more to reach, so a track scrolled fully to one edge fades only the other -- a
     track resting at its start no longer dims that already-fully-visible start edge.
     data-scroll-start/data-scroll-end are wrapped in :where() purely to keep these rules'
     specificity pinned to the same [data-scroll-overflow]-only baseline as before -- so the later
     forced-colors override (same base selectors, later in the stylesheet) still wins its tie by
     source order rather than losing to these more-specific-looking selectors. */
  [part="base"][data-scroll-overflow]:where([data-scroll-start][data-scroll-end]) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl))
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl))
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="step-item"] {
    display: contents;
  }
  :host([orientation="vertical"]) [part="base"] {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  /* orientationBreakpoint's live axis -- only present while that feature is opted into (see
     stepper.ts's updateEffectiveOrientation()), so it can override the authored orientation rules
     above by source order alone (equal specificity) whenever the effective axis diverges from it. */
  :host([data-effective-orientation="vertical"]) [part="base"] {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  :host([data-effective-orientation="horizontal"]) [part="base"] {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-mask-image: none;
    mask-image: none;
  }
  /* Same overflow gate as the authored-horizontal rules above, restated at this rule's specificity
     so the live-axis override re-applies the fade rather than being pinned to the 'none' it must
     otherwise declare (it has to redeclare the property: the vertical arm it competes with sets
     it, and CSS cascades per-property). data-scroll-start/data-scroll-end are :where()-wrapped for
     the same reason as the authored-horizontal rules above -- keeps specificity pinned to this
     rule's own [data-scroll-overflow]-only baseline so the forced-colors override below still wins. */
  :host([data-effective-orientation="horizontal"])
    [part="base"][data-scroll-overflow]:where([data-scroll-start][data-scroll-end]) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  :host([data-effective-orientation="horizontal"])
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  :host([data-effective-orientation="horizontal"])
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)[data-effective-orientation="horizontal"])
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)[data-effective-orientation="horizontal"])
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="step"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
    padding: var(--lr-space-2xs);
    border-radius: var(--lr-radius);
  }
  [part="step"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, so a consumer's own ::part(step):hover override ((0,1,1)) always wins
     without needing !important (mirrors lr-attachment-trigger's identical fix). */
  :where([part="step"]):hover:where(:not([aria-disabled="true"])) {
    background: var(--lr-stepper-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-stepper-hover-color, var(--lr-color-text));
  }
  /* The same brand-quiet fill, mixed further toward --lr-color-mix-partner: a step being pressed
     is a visible tier past the one the pointer is only resting on. Same :not() guard and the same
     zeroed specificity as the hover rule above. */
  :where([part="step"]):active:where(:not([aria-disabled="true"])) {
    background: var(
      --lr-stepper-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-stepper-active-color, var(--lr-color-text));
  }
  [part="step"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor without a :host declaration shadowing that. ::part(step)[data-state='current'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the current/error state
     used to require hijacking the shared --lr-color-text/--lr-color-danger/--lr-color-brand tokens,
     which repainted everything else that reads them. Unset, each falls back to the token the rule
     used before, so the rendering is unchanged. */
  [part="step"][data-state="current"] {
    color: var(--lr-stepper-current-color, var(--lr-color-text));
    font-weight: var(
      --lr-stepper-current-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  [part="step"][data-state="error"] {
    color: var(--lr-stepper-error-color, var(--lr-color-danger));
  }
  /* Rendered additionally to, never instead of, step-index/step-check below -- [part="step"]'s
     own gap already spaces it from whichever of those follows, so no margin of its own is
     needed (mirrors lr-segmented's segment-icon, minus its margin-inline-end, which compensates
     for lr-segmented's [part="segment"] having no gap of its own). */
  [part="step-icon"] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    block-size: var(--lr-size-1em);
    max-inline-size: var(--lr-size-2-5rem);
  }
  [part="step-index"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    flex: 0 0 auto;
  }
  [part="step"][data-state="current"] [part="step-index"] {
    background: var(--lr-stepper-current-index-bg, var(--lr-color-brand));
    color: var(--lr-stepper-current-index-color, var(--lr-color-on-brand));
  }
  [part="step-check"] {
    color: var(--lr-color-success);
    flex: 0 0 auto;
  }
  [part="step-label"] {
    white-space: nowrap;
  }
  :host([wrap-labels][orientation="vertical"]) [part="step-label"],
  :host([wrap-labels][data-effective-orientation="vertical"])
    [part="step-label"] {
    min-inline-size: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  /* An active breakpoint can temporarily make an authored vertical stepper horizontal. Keep the
     opt-in vertical-only, and let the later effective-axis rule win over the authored-axis rule. */
  :host([wrap-labels][data-effective-orientation="horizontal"])
    [part="step-label"] {
    min-inline-size: auto;
    white-space: nowrap;
    overflow-wrap: normal;
  }
  @media (forced-colors: active) {
    [part="base"],
    [part="base"][data-scroll-overflow],
    :host(:dir(rtl)) [part="base"][data-scroll-overflow],
    :host([data-effective-orientation="horizontal"])
      [part="base"][data-scroll-overflow],
    :host(:dir(rtl)[data-effective-orientation="horizontal"])
      [part="base"][data-scroll-overflow] {
      -webkit-mask-image: none;
      mask-image: none;
    }
  }
`;
