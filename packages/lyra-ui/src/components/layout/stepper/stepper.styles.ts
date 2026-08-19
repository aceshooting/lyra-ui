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
    /* overflow-y is paired explicitly with every overflow-x here and below: per the CSS overflow
       spec, pinning one axis to a non-'visible' value forces the other axis's used value to 'auto'
       when unset, painting a phantom scrollbar on classic (non-overlay) scrollbar platforms even
       when the steps fit -- the bug already fixed on lr-tab-group. The mask-image edge fade
       mirrors lr-tab-group/lr-segmented, lives in its own overflow-gated rule below, and is reset
       to 'none' in the vertical-axis rules so it cannot bleed through a higher-specificity match
       that does not redeclare it (CSS cascades per-property). */
    overflow-x: auto;
    overflow-y: hidden;
  }
  /* Edge fade, gated on real overflow: ScrollOverflowController sets data-scroll-overflow from a
     scrollWidth/clientWidth measurement; unconditional, it faded a stepper that fits. The
     vertical-axis rules below reset it to 'none' at higher specificity, so it cannot bleed into
     that axis. One-sided and RTL-aware, matching lr-tab-group/lr-segmented:
     data-scroll-start/data-scroll-end (same controller, logical, live on scroll) mark the edges
     with more to reach, so a fully-scrolled edge is not faded. Both are :where()-wrapped to pin
     specificity to the [data-scroll-overflow]-only baseline, letting the later forced-colors
     override (same base selectors) win its tie on source order. */
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
  /* orientationBreakpoint's live axis, present only while that feature is opted into (stepper.ts's
     updateEffectiveOrientation()), so it overrides the authored orientation rules above on source
     order alone at equal specificity whenever the effective axis diverges. */
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
     so the live-axis override re-applies the fade instead of the 'none' it must otherwise declare
     -- the vertical arm it competes with sets the property, and CSS cascades per-property.
     data-scroll-start/data-scroll-end are :where()-wrapped as above, pinning specificity to this
     rule's own [data-scroll-overflow]-only baseline so the forced-colors override below wins. */
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
  /* :where() leaves only :hover contributing -- (0,1,0), below the (0,2,0)
     [part='step'][data-state='current'] / [data-state='error'] colour rules further down, so those
     steps keep their own colour under the pointer. */
  :where([part="step"]):hover:where(:not([aria-disabled="true"])) {
    background: var(--lr-stepper-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-stepper-hover-color, var(--lr-color-text));
  }
  /* The hover fill mixed further toward --lr-color-mix-partner, so a press reads a visible tier
     past a rest. Same :not() guard and zeroed specificity as the hover rule above. */
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
     ancestor with no :host declaration shadowing them. ::part(step)[data-state='current'] is
     invalid CSS -- an attribute selector cannot follow ::part -- so recoloring current/error
     otherwise means hijacking the shared --lr-color-text/--lr-color-danger/--lr-color-brand tokens
     and repainting everything else reading them. Unset, each falls back to its former token. */
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
  /* Rendered additionally to, never instead of, step-index/step-check below; [part="step"]'s own
     gap already spaces it from whichever follows, so it needs no margin. Mirrors lr-segmented's
     segment-icon minus its margin-inline-end, which compensates for [part="segment"] having no
     gap of its own. */
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
  /* An active breakpoint can temporarily make an authored vertical stepper horizontal; the opt-in
     stays vertical-only, and this later effective-axis rule beats the authored-axis one. */
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
