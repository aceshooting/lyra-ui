import { css } from 'lit';

export const styles = css`
  :host {
    display: none;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* The panel gutter lives here, not on the base, because the close control's pull-out below has
       to stay inside it. An explicit tier re-points this; with no tier it keeps the pre-ladder
       value the panel always had. Same indirection lr-callout uses for its own gutter. */
    --_lr-alert-padding: var(--lr-space-m);
  }

  :host([open]),
  :host([data-alert-showing]),
  :host([data-alert-hiding]) {
    display: block;
  }

  /* Shoelace calls its brand/default tone "primary". Re-point the shared semantic slots instead
     of introducing a second colour vocabulary for this compatibility component. */
  :host([variant='primary']) {
    --lr-color-fill-quiet: var(--lr-color-brand-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-brand-fill-normal);
    --lr-color-fill-loud: var(--lr-color-brand-fill-loud);
    --lr-color-border-quiet: var(--lr-color-brand-border-quiet);
    --lr-color-border-normal: var(--lr-color-brand-border-normal);
    --lr-color-border-loud: var(--lr-color-brand-border-loud);
    --lr-color-on-quiet: var(--lr-color-brand-on-quiet);
    --lr-color-on-normal: var(--lr-color-brand-on-normal);
    --lr-color-on-loud: var(--lr-color-brand-on-loud);
  }

  [part='base'] {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--lr-space-s);
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    overflow: hidden;
    padding: var(--_lr-alert-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-normal);
    border-radius: var(--lr-radius);
    background: var(--lr-color-fill-quiet);
    color: var(--lr-color-on-quiet);
    box-shadow: var(--lr-shadow-s);
    opacity: 1;
    transform: none;
    transition:
      opacity var(--lr-duration-fast) var(--lr-easing-standard),
      transform var(--lr-duration-fast) var(--lr-easing-standard);
  }

  /* A queued alert renders its base with both hidden and inert. inert is platform-enforced, but
     hidden did nothing: the display: grid above is author origin and beats the UA
     "[hidden] { display: none }" whatever their specificities, leaving the surface laid out. The
     queue path also hides the host from <lr-toast>'s side, so nothing looked wrong; this keeps the
     alert's own half of the contract true, matching the [part='icon'][hidden] guard below. */
  [part='base'][hidden] {
    display: none;
  }

  /* Size tiers, from the explicit-only ladder in
     internal/contextual-vocabulary.styles.ts, which re-points the generic form-control slots per
     tier and matches both spellings of each tier in one selector list -- so small, medium and
     large arrive without any JS normalisation.
     Only a host that carries a size attribute reads them. With none, the panel keeps the gutter
     above and the text size it inherits, which is exactly what it rendered before the ladder
     reached this component; an unrecognised tier leaves the slots unset, so the gutter falls back
     to that same value and the font-size declaration is invalid at computed-value time and
     inherits.
     Three deliberate departures from a form control, each matching lr-callout's tier values so a
     tiered alert and a tiered callout of the same size line up in one column. The ladder INLINE
     gutter is used on every side: the block gutter is a single-row control's, and it collapses to
     zero at the two smallest tiers, which would leave an alert's text touching its own border. The
     gap separates three adjacent boxes rather than setting the panel's density, so it stays
     constant across tiers. And the leading icon keeps its own glyph size, bounded by the shared
     tappable-target token, so the status affordance does not shrink out of legibility in a dense
     toolbar.
     The UNSET states are NOT interchangeable, and deliberately so. With no tier this panel keeps
     the fixed gutter above and inherits the ambient text size, which is exactly what it rendered
     before the ladder reached it; an untiered lr-callout instead reads the ambient form-control
     slots and falls back to the shared m padding and m font size. Pinning a default tier here
     would resize every alert that shipped before this property existed. */
  :host(:where([size])) {
    --_lr-alert-padding: var(--lr-form-control-padding-inline, var(--lr-space-m));
  }

  :host(:where([size])) [part='base'] {
    font-size: var(--lr-form-control-font-size);
  }

  :host([data-alert-showing]) [part='base'],
  :host([data-alert-hiding]) [part='base'] {
    opacity: 0;
    transform: translateY(var(--lr-size-neg-8px));
  }

  [part='icon'] {
    display: inline-flex;
    grid-column: 1;
    color: var(--lr-color-fill-loud);
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-none);
    min-inline-size: 0;
    max-inline-size: var(--lr-icon-button-size);
    overflow: hidden;
  }

  [part='icon'] ::slotted(*) {
    max-inline-size: 100%;
  }

  [part='icon'][hidden] {
    display: none;
  }

  [part='message'] {
    grid-column: 2;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    unicode-bidi: plaintext;
  }

  [part~='close-button'] {
    display: inline-flex;
    grid-column: 3;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    /* The pull-out is optical alignment: it absorbs this button's own padding so the glyph reads
       level with the panel edge instead of inset twice. It is clamped to the panel gutter because
       the base clips its overflow, and a pull deeper than the gutter pushes the tappable target
       through the border, where it is cut off rather than merely tight. Only the ladder's two
       smallest tiers are narrower than the pull (2px and 4px gutters against a 4px pull); every
       other tier, and the untiered panel, keep the full pull unchanged.
       The hit-area floor above holds the shared tappable-target token at every tier, because it is
       a WCAG 2.5.8 minimum rather than a density knob -- a dense alert shrinks its gutter and its
       text and keeps its hit area. */
    --_lr-alert-close-pull: min(var(--lr-space-xs), var(--_lr-alert-padding));
    margin-block: calc(-1 * var(--_lr-alert-close-pull));
    margin-inline-end: calc(-1 * var(--_lr-alert-close-pull));
    padding: var(--lr-space-xs);
    border: 0;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  [part~='close-button']:where(:hover) {
    background: var(
      --lr-alert-close-hover-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
  }

  [part~='close-button']:where(:active) {
    background: var(
      --lr-alert-close-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }

  [part~='close-button']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  .countdown {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: var(--lr-size-4px);
    background: var(--lr-color-fill-loud);
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      transition: none;
    }

    .countdown {
      display: none;
    }
  }
`;
