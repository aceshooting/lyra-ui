import { iconHitTarget, focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  /* No :host position/inset is imposed -- unlike an overlay component, lr-dock-panel deliberately
     stays layout-agnostic (see the class doc): drop it as an absolutely-positioned child of a
     position:relative parent or as a flex item, and it manages only its own size along the resize
     axis plus filling the cross axis. */
  :host {
    display: block;
    box-sizing: border-box;
    /* Themeable persistent-rail width/height while collapsed -- a plain custom property, not a JS
       prop, so it overrides from outside (the class doc says why collapse hides content rather
       than zeroing the box). Reuses the shared icon-button tap-target token so the toggle on the
       rail stays comfortably tappable. */
    --_lr-dock-panel-collapsed-size: var(--lr-icon-button-size);
    position: relative;
  }
  :host([placement="start"]),
  :host([placement="end"]) {
    block-size: 100%;
  }
  :host([placement="top"]),
  :host([placement="bottom"]) {
    inline-size: 100%;
  }
  /* The collapsed-rail floor applies only once collapsed -- scoped here, not on the bare [placement]
     selectors above, so it can never override a smaller explicit min-extent (resolved in JS by
     resolveBoundsPx()) while expanded. Unconditional it would silently win over a min-extent below
     the rail token's width: a CSS min-inline-size/min-block-size always beats an inline size
     style, whatever applySize() computed and announced via aria-valuenow. */
  :host([placement="start"][collapsed]),
  :host([placement="end"][collapsed]) {
    min-inline-size: var(
      --lr-dock-panel-collapsed-size,
      var(--_lr-dock-panel-collapsed-size)
    );
  }
  :host([placement="top"][collapsed]),
  :host([placement="bottom"][collapsed]) {
    min-block-size: var(
      --lr-dock-panel-collapsed-size,
      var(--_lr-dock-panel-collapsed-size)
    );
  }

  [part="base"] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    overflow: hidden;
  }

  [part="content"] {
    inline-size: 100%;
    block-size: 100%;
    overflow: auto;
  }
  [part="content"][hidden] {
    display: none;
  }

  /* The draggable edge -- always the panel's *inner* boundary (opposite the docked/pinned edge),
     on logical insets so the start/end edges mirror automatically under RTL. */
  [part="handle"] {
    position: absolute;
    background: var(--lr-color-border);
    touch-action: none;
    transition: background var(--lr-transition-fast);
  }
  /* --lr-dock-panel-handle-hover-color/-active-color deliberately do not reuse the bare
     --lr-color-brand the collapse-toggle's tokens fall back to below: a drag-affordance accent and
     a button's hover/active feedback are different purposes that shared a token by coincidence.
     Each has its own scoped override, defaulting to the same rendered color. */
  [part="handle"]:hover {
    background: var(--lr-dock-panel-handle-hover-color, var(--lr-color-brand));
  }
  /* Split out of the :hover selector list so the pressed rule below can be that rule's exact twin:
     swapping :hover for :active in a list also carrying :focus-visible would have repainted the
     focus state as pressed. */
  [part="handle"]:focus-visible {
    background: var(--lr-dock-panel-handle-hover-color, var(--lr-color-brand));
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  /* After :focus-visible, so a keyboard-focused handle still shows the deeper pressed fill for the
     whole pointer drag (pointer capture holds :active throughout).
     --lr-dock-panel-handle-active-color falls back through color-mix() on the hover token, so
     overriding hover alone retints the pressed state too; an explicit active override opts out. */
  [part="handle"]:active {
    background: var(
      --lr-dock-panel-handle-active-color,
      color-mix(
        in oklab,
        var(--lr-dock-panel-handle-hover-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  /* Keep the target inside the clipped panel while leaving its visible line thin. */
  [part="handle"]::before {
    content: "";
    position: absolute;
    inline-size: max(var(--lr-icon-button-size), var(--lr-dock-panel-handle-hit-area, var(--lr-space-m)));
    block-size: 100%;
    inset-block-start: 0;
    inset-inline-start: 0;
  }
  :host([placement="start"]) [part="handle"]::before {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  :host([placement="top"]) [part="handle"]::before,
  :host([placement="bottom"]) [part="handle"]::before {
    inline-size: 100%;
    block-size: max(var(--lr-icon-button-size), var(--lr-dock-panel-handle-hit-area, var(--lr-space-m)));
    inset-inline-start: 0;
    inset-block-start: 0;
  }
  :host([placement="top"]) [part="handle"]::before {
    inset-block-start: auto;
    inset-block-end: 0;
  }

  :host([placement="start"]) [part="handle"] {
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: var(--lr-size-3px);
    cursor: col-resize;
  }
  :host([placement="end"]) [part="handle"] {
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: var(--lr-size-3px);
    cursor: col-resize;
  }
  :host([placement="top"]) [part="handle"] {
    inset-inline: 0;
    inset-block-end: 0;
    block-size: var(--lr-size-3px);
    cursor: row-resize;
  }
  :host([placement="bottom"]) [part="handle"] {
    inset-inline: 0;
    inset-block-start: 0;
    block-size: var(--lr-size-3px);
    cursor: row-resize;
  }

  [part="collapse-toggle"] {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    ${iconHitTarget}
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-none);
    transition: background var(--lr-transition-fast),
      color var(--lr-transition-fast);
    z-index: var(--lr-layer-content);
  }
  /* :active reuses the two scoped tokens :hover sets -- mixed for the background, verbatim for the
     color -- rather than an active-only pair, mirroring this file's [part="handle"] precedent
     above, where :active derives straight from the color :hover uses. */
  [part="collapse-toggle"]:hover {
    background: var(
      --lr-dock-panel-collapse-toggle-hover-bg,
      var(--lr-color-brand-quiet)
    );
    color: var(
      --lr-dock-panel-collapse-toggle-hover-color,
      var(--lr-color-brand)
    );
  }
  [part="collapse-toggle"]:active {
    background: color-mix(
      in oklab,
      var(
        --lr-dock-panel-collapse-toggle-hover-bg,
        var(--lr-color-brand-quiet)
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(
      --lr-dock-panel-collapse-toggle-hover-color,
      var(--lr-color-brand)
    );
  }
  [part="collapse-toggle"]:focus-visible {
    ${focusRing}
  }

  :host([placement="start"]) [part="collapse-toggle"] {
    inset-inline-end: var(--lr-space-xs);
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([placement="end"]) [part="collapse-toggle"] {
    inset-inline-start: var(--lr-space-xs);
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([placement="top"]) [part="collapse-toggle"] {
    inset-block-end: var(--lr-space-xs);
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }
  :host([placement="bottom"]) [part="collapse-toggle"] {
    inset-block-start: var(--lr-space-xs);
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }
  /* On top/bottom edges the toggle centers on inset-inline-start: 50%, which anchors to the
     physical right edge under RTL, so translateX(-50%) must flip sign or the toggle sits a full
     box-width off center. The start/end edges center on the block axis (translateY), which no text
     direction affects. */
  :host(:dir(rtl)[placement="top"]) [part="collapse-toggle"],
  :host(:dir(rtl)[placement="bottom"]) [part="collapse-toggle"] {
    transform: translateX(50%);
  }
  /* Collapse-toggle chevron mirroring for the start/end edges (the top/bottom rotation stays
     JS-computed in topBottomChevronDeg -- it depends only on collapsed, not direction). The chevron
     points toward the panel's pinned edge when expanded and away from it when collapsed; since
     start/end swap which physical side they pin to under RTL, a live dir(rtl) rule keeps the
     glyph correct even when an ancestor's dir flips after this host has already rendered once --
     no JS re-render required, unlike the inline-style rotation this replaces. The more specific
     collapsed/dir(rtl) combinations below rely on selector specificity (more attribute selectors
     always outrank fewer), not source order, to win. */
  :host([placement="start"]) [part="collapse-toggle"] span {
    transform: rotate(180deg);
  }
  :host([placement="start"][collapsed]) [part="collapse-toggle"] span {
    transform: rotate(0deg);
  }
  :host([placement="end"]) [part="collapse-toggle"] span {
    transform: rotate(0deg);
  }
  :host([placement="end"][collapsed]) [part="collapse-toggle"] span {
    transform: rotate(180deg);
  }
  :host(:dir(rtl)[placement="start"]) [part="collapse-toggle"] span {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)[placement="start"][collapsed]) [part="collapse-toggle"] span {
    transform: rotate(180deg);
  }
  :host(:dir(rtl)[placement="end"]) [part="collapse-toggle"] span {
    transform: rotate(180deg);
  }
  :host(:dir(rtl)[placement="end"][collapsed]) [part="collapse-toggle"] span {
    transform: rotate(0deg);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="collapse-toggle"],
    [part="handle"] {
      transition: none !important;
    }
  }
`;
