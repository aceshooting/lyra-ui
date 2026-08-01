import { css } from "lit";

export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="separator"] {
    color: var(--lr-color-text-quiet);
    flex: 0 0 auto;
  }
  :host(:first-child) [part="separator"] {
    display: none;
  }
  [part="base"] {
    color: var(--lr-color-text);
    text-decoration: none;
    border-radius: var(--lr-radius);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  a[part="base"]:hover {
    text-decoration: underline;
  }
  /* A link has no fill of its own to deepen, so the pressed state paints one. Mixing from
     transparent yields --lr-color-mix-partner at --lr-color-mix-active alpha, which tints whatever
     surface the trail happens to sit on rather than assuming --lr-color-surface is behind it. */
  a[part="base"]:active {
    text-decoration: underline;
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Inline var() fallback rather than a :host-declared property, so a consumer can set it on any
     ancestor without a :host declaration shadowing that. ::part(base)[aria-current='page'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the current-page label
     used to require hijacking the shared --lr-color-text-quiet token, repainting everything else
     that reads it. Unset, it falls back to that token, so the rendering is unchanged. */
  [part="base"][aria-current="page"] {
    color: var(--lr-breadcrumb-current-color, var(--lr-color-text-quiet));
    font-weight: var(--lr-font-weight-semibold);
  }
`;
