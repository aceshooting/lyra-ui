import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part="base"] {
    /* Anchors the absolutely-positioned [part="current-indicator"] below. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--lr-app-rail-item-gap, var(--lr-space-s));
    inline-size: 100%;
    /* max() floors the row's own hit target at the shared WCAG 2.5.8 minimum regardless of the
       override -- a consumer can grow the row but never shrink it below the accessible floor.
       Unset, max(icon-button-size, icon-button-size) resolves to exactly today's value. */
    min-block-size: max(
      var(--lr-icon-button-size),
      var(--lr-app-rail-item-min-block-size, var(--lr-icon-button-size))
    );
    padding: var(--lr-app-rail-item-padding, var(--lr-space-s));
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="base"]:not([aria-disabled="true"]):hover {
    background: var(--lr-app-rail-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-hover-color, var(--lr-color-brand));
  }
  /* Pressed travels further along hover's own axis: the same brand-quiet fill mixed toward
     --lr-color-mix-partner, which follows the text colour, so it deepens on a light theme and
     lightens on a dark one rather than depending on a brightness multiplier's direction. */
  [part="base"]:not([aria-disabled="true"]):active {
    background: var(
      --lr-app-rail-item-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-app-rail-item-active-color, var(--lr-color-brand));
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="base"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and no :host declaration shadows that. ::part(base)[aria-current='page'] is invalid
     CSS -- an attribute selector cannot follow ::part -- so hijacking the shared
     --lr-color-brand-quiet/--lr-color-brand tokens was previously the only route, repainting every
     other element reading them. Unset, each falls back to the token used before. */
  [part="base"][aria-current="page"] {
    background: var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-current-color, var(--lr-color-brand));
    font-weight: var(--lr-font-weight-semibold);
  }
  /* Mirrors lr-conversation-item's shipped [part="active-indicator"] (same inset-inline/width/
     color token shape); rendered only while aria-current="page" (see the class doc), so it is
     absent whenever this rule would otherwise be inert. */
  [part="current-indicator"] {
    position: absolute;
    inset-block: 0;
    inset-inline: var(--lr-app-rail-item-current-indicator-inset-inline, 0 auto);
    inline-size: var(--lr-app-rail-item-current-indicator-width, var(--lr-size-2px));
    box-sizing: border-box;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-app-rail-item-current-indicator-color, var(--lr-color-brand));
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  [part="icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* Deliberately floors only the inline axis: [part='base']'s own min-block-size above already
       guarantees the row's tappable height, so flooring the block axis too would add nothing for
       target size while forcing every row to --lr-icon-button-size + 2x --lr-space-s. Unlike the
       row's own min-block-size hook, this one is not floor-clamped: the icon is decorative
       content, not itself a pointer target, so shrinking it never shrinks the row's own hit area. */
    inline-size: var(--lr-app-rail-item-icon-size, var(--lr-icon-button-size));
    min-inline-size: var(--lr-app-rail-item-icon-size, var(--lr-icon-button-size));
  }
  [part="label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([icon-only]) [part="label"] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  :host([icon-only]) [part="base"] {
    justify-content: center;
    padding-inline: 0;
  }
  [part="tooltip"] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-color-text);
    color: var(--lr-color-surface);
    font-size: var(--lr-font-size-sm);
    box-sizing: border-box;
    max-inline-size: var(
      --lr-positioner-available-inline-size,
      calc(100vw - 2 * var(--lr-space-s))
    );
    overflow-wrap: anywhere;
    white-space: normal;
    pointer-events: none;
  }
`;
