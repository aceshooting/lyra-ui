import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    gap: var(--lr-space-m);
    /* overflow-y is paired explicitly (never left implicit) alongside every overflow-x here and
       below: per the CSS overflow spec, pinning one axis to a non-'visible' value forces the
       other axis's *used* value to 'auto' too if left unset -- which can paint a thin, empty
       phantom scrollbar on a classic (non-overlay) scrollbar platform even when the steps
       actually fit (the exact bug already found and fixed once on lr-tabs). The mask-image edge
       fade mirrors lr-tabs'/lr-segmented's identical horizontally-scrolling-row treatment; it is
       reset to 'none' in the vertical-axis rules below so it can never bleed through a
       higher-specificity match that doesn't also redeclare it (CSS cascades per-property, not
       per-rule). This is intentionally static: a low-cost affordance, no scroll-position JS. */
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  /* orientationBreakpoint's live axis -- only present while that feature is opted into (see
     stepper.ts's updateEffectiveOrientation()), so it can override the authored orientation rules
     above by source order alone (equal specificity) whenever the effective axis diverges from it. */
  :host([data-effective-orientation='vertical']) [part='base'] {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  :host([data-effective-orientation='horizontal']) [part='base'] {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part='step'] {
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
  [part='step'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, so a consumer's own ::part(step):hover override ((0,1,1)) always wins
     without needing !important (mirrors lr-attachment-trigger's identical fix). */
  :where([part='step']):hover:where(:not([aria-disabled='true'])) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
  }
  [part='step']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor without a :host declaration shadowing that. ::part(step)[data-state='current'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the current/error state
     used to require hijacking the shared --lr-color-text/--lr-color-danger/--lr-color-brand tokens,
     which repainted everything else that reads them. Unset, each falls back to the token the rule
     used before, so the rendering is unchanged. */
  [part='step'][data-state='current'] {
    color: var(--lr-stepper-current-color, var(--lr-color-text));
    font-weight: var(--lr-stepper-current-font-weight, var(--lr-font-weight-semibold));
  }
  [part='step'][data-state='error'] {
    color: var(--lr-stepper-error-color, var(--lr-color-danger));
  }
  /* Rendered additionally to, never instead of, step-index/step-check below -- [part="step"]'s
     own gap already spaces it from whichever of those follows, so no margin of its own is
     needed (mirrors lr-segmented's segment-icon, minus its margin-inline-end, which compensates
     for lr-segmented's [part="segment"] having no gap of its own). */
  [part='step-icon'] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    block-size: var(--lr-size-1em);
    max-inline-size: var(--lr-size-2-5rem);
  }
  [part='step-index'] {
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
  [part='step'][data-state='current'] [part='step-index'] {
    background: var(--lr-stepper-current-index-bg, var(--lr-color-brand));
    color: var(--lr-stepper-current-index-color, var(--lr-color-surface));
  }
  [part='step-check'] {
    color: var(--lr-color-success);
    flex: 0 0 auto;
  }
  [part='step-label'] {
    white-space: nowrap;
  }
`;
