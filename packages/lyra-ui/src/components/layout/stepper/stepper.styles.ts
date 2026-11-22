import { visuallyHidden } from '../../../internal/a11y.js';
import { forcedColorsPart } from '../../../internal/forced-colors.styles.js';
import { activeFill, disabledControl, focusRing, focusRingOffset, focusRingOffsetInset } from '../../../internal/interactive-control.styles.js';
import { scrollOverflowFade } from '../../../internal/scroll-overflow.styles.js';
import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
  }
  [part="base"] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-m);
    padding-inline: var(--lr-size-1px);
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
  /* The track becomes focusable only while it is read-only AND genuinely overflowing, because a
     read-only strip has no tabbable step left inside it (stepper.class.ts's syncScrollTabStop()). A
     focusable box owes a visible focus indicator, so it gets the same ring [part="step"] carries.
     No :hover twin: a scroll container is not a pointer target -- it has no cursor: pointer and
     nothing of its own to light up -- and tinting the whole strip under the pointer would read as
     a selection it cannot make. */
  [part="base"]:focus-visible {
    ${focusRing}
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
  /* orientationBreakpoint's live axis, present only while that feature is opted into (stepper.class.ts's
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
  ${scrollOverflowFade(
    ':host([data-effective-orientation="horizontal"]) [part="base"][data-scroll-overflow]',
    ':host(:dir(rtl)[data-effective-orientation="horizontal"]) [part="base"][data-scroll-overflow]',
  )}
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
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="step"][aria-disabled="true"] {
    ${disabledControl}
  }
  /* A read-only strip is a progress display, not a locked control: the steps stop being buttons
     altogether (stepper.class.ts's render()), so only the click affordance is withdrawn. Deliberately no
     --lr-opacity-disabled here -- 'disabled' says "you may not do this", read-only says "there is
     nothing to do here", and a dimmed progress display reads as broken rather than informational.
     Matches lr-slider's and lr-rating's own read-only rules. The disabled rule above cannot reach
     these steps at all: a read-only step renders no aria-disabled, because a non-interactive item
     has no availability to report. */
  :host([readonly]) [part="step"] {
    cursor: default;
  }
  /* :where() leaves only :hover contributing -- (0,1,0), below the (0,2,0)
     [part='step'][data-state='current'] / [data-state='error'] colour rules further down, so those
     steps keep their own colour under the pointer. The button type selector is inside the
     :where() too, so it costs nothing and keeps this exact ordering while excluding the read-only
     div that renders the same part. */
  :where(button[part="step"]):hover:where(:not([aria-disabled="true"])) {
    background: var(--lr-stepper-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-stepper-hover-color, var(--lr-color-text));
  }
  /* The hover fill mixed further toward --lr-color-mix-partner, so a press reads a visible tier
     past a rest. Same :not() guard and zeroed specificity as the hover rule above. */
  :where(button[part="step"]):active:where(:not([aria-disabled="true"])) {
    background: var(
      --lr-stepper-active-bg,
      ${activeFill('var(--lr-color-brand-quiet)')}
    );
    color: var(--lr-stepper-active-color, var(--lr-color-text));
  }
  [part="step"]:focus-visible {
    ${focusRing}
  }
  /* Horizontal scrolling clips both axes. Keep the entire ring inside the button rather than
     letting the track clip its block edges or the first and last step's inline edges. */
  :host(:where(:not([orientation="vertical"]))) [part="step"]:focus-visible,
  :host(:where([data-effective-orientation="horizontal"])) [part="step"]:focus-visible {
    ${focusRingOffsetInset}
  }
  :host(:where([data-effective-orientation="vertical"])) [part="step"]:focus-visible {
    ${focusRingOffset}
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
    box-sizing: border-box;
    border: var(--lr-stepper-index-border, none);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-stepper-index-bg, var(--lr-color-neutral-fill-normal));
    color: var(--lr-stepper-index-color, var(--lr-color-neutral-on-normal));
    font-size: var(--lr-font-size-xs);
    flex: 0 0 auto;
  }
  [part="step"][data-state="current"] [part="step-index"] {
    border: var(--lr-stepper-current-index-border, var(--lr-stepper-index-border, none));
    background: var(--lr-stepper-current-index-bg, var(--lr-color-brand));
    color: var(--lr-stepper-current-index-color, var(--lr-color-on-brand));
  }
  [part="step"][data-state="error"] [part="step-index"] {
    border: var(--lr-stepper-error-index-border, var(--lr-stepper-index-border, none));
    background: var(--lr-stepper-error-index-bg, var(--lr-color-neutral-fill-normal));
    color: var(--lr-stepper-error-index-color, var(--lr-color-neutral-on-normal));
  }
  [part="step-check"] {
    display: inline-flex;
    color: var(--lr-stepper-check-color, var(--lr-color-success));
    flex: 0 0 auto;
  }
  [part="step-label"] {
    white-space: nowrap;
  }
  .visually-hidden {
    ${visuallyHidden}
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
  /* Child mode (<lr-step> elements in the default slot): the steps share the row evenly, draw their
     own connectors across the former gap, and are never clipped, so a focus ring, a pulse or a bounce
     can paint past the strip. Declared last so it outranks the array-mode axis rules above. */
  :host [part="base"].child-steps {
    gap: 0;
    padding-inline: 0;
    overflow-x: visible;
    overflow-y: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  :host([orientation="vertical"]) ::slotted(*),
  :host([data-effective-orientation="vertical"]) ::slotted(*) {
    flex: 0 0 auto;
  }
  :host([data-effective-orientation="horizontal"]) ::slotted(*) {
    flex: 1 1 0;
  }
  ${forcedColorsPart('[part="step"][aria-current="step"]')}
`;
