import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-app-rail-group-gap, var(--lr-space-xs));
    padding-block: var(--lr-app-rail-group-padding-block, var(--lr-space-xs));
    min-inline-size: 0;
  }
  [part="header"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part="heading"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--lr-app-rail-group-heading-color, var(--lr-color-text-quiet));
    font-size: var(--lr-app-rail-group-heading-font-size, var(--lr-font-size-sm));
    font-weight: var(--lr-font-weight-semibold);
  }
  /* Blockified explicitly. Without collapsible the span is a plain inline child of the heading
     div, and inline boxes ignore inline-size, block-size and overflow -- so both the ellipsis
     truncation here and the icon-only clip below were inert for the DEFAULT (non-collapsible)
     group. With collapsible it is a flex item of the toggle and was already blockified, which is
     why only one of the two paths ever looked right. */
  [part="heading-text"] {
    display: block;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The heading's text IS the collapse control (the accordion pattern), so the button inherits the
     heading's own typography instead of the user-agent button font. */
  [part="toggle"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    /* Shared WCAG 2.5.8 floor on BOTH axes, as every other interactive part in this family takes. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-xs);
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part="toggle"]:hover {
    background: var(--lr-app-rail-group-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-group-hover-color, var(--lr-color-brand));
  }
  /* Pressed travels further along hover's own axis -- the same brand-quiet fill mixed toward
     --lr-color-mix-partner, which follows the text colour, so it deepens on a light theme and
     lightens on a dark one. */
  [part="toggle"]:active {
    background: var(
      --lr-app-rail-group-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-app-rail-group-active-color, var(--lr-color-brand));
  }
  [part="toggle"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* icons.ts ships one right-pointing chevron and asks callers to rotate the WRAPPING element.
     Open points down (the content below it), closed points along the reading direction. */
  [part="toggle-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    transform: rotate(90deg);
    transition: transform var(--lr-transition-fast);
  }
  [part="toggle"]:where([aria-expanded="false"]) [part="toggle-icon"] {
    transform: none;
  }
  :host(:dir(rtl)) [part="toggle"]:where([aria-expanded="false"]) [part="toggle-icon"] {
    transform: rotate(180deg);
  }
  [part="header-actions"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  [part="header-actions"][hidden] {
    display: none;
  }
  [part="content"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-app-rail-group-gap, var(--lr-space-xs));
    min-inline-size: 0;
  }
  [part="content"][hidden] {
    display: none;
  }
  /* The narrow rail has no room for a section title, but the group still has to keep its name:
     clipped out of layout, left in the accessibility tree, exactly as the item's own label is. */
  :host([icon-only]) [part="heading-text"] {
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  :host([icon-only]) [part="toggle"] {
    justify-content: center;
    padding-inline: 0;
  }
  :host([icon-only]) [part="header"] {
    justify-content: center;
  }

  @media (prefers-reduced-motion: reduce) {
    [part="toggle"],
    [part="toggle-icon"] {
      transition: none !important;
    }
  }
`;
